import type { CashbookParty } from '../types/cashbook';
import type { Product, Customer, Category } from '../types';
import { MAX_MONEY_MINOR, MAX_QUANTITY_SCALED } from '../domain/financial';
import { openWebDb } from './web_cashbook_db';
export type Catalog = {
    products: Product[];
    customers: Customer[];
    categories: Category[];
    stock_movements: StockMovement[];
    cashbook_parties: CashbookParty[];
};
export interface StockMovement {
    id: string;
    product_id: string;
    reference_type: string;
    reference_id: string | null;
    quantity_delta_scaled: number;
    resulting_stock_scaled: number;
    notes: string | null;
    created_at: number;
}
const stores = ['products', 'customers', 'categories', 'stock_movements', 'cashbook_parties'] as const;
/** Run synchronous catalog mutations inside one serialized IndexedDB transaction.
 * Resolve only after commit; a failed write must never look like a saved record.
 */
export async function withWebCatalog<T>(operation: (catalog: Catalog) => T, write = true): Promise<T> {
    const db = await openWebDb();
    if (!db)
        throw new Error('Durable browser storage is unavailable. Catalog was not saved.');
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction([...stores], write ? 'readwrite' : 'readonly');
        const catalog = {} as Catalog;
        let pending = stores.length;
        let result: T;
        let failure: unknown;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('Catalog transaction failed'));
        for (const name of stores) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => {
                (catalog[name] as unknown[]) = request.result;
                if (--pending)
                    return;
                try {
                    result = operation(catalog);
                    if (!write)
                        return;
                    validateCatalog(catalog);
                    for (const storeName of stores) {
                        const store = tx.objectStore(storeName);
                        store.clear();
                        for (const row of catalog[storeName])
                            store.put(row);
                    }
                }
                catch (error) {
                    failure = error;
                    tx.abort();
                }
            };
        }
    });
}
export function validateCatalog(catalog: Catalog): void {
    const unique = (values: string[], label: string) => {
        if (new Set(values).size !== values.length)
            throw new Error(`Duplicate ${label}`);
    };
    unique(catalog.categories.map(c => c.name.trim().toLowerCase()), 'category');
    unique(catalog.products.map(p => p.sku.trim().toUpperCase()), 'SKU');
    unique(catalog.products.map(p => p.barcode).filter((s): s is string => Boolean(s)), 'barcode');
    const categoryIds = new Set(catalog.categories.map(c => c.id));
    for (const row of [...catalog.categories, ...catalog.customers, ...catalog.products]) {
        if (!row.name.trim())
            throw new Error('Name is required');
    }
    for (const product of catalog.products) {
        if (!product.sku.trim())
            throw new Error('SKU is required');
        if (product.category_id && !categoryIds.has(product.category_id))
            throw new Error('Category not found');
        for (const value of [product.unit_price_minor, product.cost_price_minor, product.tax_rate_bp, product.current_stock_scaled, product.min_stock_threshold_scaled]) {
            if (!Number.isSafeInteger(value) || value < 0)
                throw new Error('Invalid catalog amount or quantity');
        }
        if (product.unit_price_minor > MAX_MONEY_MINOR || product.cost_price_minor > MAX_MONEY_MINOR || product.current_stock_scaled > MAX_QUANTITY_SCALED || product.min_stock_threshold_scaled > MAX_QUANTITY_SCALED)
            throw new Error('Catalog value exceeds maximum');
        if (product.sku.length > 64 || (product.barcode && (product.barcode.length > 64 || /[\x00-\x1f\x7f]/.test(product.barcode))))
            throw new Error('Invalid SKU or barcode');
        if (product.tax_rate_bp > 10000)
            throw new Error('Invalid tax rate');
    }
}
