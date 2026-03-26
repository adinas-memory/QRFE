import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { TableCart } from '../../core/models/orderingModel';
import { MenuItem } from '../models/menu/menuItem';
export interface MenuItemEntity extends MenuItem { }

export interface CartRecord {
    tableId: string;
    orderId?: string;
    items: TableCart[string];
}

export interface OfflineAction {
    id?: number;
    restaurantId: string;
    type: 'NEW_ORDER' | 'ADD_ITEM' | 'UPDATE_QUANTITY' | 'DELETE_ITEM' | 'CLOSE_ORDER' | 'INIT_ORDER_ITEMS_FINAL';
    tableId: string;
    orderId?: string;
    payload: any;
    timestamp: number;
    status: 'pending' | 'processing' | 'done' | 'error';
}


class OfflineDB extends Dexie {
    carts!: Table<CartRecord, string>;
    queue!: Table<OfflineAction, number>;
    menuItems!: Table<MenuItemEntity, string>;

    constructor() {
        super('OfflineOrdersDB');

        this.version(5).stores({
            menuItems: 'menuItemId',
            carts: '&tableId, orderId',
            queue: '++id, status, tableId, type, orderId, restaurantId, timestamp'
        });
    }
}

@Injectable({
    providedIn: 'root'
})
export class OfflineDbService {
    private db = new OfflineDB();

    // expunem tabelele
    menuItems: Table<MenuItemEntity, string> = this.db.menuItems;
    carts = this.db.carts;
    queue = this.db.queue;

    // expunem tranzacțiile
    transaction = this.db.transaction.bind(this.db);

    // -------------------------------
    // CART CRUD
    // -------------------------------

    async saveCart(tableId: string, items: TableCart[string], orderId?: string): Promise<void> {
        await this.db.carts.put({ tableId, items, orderId });
    }

    async loadCart(tableId: string): Promise<TableCart[string]> {
        const record = await this.db.carts.get(tableId);
        return record?.items ?? [];
    }

    async loadCartRecord(tableId: string): Promise<CartRecord | null> {
        return await this.db.carts.get(tableId) ?? null;
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
                console.log('[DB] deleteActionsForOrder:', orderId);
                await this.db.queue.delete(a.id!);
            }
        }
    }

    async replaceOrderId(oldId: string, newId: string): Promise<void> {
        const actions = await this.db.queue.toArray();

        for (const a of actions) {
            if (a.orderId === oldId) {
                console.log('[DB] replaceOrderId:', oldId, '→', newId);
                await this.db.queue.update(a.id!, { orderId: newId });
            }
        }
    }

    async addToCart(tableId: string, menuItem: MenuItemEntity, quantity: number = 1) {
        const record = await this.loadCartRecord(tableId);

        const items = record?.items ?? [];

        const existing = items.find(i => i.item.menuItemId === menuItem.menuItemId);

        if (existing) {
            existing.quantity += quantity;
        } else {
            items.push({
                item: menuItem,
                quantity
            });
        }

        await this.saveCart(tableId, items, record?.orderId);
    }

    async updateQuantity(tableId: string, menuItemId: string, quantity: number) {
        const record = await this.loadCartRecord(tableId);
        if (!record) return;

        const items = record.items.map(i =>
            i.item.menuItemId === menuItemId ? { ...i, quantity } : i
        );

        await this.saveCart(tableId, items, record.orderId);
    }

    async removeItem(tableId: string, menuItemId: string) {
        const record = await this.loadCartRecord(tableId);
        if (!record) return;

        const items = record.items.filter(i => i.item.menuItemId !== menuItemId);

        await this.saveCart(tableId, items, record.orderId);
    }


    async cacheMenu(menuItems: MenuItem[]): Promise<void> {
        await this.db.transaction('rw', this.menuItems, async () => {
            await this.menuItems.clear();
            await this.menuItems.bulkAdd(menuItems);
        });
    }

    async loadMenu(): Promise<{ menuItems: MenuItem[], categories: string[] }> {
        const menuItems = await this.menuItems.toArray();
        const categories = [...new Set(menuItems.map(i => i.category))];
        return { menuItems, categories };
    }


}
