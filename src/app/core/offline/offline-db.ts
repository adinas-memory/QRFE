import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { OrderDTO, OrderItemDTO, TableCart } from '../../core/models/orderingModel';
import { MenuItem } from '../models/menu/menuItem';
import { Currency } from '../models/restaurantTablesModel';
export interface MenuItemEntity extends MenuItem { }

export interface CartRecord {
    tableId: string;
    orderId?: string;
    restaurantId?: string;
    items: TableCart[string];
}

export interface OfflineAction {
    id?: number;
    restaurantId: string;
    type: 'NEW_ORDER' | 'ADD_ITEM' | 'UPDATE_ORDER' | 'UPDATE_QUANTITY' | 'DELETE_ITEM' | 'CLOSE_ORDER' | 'INIT_ORDER_ITEMS_FINAL';
    tableId: string;
    orderId?: string;
    payload: any;
    timestamp: number;
    status: 'pending' | 'processing' | 'done' | 'error';
    retryCount?: number;
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

    async saveCart(
        tableId: string,
        items: TableCart[string],
        orderId?: string,
        allowEmpty: boolean = false  // ← nou
    ): Promise<void> {
        const existing = await this.db.carts.get(tableId);

        await this.db.carts.put({
            tableId,
            items: (allowEmpty || items.length) ? items : existing?.items ?? [],
            orderId: orderId ?? existing?.orderId
        });
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
        const actions = await this.db.queue.where('status').equals('pending').toArray();
        console.log('[DB] Pending actions:', actions);
        return actions;
    }

    async replaceActions(newActions: OfflineAction[]): Promise<void> {
        await this.db.transaction('rw', this.db.queue, async () => {
            await this.db.queue.clear();
            await this.db.queue.bulkAdd(newActions);
        });
    }

    async markActionDone(id: number) {
        await this.db.queue.delete(id);
    }

    async markActionError(id: number) {
        const action = await this.db.queue.get(id);
        const retries = (action?.retryCount ?? 0) + 1;

        if (retries >= 3) {
            console.warn('[DB] Action failed 3 times → deleting:', action?.type);
            await this.db.queue.delete(id);
        } else {
            await this.db.queue.update(id, {
                status: 'pending',  // ← retry, nu error permanent
                retryCount: retries
            });
        }
        // await this.db.queue.update(id, { status: 'error' });
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

    async saveOrderSnapshot(tableId: string, order: OrderDTO): Promise<void> {
        const items = (order.orderItems ?? [])
            .filter((o): o is OrderItemDTO => o !== null)
            .map(o => ({
                item: {
                    menuItemId: o.menuItemId,
                    menuItemName: o.orderItemName,
                    menuItemDescription: o.orderItemDescription,
                    menuItemPriceAmount: o.orderItemPriceAmount ?? 0,
                    menuItemPriceCurrency: o.orderItemPriceCurrency,
                    menuItemIconUrl: undefined,
                    category: o.category
                },
                quantity: o.quantity,
                orderItemId: o.orderItemId
            }));

        await this.saveCart(tableId, items, order.orderId);
    }


    async loadOrder(tableId: string): Promise<OrderDTO | null> {
        const record = await this.loadCartRecord(tableId);
        if (!record || !record.orderId) return null;

        return {
            orderId: record.orderId,
            tableId,
            createdOn: new Date().toISOString(), // fallback
            isOrderOpen: true,
            currency: (record.items[0]?.item.menuItemPriceCurrency ?? 'EUR') as Currency,

            orderItems: record.items.map(i => ({
                orderItemId: i.orderItemId,
                menuItemId: i.item.menuItemId,
                orderItemName: i.item.menuItemName,
                orderItemDescription: i.item.menuItemDescription ?? '',
                orderItemPriceAmount: i.item.menuItemPriceAmount,
                orderItemPriceCurrency: i.item.menuItemPriceCurrency as Currency,
                category: i.item.category,
                quantity: i.quantity
            }))
        };
    }
}
