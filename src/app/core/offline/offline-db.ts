import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Subject } from 'rxjs';
import { OrderDTO, OrderItemDTO, TableCart } from '../../core/models/orderingModel';
import { MenuItem } from '../models/menu/menuItem';
import { Currency, TableDTO } from '../models/restaurantTablesModel';
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

interface TableStatusRow {
    tableId: string;
    available: boolean;
}

interface TableEntity extends TableDTO { }

class OfflineDB extends Dexie {
    carts!: Table<CartRecord, string>;
    queue!: Table<OfflineAction, number>;
    menuItems!: Table<MenuItemEntity, string>;
    tablesStatus!: Table<TableStatusRow, string>;
    tablesStore!: Table<TableEntity, string>;

    constructor() {
        super('OfflineOrdersDB');

        this.version(8).stores({
            menuItems: 'menuItemId',
            carts: '&tableId, orderId',
            queue: '++id, status, tableId, type, orderId, restaurantId, timestamp',
            tablesStatus: '&tableId',
            tablesStore: '&tableId',
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

    /**
     * UI guideline: components should reflect IndexedDB (Dexie).
     * Emit on mutations so UIs can re-load from Dexie.
     */
    private cartsChangedSubject = new Subject<{ tableId: string }>();
    readonly cartsChanged$ = this.cartsChangedSubject.asObservable();

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

        this.cartsChangedSubject.next({ tableId });
    }

    async loadCart(tableId: string): Promise<TableCart[string]> {
        const record = await this.db.carts.get(tableId);
        return record?.items ?? [];
    }

    async loadCartRecord(tableId: string): Promise<CartRecord | null> {
        if (!tableId) return null;
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
        this.cartsChangedSubject.next({ tableId });
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

    /**
     * Apply an authoritative snapshot from backend (/api/sync).
     * Server state wins; local offline queue will be replayed separately.
     */
    async applySyncSnapshot(tables: TableDTO[]): Promise<void> {
        console.log('[SYNC][DB] apply snapshot', { tablesCount: tables?.length ?? 0 });
        await this.saveTables(tables);
        const availability = this.buildAvailabilityMapFromTables(tables);
        await this.saveTablesStatus(availability);

        const openOrderTableIds = new Set<string>();

        for (const t of tables ?? []) {
            if (!t?.tableId) continue;
            const order = (t as any).order as OrderDTO | undefined;
            if (order?.orderId && order?.isOrderOpen) {
                openOrderTableIds.add(t.tableId);
                await this.saveOrderSnapshot(t.tableId, order);
            } else {
                // If server says it's open/no order, delete local cart snapshot *unless*
                // we have a locally confirmed order that hasn't been reconciled yet.
                const local = await this.loadCartRecord(t.tableId);
                const localOrderId = local?.orderId;
                const hasLocalUnconfirmed = !!localOrderId && localOrderId.startsWith('local-');
                const hasPendingForTable = await this.hasPendingActionsForTable(t.tableId);

                if (hasLocalUnconfirmed || hasPendingForTable) {
                    continue;
                }

                await this.deleteCart(t.tableId);
            }
        }
    }

    private async hasPendingActionsForTable(tableId: string): Promise<boolean> {
        if (!tableId) return false;
        const count = await this.db.queue
            .where('tableId')
            .equals(tableId)
            .and(a => a.status === 'pending')
            .count();

        return count > 0;
    }

    private buildAvailabilityMapFromTables(tables: TableDTO[] | null | undefined): Record<string, boolean> {
        const map: Record<string, boolean> = {};
        if (!Array.isArray(tables)) return map;
        for (const t of tables) {
            if (!t?.tableId) continue;
            const hasOrder = !!(t as any).order;
            map[t.tableId] = !!t.isTableOpen && !hasOrder;
        }
        return map;
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

    // metode adiționale pentru tablesStatus
    async saveTablesStatus(map: Record<string, boolean>): Promise<void> {
        const rows = Object.keys(map).map(tableId => ({
            tableId,
            available: !!map[tableId]
        }));

        await this.db.transaction('rw', this.db.tablesStatus, async () => {
            // curățăm toate intrările și scriem noile statusuri
            await this.db.tablesStatus.clear();
            if (rows.length) {
                // bulkPut folosește PK (tableId) pentru upsert
                await this.db.tablesStatus.bulkPut(rows);
            }
        });
    }

    // Încarcă map-ul complet din Dexie
    async loadTablesStatusMap(): Promise<Record<string, boolean>> {
        const map: Record<string, boolean> = {};
        const rows = await this.db.tablesStatus.toArray();
        for (const r of rows) {
            map[r.tableId] = !!r.available;
        }
        return map;
    }

    // Upsert pentru o singură masă (efficient pentru SSE)
    async upsertTableStatus(tableId: string, available: boolean): Promise<void> {
        // put/ bulkPut folosește tableId ca PK (Variantă B)
        await this.db.tablesStatus.put({ tableId, available });
    }

    // saveTables
    async saveTables(tables: TableDTO[]): Promise<void> {
        const rows = tables.map(t => ({ ...t }));
        await this.db.transaction('rw', this.db.tablesStore, async () => {
            await this.db.tablesStore.clear();
            if (rows.length) await this.db.tablesStore.bulkPut(rows);
        });
    }

    // loadLocalTables
    async loadLocalTables(): Promise<TableDTO[]> {
        const rows = await this.db.tablesStore.toArray();
        return rows as TableDTO[];
    }

}
