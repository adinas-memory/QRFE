import { Injectable } from "@angular/core";
import { OrdersService } from "../services/order-service/orders.service";
import { OfflineAction, OfflineDbService } from "./offline-db";
import { firstValueFrom } from "rxjs";

@Injectable({ providedIn: 'root' })
export class OfflineQueueProcessor {
    private processing = false;

    constructor(
        private offlineDB: OfflineDbService,
        private ordersService: OrdersService
    ) { }

    async processQueue() {
        console.log('%c[QUEUE] Processing queue...', 'color: blue; font-weight: bold;');
        // debounce pentru false-positive offline
        await new Promise(res => setTimeout(res, 500));
        
        if (!navigator.onLine) {
            console.log('[QUEUE] Offline → skip processing');
            return;
        }

        if (this.processing) return;
        this.processing = true;

        try {
            let actions = await this.offlineDB.getPendingActions();
            if (!actions.length) return;

            // compresie înainte de sortare
            actions = await this.compressQueue(actions);

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

    private getMenuItemFromSnapshot(menuItemId: string) {
        const snapshotRaw = localStorage.getItem('menuSnapshot');
        if (!snapshotRaw) return null;

        const snapshot = JSON.parse(snapshotRaw);
        return snapshot.menuItems.find((m: any) => m.menuItemId === menuItemId) ?? null;
    }

    private async foldActionsForOrder(orderId: string): Promise<any[]> {
        // 1. găsim tableId din acțiuni
        const actions = await this.offlineDB.getPendingActions();
        const related = actions.filter(a => a.orderId === orderId);

        if (!related.length) return [];

        const tableId = related[0].tableId;

        // 2. cart-ul actual din Dexie
        let cart = await this.offlineDB.loadCart(tableId);

        // 3. aplicăm acțiunile peste cart
        for (const a of related) {
            switch (a.type) {
                case 'ADD_ITEM': {
                    const menuItem = this.getMenuItemFromSnapshot(a.payload.menuItemId);
                    console.error('[OfflineQueue] MenuItem not found in snapshot:', a.payload.menuItemId);
                    if (!menuItem) continue;

                    cart.push({
                        item: menuItem,
                        quantity: a.payload.quantity,
                        orderItemId: undefined
                    });
                    break;
                }

                case 'UPDATE_QUANTITY': {
                    const item = cart.find(i => i.item.menuItemId === a.payload.menuItemId);
                    if (item) item.quantity = a.payload.quantity;
                    break;
                }

                case 'DELETE_ITEM': {
                    cart = cart.filter(i => i.item.menuItemId !== a.payload.menuItemId);
                    break;
                }
            }
        }

        return cart;
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

                    // 3. reconstruim starea finală a cart-ului
                    const finalCart = await this.foldActionsForOrder(realOrderId);

                    console.log('[QUEUE] Final cart after fold:', finalCart);

                    // 4. trimitem INIT_ORDER_ITEMS_FINAL
                    await firstValueFrom(
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

                    // 5. ștergem toate acțiunile pentru acest order
                    await this.offlineDB.deleteActionsForOrder(action.orderId!);

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



    private async compressQueue(actions: OfflineAction[]): Promise<OfflineAction[]> {
        const map = new Map<string, OfflineAction>();

        for (const action of actions) {
            if (action.type === 'UPDATE_QUANTITY') {
                const key = `${action.orderId}-${action.payload.orderItemId}`;
                map.set(key, action); // suprascrie acțiunile anterioare
            } else {
                // ADD_ITEM și DELETE_ITEM nu se pot comprima
                const key = `${action.id}`;
                map.set(key, action);
            }
        }

        return Array.from(map.values());
    }

}
