import { Injectable } from "@angular/core";
import { OrdersService } from "../services/order-service/orders.service";
import { OfflineAction, OfflineDbService } from "./offline-db";
import { firstValueFrom } from "rxjs";
import { CartItem, OrderItemDTO } from "../models/orderingModel";
import { MiscellaneousService } from "../services/misc/miscellaneous.service";


@Injectable({ providedIn: 'root' })
export class OfflineQueueProcessor {
    private processing = false;

    constructor(
        private offlineDB: OfflineDbService,
        private ordersService: OrdersService,
        private miscService: MiscellaneousService
    ) { }

    async processQueue() {
        console.log('%c[QUEUE] Processing queue...', 'color: blue; font-weight: bold;');
        // debounce pentru false-positive offline
        await new Promise(res => setTimeout(res, 500));


        if (this.processing) return;
        this.processing = true;

        try {
            let actions = await this.offlineDB.getPendingActions();
            if (!actions.length) return;

            // compresie înainte de sortare
            console.log('[QUEUE] Raw actions:', actions);
            actions = await this.compressQueue(actions);
            console.log('[QUEUE] After compression:', actions);

            actions = actions.sort((a, b) =>
                this.getActionOrder(a.type) - this.getActionOrder(b.type)
            );

            for (const action of actions) {
                const ok = await this.processAction(action);
                if (!ok) {
                    console.warn('[QUEUE] Stopping queue due to failure');
                    return;
                }
            }
        } finally {
            this.processing = false;
        }
    }

    private async getMenuItem(menuItemId: string) {
        return await this.offlineDB.menuItems.get(menuItemId);
    }

    private async foldActionsForOrder(orderId: string): Promise<any[]> {
        const actions = await this.offlineDB.getPendingActions();
        const related = actions.filter(a => a.orderId === orderId);

        if (!related.length) return [];

        const tableId = related[0].tableId;

        // Starea finală este deja în Dexie
        return await this.offlineDB.loadCart(tableId);
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

    private async processAction(action: OfflineAction): Promise<boolean> {
        console.log('[QUEUE] Processing action:', action);
        // 1. Dacă acțiunea NU este NEW_ORDER și orderId este local → o sărim
        if (action.type !== 'NEW_ORDER' && action.orderId?.startsWith('local-')) {
            console.log('[QUEUE] Waiting for real orderId → skip:', action.type);
            return true;
        }
        // 2. Dacă suntem offline → nu procesăm nimic
        if (!navigator.onLine) {
            console.log(`[QUEUE] Offline → skip ${action.type}`);
            return true; // IMPORTANT: nu blocăm coada
        }

        try {
            switch (action.type) {
                case 'NEW_ORDER': {
                    console.log('[QUEUE] NEW_ORDER → calling backend newOrder()');
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
                    console.log('[QUEUE] Replacing local orderId', action.orderId, '→', realOrderId);
                    await this.offlineDB.replaceOrderId(action.orderId!, realOrderId);

                    // 3. reconstruim starea finală a cart-ului
                    const finalCart = await this.foldActionsForOrder(realOrderId);

                    console.log('[QUEUE] Final cart after fold:', finalCart);

                    // 4. trimitem INIT_ORDER_ITEMS_FINAL
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
                    await this.applyFinalOrderState(action.tableId, finalRes.orderItems);

                    // 6. marcăm NEW_ORDER ca done
                    await this.offlineDB.markActionDone(action.id!);

                    // 7. repornim coada
                    this.processing = false;
                    setTimeout(() => this.processQueue(), 0);

                    return true;
                }

                case 'ADD_ITEM':
                case 'UPDATE_QUANTITY':
                case 'DELETE_ITEM':
                    // aceste acțiuni sunt doar intenții → nu se trimit direct la backend
                    await this.offlineDB.markActionDone(action.id!);
                    return true;

                case 'CLOSE_ORDER':
                    await firstValueFrom(
                        this.ordersService.closeOrder(
                            action.restaurantId,
                            action.tableId,
                            action.orderId!
                        )
                    );
                    await this.offlineDB.deleteCart(action.tableId);
                    await this.offlineDB.markActionDone(action.id!);
                    console.log('[QUEUE] CLOSE_ORDER done');
                    return true;
            }

            return true;

        } catch (err) {
            console.error('Offline action failed', err);
            await this.offlineDB.markActionError(action.id!);
            return false;
        }
    }

    async applyFinalOrderState(
        tableId: string,
        orderItems: (OrderItemDTO | null)[] | null | undefined
    ): Promise<void> {

        // 1. fallback sigur
        const safeItems = (orderItems ?? []).filter(
            (o): o is OrderItemDTO => o !== null
        );

        // 2. mapăm în CartItem[]
        const items: CartItem[] = safeItems.map(o => ({
            item: {
                menuItemId: o.menuItemId,
                menuItemName: o.orderItemName,
                menuItemDescription: o.orderItemDescription,
                menuItemPriceAmount: o.orderItemPriceAmount ?? 0,
                menuItemPriceCurrency: o.orderItemPriceCurrency,
                menuItemIconUrl: undefined, // backend nu trimite icon aici
                category: o.category
            },
            quantity: o.quantity,
            orderItemId: o.orderItemId
        }));

        // 3. salvăm în Dexie
        await this.offlineDB.saveCart(tableId, items);
    }




    private async compressQueue(actions: OfflineAction[]): Promise<OfflineAction[]> {
        const perItem = new Map<string, OfflineAction[]>();
        const result: OfflineAction[] = [];

        // 1. Separăm acțiunile "de control" de cele pe item
        for (const action of actions) {
            if (action.type === 'NEW_ORDER' || action.type === 'CLOSE_ORDER') {
                // le păstrăm exact cum sunt, în ordinea lor
                result.push(action);
                continue;
            }

            // defensiv: dacă nu avem menuItemId, nu putem comprima
            const menuItemId = action.payload?.menuItemId;
            if (!menuItemId) {
                result.push(action);
                continue;
            }

            const key = `${action.orderId}-${menuItemId}`;
            if (!perItem.has(key)) perItem.set(key, []);
            perItem.get(key)!.push(action);
        }

        type CompressedState =
            | { type: 'ADD_ITEM'; quantity: number }
            | { type: 'UPDATE_QUANTITY'; quantity: number }
            | { type: 'DELETE_ITEM' };

        // 2. Comprimăm per item
        for (const ops of perItem.values()) {
            let state: CompressedState | null = null;

            for (const op of ops) {
                switch (op.type) {
                    case 'ADD_ITEM':
                        state = { type: 'ADD_ITEM', quantity: op.payload.quantity };
                        break;

                    case 'UPDATE_QUANTITY':
                        if (state && 'quantity' in state) {
                            state.quantity = op.payload.quantity;
                        } else {
                            state = { type: 'UPDATE_QUANTITY', quantity: op.payload.quantity };
                        }
                        break;

                    case 'DELETE_ITEM':
                        state = { type: 'DELETE_ITEM' };
                        break;
                }
            }

            if (state) {
                const base = ops[0];

                if (state.type === 'DELETE_ITEM') {
                    result.push({
                        ...base,
                        type: 'DELETE_ITEM',
                        payload: {
                            menuItemId: base.payload.menuItemId
                        }
                    });
                } else {
                    result.push({
                        ...base,
                        type: state.type,
                        payload: {
                            menuItemId: base.payload.menuItemId,
                            quantity: state.quantity
                        }
                    });
                }
            }
        }

        return result;
    }





}
