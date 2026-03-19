import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { TableCart } from '../../core/models/orderingModel';

export interface CartRecord {
    tableId: string;
    items: TableCart[string];
}

export interface OfflineAction {
    id?: number;
    restaurantId: string;
    type: 'ADD_ITEM' | 'UPDATE_QUANTITY' | 'DELETE_ITEM' | 'CLOSE_ORDER';
    tableId: string;
    orderId?: string;
    payload: any;
    timestamp: number;
    status: 'pending' | 'processing' | 'done' | 'error';
}


class OfflineDB extends Dexie {
    carts!: Table<CartRecord, string>;
    queue!: Table<OfflineAction, number>;

    constructor() {
        super('OfflineOrdersDB');

        this.version(2).stores({
            carts: '&tableId',
            queue: '++id, status, tableId'
        });
    }
}

@Injectable({
    providedIn: 'root'
})
export class OfflineDbService {
    private db = new OfflineDB();

    // -------------------------------
    // CART CRUD
    // -------------------------------

    async saveCart(tableId: string, items: TableCart[string]): Promise<void> {
        await this.db.carts.put({ tableId, items });
    }

    async loadAllCarts(): Promise<Record<string, TableCart[string]>> {
        const result: Record<string, TableCart[string]> = {};
        const records = await this.db.carts.toArray();

        for (const rec of records) {
            result[rec.tableId] = rec.items;
        }

        return result;
    }

    async deleteCart(tableId: string): Promise<void> {
        await this.db.carts.delete(tableId);
    }

    async clearAllCarts(): Promise<void> {
        await this.db.carts.clear();
    }

    async addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'status'>) {
        console.log('[DB] Queuing action:', action);
        await this.db.queue.add({
            ...action,
            timestamp: Date.now(),
            status: 'pending'
        });
    }

    async getPendingActions(): Promise<OfflineAction[]> {
        return this.db.queue.where('status').equals('pending').toArray();
    }

    async markActionDone(id: number) {
        await this.db.queue.delete(id);
    }

    async markActionError(id: number) {
        await this.db.queue.update(id, { status: 'error' });
    }

    async deleteActionsForOrder(orderId: string): Promise<void> {
        const actions = await this.db.queue.toArray();
        for (const a of actions) {
            if (a.orderId === orderId) {
                await this.db.queue.delete(a.id!);
            }
        }
    }
}
