import { Injectable } from "@angular/core";
import { OrdersService } from "../services/order-service/orders.service";
import { OfflineAction, OfflineDbService } from "./offline-db";
import { debounceTime, filter, firstValueFrom, Subject, BehaviorSubject } from "rxjs";
import { CartItem, OrderItemDTO, cartItemFromOrderLine } from "../models/orderingModel";
import { OnlineStateService } from "./online-state-service";
import { AuthService } from "../auth/auth.service";
import { AppToastService } from "../services/toast-service/toast-service.service";
import { buildSyncOrderItemsFromPending, sortOfflineQueueActions } from "./offline-queue.util";
import { OfflineSyncSchedulerService } from "./offline-sync-scheduler.service";

const QUEUE_HTTP_OPTS = { suppressErrorToast: true as const };

type ProcessActionResult = 'skip' | boolean;

@Injectable({ providedIn: 'root' })
export class OfflineQueueProcessor {
    private processing = false;
    private drainAgain = false;
    private trigger$ = new Subject<void>();
    private readonly processingSubject = new BehaviorSubject<boolean>(false);
    readonly isProcessing$ = this.processingSubject.asObservable();
    readonly orderConfirmed$ = new Subject<{ tableId: string; orderId: string }>();


    constructor(
        private offlineDB: OfflineDbService,
        private ordersService: OrdersService,
        private onlineStateService: OnlineStateService,
        private authService: AuthService,
        private toast: AppToastService,
        private syncScheduler: OfflineSyncSchedulerService,
    ) {
        this.trigger$
            .pipe(
                debounceTime(350)
            )
            .subscribe(() => {
                if (this.syncScheduler.isCountdownActive()) {
                    return;
                }
                void this.processQueue();
            });
    }

    triggerProcessing() {
        if (this.syncScheduler.isCountdownActive()) {
            return;
        }
        this.trigger$.next();
    }

    async recoverOrphanedCartsPublic(): Promise<void> {
        await this.recoverOrphanedCarts();
    }

    private async getScopedRestaurantId(): Promise<string | null> {
        const restaurantId = this.authService.getUserSnapshot()?.restaurantId ?? null;
        if (!restaurantId) {
            return null;
        }
        const purged = await this.offlineDB.purgeOfflineDataExceptRestaurant(restaurantId);
        // #region agent log
        if (purged.removedCarts > 0 || purged.removedActions > 0) {
            fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '38fcde' },
                body: JSON.stringify({
                    sessionId: '38fcde',
                    location: 'offline-queue-processor.service.ts:getScopedRestaurantId',
                    message: 'purged cross-restaurant offline data',
                    data: { restaurantId, ...purged },
                    hypothesisId: 'H-OFFLINE-SCOPE',
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
        }
        // #endregion
        return restaurantId;
    }

    private async recoverOrphanedCarts(): Promise<void> {
        const restaurantId = await this.getScopedRestaurantId();
        if (!restaurantId) {
            return;
        }

        const allCarts = await this.offlineDB.carts.toArray();
        const allActions = await this.offlineDB.queue.toArray();

        for (const cart of allCarts) {
            if (!cart.orderId?.startsWith('local-')) continue;

            const hasAction = allActions.some(
                a => a.orderId === cart.orderId && a.restaurantId === restaurantId,
            );
            if (hasAction) continue;

            if (cart.restaurantId && cart.restaurantId !== restaurantId) {
                await this.offlineDB.deleteCart(cart.tableId);
                continue;
            }

            console.warn('[RECOVERY] Re-queuing orphaned cart:', cart.tableId);

            await this.offlineDB.addOfflineAction({
                type: 'NEW_ORDER',
                restaurantId,
                tableId: cart.tableId,
                orderId: cart.orderId,
                payload: { seatId: null },
            });

            await this.offlineDB.addOfflineAction({
                type: 'INIT_ORDER_ITEMS_FINAL',
                restaurantId,
                tableId: cart.tableId,
                orderId: cart.orderId,
                payload: {
                    items: cart.items.map(ci => ({
                        menuItemId: ci.item.menuItemId,
                        quantity: ci.quantity,
                    })),
                },
            });
        }
    }

    async processQueue() {
        if (this.processing) {
            this.drainAgain = true;
            return;
        }
        if (!this.onlineStateService.isOnline) return;

        this.processing = true;
        this.processingSubject.next(true);
        try {
            do {
                this.drainAgain = false;
                let rounds = 0;
                while (rounds++ < 40) {
                    const progressed = await this.runOneQueuePass();
                    const restaurantId = await this.getScopedRestaurantId();
                    const remaining = restaurantId
                        ? (await this.offlineDB.getPendingActionsForRestaurant(restaurantId)).length
                        : 0;
                    if (!progressed || remaining === 0) {
                        break;
                    }
                }
            } while (this.drainAgain);
        } finally {
            this.processing = false;
            this.processingSubject.next(false);
        }
    }

    /** One sorted pass over the pending queue (may stop early on retry/defer). */
    private async runOneQueuePass(): Promise<boolean> {
        if (!this.onlineStateService.isOnline) return false;

        const restaurantId = await this.getScopedRestaurantId();
        if (!restaurantId) return false;

        let pending = await this.offlineDB.getPendingActionsForRestaurant(restaurantId);
        if (pending.length === 0) return false;

        pending = sortOfflineQueueActions(pending);
        // #region agent log
        fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
            body: JSON.stringify({
                sessionId: 'd38222',
                location: 'offline-queue-processor.service.ts:runOneQueuePass',
                message: 'queue pass started',
                data: {
                    restaurantId,
                    pendingCount: pending.length,
                    actions: pending.map(a => ({
                        id: a.id,
                        type: a.type,
                        tableId: a.tableId,
                        orderId: a.orderId,
                        timestamp: a.timestamp,
                    })),
                },
                hypothesisId: 'H5-trysync-race',
                runId: 'post-fix-v2',
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion

        const compressed = await this.compressQueue(pending);
        await this.offlineDB.replaceActions(compressed);
        const actions = sortOfflineQueueActions(compressed);

        let progressed = false;
        for (const action of actions) {
            const result = await this.processAction(action);

            if (result === 'skip') {
                continue;
            }

            if (!result) {
                this.triggerProcessing();
                break;
            }

            progressed = true;

            if (action.type !== 'NEW_ORDER') {
                await this.offlineDB.markActionDone(action.id!);
            }

            if (action.type === 'NEW_ORDER') {
                break;
            }
        }

        return progressed;
    }

    private async hasPendingCloseForTable(restaurantId: string, tableId: string): Promise<boolean> {
        const pending = await this.offlineDB.getPendingActionsForRestaurant(restaurantId);
        return pending.some(a => a.type === 'CLOSE_ORDER' && a.tableId === tableId);
    }

    async processAction(action: OfflineAction): Promise<ProcessActionResult> {
        // 1. Dacă acțiunea NU este NEW_ORDER și orderId este local → așteptăm NEW_ORDER
        if (action.type !== 'NEW_ORDER' && action.orderId?.startsWith('local-')) {
            return 'skip';
        }

        // 2. Dacă suntem offline → stop
        if (!this.onlineStateService.isOnline) {
            return false;
        }

        try {
            switch (action.type) {

                // -----------------------------------------------------
                // NEW_ORDER → creează order real + trimite toate itemele
                // -----------------------------------------------------
                case 'NEW_ORDER': {
                    // #region agent log
                    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
                        body: JSON.stringify({
                            sessionId: 'd38222',
                            location: 'offline-queue-processor.service.ts:NEW_ORDER',
                            message: 'creating server order',
                            data: {
                                tableId: action.tableId,
                                orderId: action.orderId,
                                timestamp: action.timestamp,
                            },
                            hypothesisId: 'H5-trysync-race',
                            runId: 'post-fix-v2',
                            timestamp: Date.now(),
                        }),
                    }).catch(() => {});
                    // #endregion
                    // 1. creăm order real
                    const res = await firstValueFrom(
                        this.ordersService.newOrder(
                            action.restaurantId,
                            action.tableId,
                            action.payload.seatId ?? undefined,
                            QUEUE_HTTP_OPTS,
                        )
                    );

                    const realOrderId = res.order.orderId;

                    // 2. înlocuim orderId local cu cel real
                    await this.offlineDB.replaceOrderId(action.orderId!, realOrderId);

                    const record = await this.offlineDB.loadCartRecord(action.tableId);
                    const cartBelongsToOrder =
                        record?.orderId === action.orderId || record?.orderId === realOrderId;
                    const cartItems =
                        cartBelongsToOrder && record?.items?.length
                            ? record.items.map(ci => ({
                                menuItemId: ci.item.menuItemId,
                                quantity: ci.quantity,
                            }))
                            : [];

                    const pending = await this.offlineDB.getPendingActionsForRestaurant(action.restaurantId);
                    const orderItems = buildSyncOrderItemsFromPending(
                        pending,
                        action.tableId,
                        action.orderId!,
                        realOrderId,
                        cartItems,
                    );

                    // #region agent log
                    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
                        body: JSON.stringify({
                            sessionId: 'd38222',
                            location: 'offline-queue-processor.service.ts:NEW_ORDER:items',
                            message: 'resolved sync items',
                            data: {
                                tableId: action.tableId,
                                localOrderId: action.orderId,
                                realOrderId,
                                cartBelongsToOrder,
                                cartItemCount: cartItems.length,
                                syncItemCount: orderItems.length,
                                syncItems: orderItems,
                            },
                            hypothesisId: 'H7-empty-cart-init',
                            runId: 'post-fix-v3',
                            timestamp: Date.now(),
                        }),
                    }).catch(() => {});
                    // #endregion

                    if (record && cartBelongsToOrder) {
                        await this.offlineDB.saveCart(action.tableId, record.items, realOrderId);
                    }

                    // 4. trimitem toate itemele la backend
                    const finalRes = await firstValueFrom(
                        this.ordersService.updateOrderItem(
                            action.restaurantId,
                            action.tableId,
                            realOrderId,
                            {
                                orderItems,
                                seatId: null
                            },
                            QUEUE_HTTP_OPTS,
                        )
                    );

                    // 5. actualizăm Dexie cu adevărul global
                    await this.applyFinalOrderState(action.tableId, finalRes.order.orderItems, finalRes.order.orderId);

                    // 6. marcăm NEW_ORDER ca done
                    await this.offlineDB.markActionDone(action.id!);

                    this.orderConfirmed$.next({ tableId: action.tableId, orderId: realOrderId });

                    const allActions = await this.offlineDB.getPendingActions();
                    for (const a of allActions) {
                        const isRedundant =
                            a.orderId === realOrderId &&
                            (
                                a.type === 'INIT_ORDER_ITEMS_FINAL' ||
                                a.type === 'ADD_ITEM' ||
                                a.type === 'UPDATE_QUANTITY' ||
                                a.type === 'DELETE_ITEM'
                            );
                        if (isRedundant) {
                            await this.offlineDB.markActionDone(a.id!);
                        }
                    }

                    this.triggerProcessing();
                    return true;
                }

                case 'INIT_ORDER_ITEMS_FINAL': {
                    const res = await firstValueFrom(
                        this.ordersService.updateOrderItem(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!,
                            {
                                orderItems: action.payload.items,
                                seatId: null
                            },
                            QUEUE_HTTP_OPTS,
                        )
                    );
                    await this.applyFinalOrderState(action.tableId, res.order.orderItems, res.order.orderId);

                    return true;
                }


                // -----------------------------------------------------
                // ADD / UPDATE / DELETE → doar intenții locale
                // -----------------------------------------------------
                case 'ADD_ITEM': {
                    const res = await firstValueFrom(
                        this.ordersService.addOrderItem(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!,
                            action.payload.menuItemId,
                            action.payload.quantity,
                            QUEUE_HTTP_OPTS,
                        )
                    );

                    // Injectăm orderItemId în Dexie
                    const record = await this.offlineDB.loadCartRecord(action.tableId);
                    if (record) {
                        const item = record.items.find(i => i.item.menuItemId === action.payload.menuItemId);
                        if (item) {
                            item.orderItemId = res.orderItemId; // <-- important
                        }
                        await this.offlineDB.saveCart(action.tableId, record.items, action.orderId!);
                    }

                    return true;
                }

                case 'UPDATE_QUANTITY': {
                    // Încearcă să recupereze orderItemId din Dexie dacă lipsește din payload
                    let orderItemId: string | null = action.payload.orderItemId ?? null;

                    if (!orderItemId) {
                        const record = await this.offlineDB.loadCartRecord(action.tableId);
                        const localItem = record?.items.find(i => i.item.menuItemId === action.payload.menuItemId);
                        orderItemId = localItem?.orderItemId ?? null;
                    }

                    if (!orderItemId) {
                        // Nu putem actualiza fără orderItemId → tratăm ca ADD_ITEM
                        console.warn('[QUEUE] UPDATE_QUANTITY fără orderItemId → fallback ADD_ITEM');
                        const res = await firstValueFrom(
                            this.ordersService.addOrderItem(
                                action.restaurantId,
                                action.tableId,
                                action.orderId!,
                                action.payload.menuItemId,
                                action.payload.quantity,
                                QUEUE_HTTP_OPTS,
                            )
                        );
                        const record = await this.offlineDB.loadCartRecord(action.tableId);
                        if (record) {
                            const item = record.items.find(i => i.item.menuItemId === action.payload.menuItemId);
                            if (item) item.orderItemId = res.orderItemId;
                            await this.offlineDB.saveCart(action.tableId, record.items, action.orderId!);
                        }
                        return true;
                    }

                    const res = await firstValueFrom(
                        this.ordersService.updateOrderItemQuantity(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!,
                            orderItemId,
                            action.payload.quantity,
                            QUEUE_HTTP_OPTS,
                        )
                    );

                    const record = await this.offlineDB.loadCartRecord(action.tableId);
                    if (record) {
                        const item = record.items.find(i => i.item.menuItemId === action.payload.menuItemId);
                        if (item) item.orderItemId = res.orderItemId;
                        await this.offlineDB.saveCart(action.tableId, record.items, action.orderId!);
                    }

                    return true;
                }

                case 'DELETE_ITEM': {
                    const res = await firstValueFrom(
                        this.ordersService.deleteOrderItem(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!,
                            action.payload.orderItemId,
                            QUEUE_HTTP_OPTS,
                        )
                    );

                    // Injectăm orderItemId în Dexie
                    const record = await this.offlineDB.loadCartRecord(action.tableId);
                    if (record) {
                        await this.offlineDB.saveOrderSnapshot(action.tableId, res);
                    }

                    return true;
                }


                // -----------------------------------------------------
                // CLOSE_ORDER → trimitem direct la backend
                // -----------------------------------------------------
                case 'CLOSE_ORDER':
                    // #region agent log
                    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
                        body: JSON.stringify({
                            sessionId: 'd38222',
                            location: 'offline-queue-processor.service.ts:CLOSE_ORDER',
                            message: 'closing server order',
                            data: {
                                tableId: action.tableId,
                                orderId: action.orderId,
                                timestamp: action.timestamp,
                            },
                            hypothesisId: 'H5-trysync-race',
                            runId: 'post-fix-v2',
                            timestamp: Date.now(),
                        }),
                    }).catch(() => {});
                    // #endregion
                    await firstValueFrom(
                        this.ordersService.closeOrder(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!,
                            QUEUE_HTTP_OPTS,
                        )
                    );
                    await this.offlineDB.deleteCart(action.tableId);
                    return true;
            }

            return true;

        } catch (err: any) {
            const status = err?.status ?? err?.error?.status ?? null;
            const errorMessage =
                err?.error?.errors?.[0]?.message
                ?? err?.error?.message
                ?? err?.message
                ?? '';
            if (status === 409) {
                const msg =
                    errorMessage
                    || 'This order is currently being paid by the client. Please wait for the payment to complete.';
                this.toast.info(msg, 'Order locked for payment');
                // keep action pending; we'll retry after payment completes
                return false;
            }

            if (
                action.type === 'NEW_ORDER'
                && /open order already exists/i.test(String(errorMessage))
            ) {
                const pendingClose = await this.hasPendingCloseForTable(action.restaurantId, action.tableId);
                if (pendingClose) {
                    // #region agent log
                    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
                        body: JSON.stringify({
                            sessionId: 'd38222',
                            location: 'offline-queue-processor.service.ts:processAction',
                            message: 'defer NEW_ORDER until pending CLOSE_ORDER runs',
                            data: {
                                restaurantId: action.restaurantId,
                                tableId: action.tableId,
                                orderId: action.orderId,
                                errorMessage,
                            },
                            hypothesisId: 'H4-queue-order',
                            runId: 'post-fix',
                            timestamp: Date.now(),
                        }),
                    }).catch(() => {});
                    // #endregion
                    return false;
                }

                // #region agent log
                fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
                    body: JSON.stringify({
                        sessionId: 'd38222',
                        location: 'offline-queue-processor.service.ts:processAction',
                        message: 'dropped stale NEW_ORDER (open order exists)',
                        data: {
                            restaurantId: action.restaurantId,
                            tableId: action.tableId,
                            orderId: action.orderId,
                            errorMessage,
                        },
                        hypothesisId: 'H4-queue-order',
                        runId: 'post-fix',
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                await this.offlineDB.deleteCart(action.tableId);
                await this.offlineDB.markActionDone(action.id!);
                return true;
            }

            console.error('[QUEUE] Error processing action:', err);
            await this.offlineDB.markActionError(action.id!);
            return false;
        }
    }

    async applyFinalOrderState(
        tableId: string,
        orderItems: (OrderItemDTO | null)[] | null | undefined,
        orderId: string
    ): Promise<void> {

        const safeItems = (orderItems ?? []).filter(
            (o): o is OrderItemDTO => o !== null
        );

        const { menuItems } = await this.offlineDB.loadMenu();
        const items: CartItem[] = safeItems.map(o => cartItemFromOrderLine(o, menuItems));
        await this.offlineDB.saveCart(tableId, items, orderId);
    }

    // -----------------------------------------------------
    // COMPRESIE: ADD + UPDATE + DELETE → stare finală
    // -----------------------------------------------------
    private async compressQueue(actions: OfflineAction[]): Promise<OfflineAction[]> {
        const perItem = new Map<string, OfflineAction[]>();
        const result: OfflineAction[] = [];

        for (const action of actions) {
            if (action.type === 'NEW_ORDER' || action.type === 'CLOSE_ORDER' || action.type === 'INIT_ORDER_ITEMS_FINAL') {
                result.push(action);
                continue;
            }

            const menuItemId = action.payload?.menuItemId;
            if (!menuItemId) {
                console.warn('[COMPRESS] Action without menuItemId → skip compression:', action.type);
                result.push(action);
                continue;
            }

            const key = `${action.orderId}-${menuItemId}`;
            if (!perItem.has(key)) perItem.set(key, []);
            perItem.get(key)!.push(action);
        }

        for (const ops of perItem.values()) {
            let state: { type: string; quantity?: number; orderItemId?: string | null } | null = null;

            for (const op of ops) {
                switch (op.type) {
                    case 'ADD_ITEM':
                        // Item nou pe backend → nu avem orderItemId încă
                        state = { type: 'ADD_ITEM', quantity: op.payload.quantity, orderItemId: null };
                        break;

                    case 'UPDATE_QUANTITY':
                        if (state?.type === 'ADD_ITEM') {
                            // ADD urmat de UPDATE → rămâne ADD cu cantitatea finală
                            state = { type: 'ADD_ITEM', quantity: op.payload.quantity, orderItemId: null };
                        } else {
                            // UPDATE pur → avem orderItemId real
                            state = { type: 'UPDATE_QUANTITY', quantity: op.payload.quantity, orderItemId: op.payload.orderItemId };
                        }
                        break;

                    case 'DELETE_ITEM':
                        if (state?.type === 'ADD_ITEM') {
                            // ADD urmat de DELETE → anulăm totul
                            state = null;
                        } else {
                            state = { type: 'DELETE_ITEM', orderItemId: op.payload.orderItemId };
                        }
                        break;
                }
            }

            if (state) {
                const base = ops[0];
                result.push({
                    ...base,
                    type: state.type as OfflineAction['type'],
                    payload: {
                        ...base.payload,
                        quantity: state.quantity,
                        orderItemId: state.orderItemId ?? base.payload.orderItemId
                    }
                });
            }
        }

        return result;
    }
}
