import { Injectable } from "@angular/core";
import { OrdersService } from "../services/order-service/orders.service";
import { OfflineAction, OfflineDbService } from "./offline-db";
import { debounceTime, distinctUntilChanged, filter, firstValueFrom, Subject } from "rxjs";
import { CartItem, OrderItemDTO, cartItemFromOrderLine } from "../models/orderingModel";
import { OnlineStateService } from "./online-state-service";
import { AuthService } from "../auth/auth.service";
import { AppToastService } from "../services/toast-service/toast-service.service";

@Injectable({ providedIn: 'root' })
export class OfflineQueueProcessor {
    private processing = false;
    private trigger$ = new Subject<void>();
    readonly orderConfirmed$ = new Subject<{ tableId: string; orderId: string }>();


    constructor(
        private offlineDB: OfflineDbService,
        private ordersService: OrdersService,
        private onlineStateService: OnlineStateService,
        private authService: AuthService,
        private toast: AppToastService
    ) {
        this.authService.loggedIn$
            .subscribe(async () => {
                await this.recoverOrphanedCarts(); 
                this.triggerProcessing();
            });

        this.trigger$
            .pipe(
                debounceTime(350)
            )
            .subscribe(() => this.processQueue());

        this.onlineStateService.online$
            .pipe(
                filter(isOnline => isOnline),
                debounceTime(500) // lasă interceptorul să se stabilizeze
            )
            .subscribe(async () => {
                await this.recoverOrphanedCarts();
                this.processQueue();
            });
    }

    triggerProcessing() {
        this.trigger$.next();
    }

    private async recoverOrphanedCarts(): Promise<void> {
        const allCarts = await this.offlineDB.carts.toArray();
        const allActions = await this.offlineDB.queue.toArray();

        for (const cart of allCarts) {
            if (!cart.orderId?.startsWith('local-')) continue;

            const hasAction = allActions.some(a => a.orderId === cart.orderId);
            if (hasAction) continue;

            // Găsim restaurantId din orice acțiune pentru același tableId
            const ref = allActions.find(a => a.tableId === cart.tableId);

            // Fallback: din AuthService direct
            const restaurantId = ref?.restaurantId
                ?? this.authService.getUserSnapshot()?.restaurantId;

            if (!restaurantId) {
                console.warn('[RECOVERY] Cannot recover cart, no restaurantId:', cart.tableId);
                continue;
            }

            console.warn('[RECOVERY] Re-queuing orphaned cart:', cart.tableId);

            await this.offlineDB.addOfflineAction({
                type: 'NEW_ORDER',
                restaurantId,
                tableId: cart.tableId,
                orderId: cart.orderId,
                payload: { seatId: null }
            });

            await this.offlineDB.addOfflineAction({
                type: 'INIT_ORDER_ITEMS_FINAL',
                restaurantId,
                tableId: cart.tableId,
                orderId: cart.orderId,
                payload: {
                    items: cart.items.map(ci => ({
                        menuItemId: ci.item.menuItemId,
                        quantity: ci.quantity
                    }))
                }
            });
        }
    }

    async processQueue() {
        if (this.processing) return;
        if (!this.onlineStateService.isOnline) return;

        this.processing = true;

        try {
            let pending = await this.offlineDB.getPendingActions();
            const compressed = await this.compressQueue(pending);
            await this.offlineDB.replaceActions(compressed);

            const actions = compressed.sort((a, b) =>
                this.getActionOrder(a.type) - this.getActionOrder(b.type)
            );

            for (const action of actions) {
                const ok = await this.processAction(action);

                if (!ok) break;

                await this.offlineDB.markActionDone(action.id!);

                // ← FIX: după NEW_ORDER, Dexie are orderId-urile reale
                // dar array-ul din memorie nu. Restart cu date proaspete.
                if (action.type === 'NEW_ORDER' || action.type === 'INIT_ORDER_ITEMS_FINAL') {
                    this.triggerProcessing(); // debounced 350ms
                    return; // finally → processing = false
                }
            }

        } finally {
            this.processing = false;
        }
    }

    private getActionOrder(type: string): number {
        switch (type) {
            case 'NEW_ORDER': return 1;
            case 'INIT_ORDER_ITEMS_FINAL': return 2;
            case 'ADD_ITEM':
            case 'UPDATE_QUANTITY':
            case 'DELETE_ITEM': return 3;
            case 'CLOSE_ORDER': return 4;
            default: return 99;
        }
    }


    async processAction(action: OfflineAction): Promise<boolean> {
        // 1. Dacă acțiunea NU este NEW_ORDER și orderId este local → așteptăm NEW_ORDER
        if (action.type !== 'NEW_ORDER' && action.orderId?.startsWith('local-')) {
            return true;
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
                    // 1. creăm order real
                    const res = await firstValueFrom(
                        this.ordersService.newOrder(
                            action.restaurantId,
                            action.tableId,
                            action.payload.seatId ?? undefined
                        )
                    );

                    const realOrderId = res.order.orderId;

                    // 2. înlocuim orderId local cu cel real
                    await this.offlineDB.replaceOrderId(action.orderId!, realOrderId);

                    const record = await this.offlineDB.loadCartRecord(action.tableId);
                    if (record) {
                        await this.offlineDB.saveCart(action.tableId, record.items, realOrderId);
                    }

                    // 3. reconstruim starea finală a cart-ului
                    const finalCart = await this.offlineDB.loadCart(action.tableId);

                    // 4. trimitem toate itemele la backend
                    const finalRes = await firstValueFrom(
                        this.ordersService.updateOrderItem(
                            action.restaurantId,
                            action.tableId,
                            realOrderId,
                            {
                                orderItems: finalCart.map(ci => ({
                                    menuItemId: ci.item.menuItemId,
                                    quantity: ci.quantity
                                })),
                                seatId: null
                            }
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
                            }
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
                            action.payload.quantity
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
                                action.payload.quantity
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
                            action.payload.quantity
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
                            action.payload.orderItemId
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
                    await firstValueFrom(
                        this.ordersService.closeOrder(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!
                        )
                    );
                    await this.offlineDB.deleteCart(action.tableId);
                    return true;
            }

            return true;

        } catch (err: any) {
            const status = err?.status ?? err?.error?.status ?? null;
            if (status === 409) {
                const msg =
                    err?.error?.errors?.[0]?.message
                    ?? err?.error?.message
                    ?? 'This order is currently being paid by the client. Please wait for the payment to complete.';
                this.toast.info(msg, 'Order locked for payment');
                // keep action pending; we'll retry after payment completes
                return false;
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
