import { Injectable } from "@angular/core";
import { OrdersService } from "../services/order-service/orders.service";
import { OfflineAction, OfflineDbService } from "./offline-db";

@Injectable({ providedIn: 'root' })
export class OfflineQueueProcessor {
    private processing = false;

    constructor(
        private offlineDB: OfflineDbService,
        private ordersService: OrdersService
    ) { }

    async processQueue() {
        console.log('%c[QUEUE] Processing queue...', 'color: blue; font-weight: bold;');
        if (this.processing) return;
        this.processing = true;

        try {
            const actions = await this.offlineDB.getPendingActions();
            const compressed = await this.compressQueue(actions);

            for (const action of compressed) {
                console.log('[QUEUE] Processing action:', action);
                await this.processAction(action);
            }
        } finally {
            this.processing = false;
        }
    }

    private async processAction(action: OfflineAction) {
        try {
            switch (action.type) {
                case 'ADD_ITEM':
                    console.log('[QUEUE] Action completed:', action.type);
                    await this.ordersService.addOrderItem(
                        action.restaurantId!,
                        action.tableId,
                        action.orderId!,
                        action.payload.menuItemId,
                        action.payload.quantity
                    ).toPromise();
                    break;

                case 'UPDATE_QUANTITY':
                    console.log('[QUEUE] Action completed:', action.type);
                    await this.ordersService.updateOrderItemQuantity(
                        action.restaurantId!,
                        action.tableId,
                        action.orderId!,
                        action.payload.orderItemId,
                        action.payload.quantity
                    ).toPromise();
                    break;

                case 'DELETE_ITEM':
                    console.log('[QUEUE] Action completed:', action.type);
                    await this.ordersService.deleteOrderItem(
                        action.restaurantId!,
                        action.tableId,
                        action.orderId!,
                        action.payload.orderItemId
                    ).toPromise();
                    break;

                case 'CLOSE_ORDER':
                    console.log('[QUEUE] Action completed:', action.type);
                    await this.ordersService.closeOrder(
                        action.restaurantId,
                        action.tableId,
                        action.orderId!
                    ).toPromise();
                    break;
            }

            await this.offlineDB.markActionDone(action.id!);
        } catch (err) {
            console.error('Offline action failed', err);
            await this.offlineDB.markActionError(action.id!);
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
