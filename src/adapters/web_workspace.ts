import { openWebDb, MAX_MONEY_MINOR, MAX_TOTAL_MINOR } from './web_cashbook_db';
import { validateCatalog } from './web_catalog';
import type { WorkspaceBackupEnvelope } from '../types/backup';
export const workspaceTables = ['business_settings', 'categories', 'category_merges', 'products', 'customers', 'stock_movements', 'money_accounts', 'cashbook_categories', 'cashbook_parties', 'cashbook_sequences', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_audit_events'] as const;
const unsupported = ['invoice_sequences', 'invoice_items', 'invoices', 'payments', 'payment_allocations', 'expenses'] as const;
type Tables = Record<string, any[]>;
/** One transaction/snapshot across the workspace. Callbacks must be synchronous. */
export async function workspaceTransaction<T>(write: boolean, run: (tables: Tables) => T): Promise<T> {
    const db = await openWebDb();
    if (!db)
        throw Error('Durable browser storage unavailable');
    return new Promise((resolve, reject) => {
        const tx = db.transaction([...workspaceTables], write ? 'readwrite' : 'readonly');
        const tables: Tables = {};
        let pending = workspaceTables.length;
        let result: T;
        let error: unknown;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(error || tx.error || Error('Workspace transaction aborted'));
        for (const name of workspaceTables) {
            const req = tx.objectStore(name).getAll();
            req.onsuccess = () => {
                tables[name] = req.result;
                if (--pending)
                    return;
                try {
                    result = run(tables);
                    if (write)
                        for (const key of workspaceTables) {
                            const store = tx.objectStore(key);
                            store.clear();
                            for (const row of tables[key])
                                store.add(row);
                        }
                }
                catch (e) {
                    error = e;
                    tx.abort();
                }
            };
        }
    });
}
export async function readWebSettings() { return workspaceTransaction(false, t => t.business_settings[0] || null); }
export async function saveWebSettings(settings: any) {
    await workspaceTransaction(true, t => {
        const expected: Record<string, number> = { INR: 2, AED: 2, SAR: 2, QAR: 2, KWD: 3, BHD: 3, OMR: 3, USD: 2, EUR: 2 };
        if (expected[settings.currency_code] !== settings.currency_exponent)
            throw Error('Unsupported currency or exponent');
        const old = t.business_settings[0] || t.money_accounts[0];
        if (old && (old.currency_code !== settings.currency_code || old.currency_exponent !== settings.currency_exponent)) {
            if (t.products.length || t.cashbook_vouchers.length || t.cashbook_movements.length || t.money_accounts.some(a => a.opening_balance_minor !== 0))
                throw Error('Cannot change base currency after catalog or financial records exist.');
            for (const a of t.money_accounts) {
                a.currency_code = settings.currency_code;
                a.currency_exponent = settings.currency_exponent;
            }
        }
        t.business_settings = [settings];
    });
}
export async function exportWebWorkspace(settings: any): Promise<Record<string, any>> {
    return workspaceTransaction(false, t => {
        const payload: Record<string, any> = { ...t, business_settings: t.business_settings[0] || settings };
        for (const key of unsupported)
            payload[key] = [];
        return payload;
    });
}
export function validateWebWorkspace(data: WorkspaceBackupEnvelope): void {
    const d = data as unknown as Record<string, any>;
    for (const key of unsupported)
        if (!Array.isArray(d[key]) || d[key].length)
            throw Error(`Unsupported browser workspace table: ${key}. Restore this backup in the native application.`);
    for (const key of workspaceTables.filter(k => k !== 'business_settings')) {
        if (!Array.isArray(d[key]))
            throw Error(`Missing workspace table: ${key}`);
        const ids = new Set<string>();
        for (const row of d[key]) {
            const id = key === 'cashbook_sequences' ? row.sequence_key : key === 'category_merges' ? row.merged_category_id : row.id;
            if (typeof id !== 'string' || !id || ids.has(id))
                throw Error(`Invalid/duplicate key in ${key}`);
            ids.add(id);
        }
    }
    const settings = data.business_settings;
    if (!settings || settings.id !== 'default' || ![2, 3].includes(settings.currency_exponent) || !settings.currency_code || !settings.business_name)
        throw Error('Invalid business settings');
    const finite = (n: any, max = MAX_TOTAL_MINOR) => { if (!Number.isSafeInteger(n) || Math.abs(n) > max)
        throw Error('Invalid workspace integer'); };
    const ids = (key: string) => new Set<string>(d[key].map((r: any) => r.id));
    const ref = (key: string, id: any, optional = false) => { if (optional && (id == null || id === ''))
        return; if (!ids(key).has(id))
        throw Error(`Missing ${key} reference: ${id}`); };
    validateCatalog({ products: d.products, customers: d.customers, categories: d.categories, stock_movements: d.stock_movements, cashbook_parties: d.cashbook_parties });
    for (const merge of d.category_merges)
        ref('categories', merge.canonical_category_id);
    for (const p of d.customers)
        finite(p.current_balance_minor);
    for (const p of d.cashbook_parties)
        ref('customers', p.customer_id, true);
    const stock = new Map<string, number>();
    for (const m of d.stock_movements) {
        ref('products', m.product_id);
        finite(m.quantity_delta_scaled);
        finite(m.resulting_stock_scaled);
        stock.set(m.product_id, (stock.get(m.product_id) || 0) + m.quantity_delta_scaled);
    }
    for (const p of d.products)
        if (p.is_stock_tracked && (stock.get(p.id) || 0) !== p.current_stock_scaled)
            throw Error('Stock ledger does not match product quantity');
    for (const a of d.money_accounts) {
        finite(a.opening_balance_minor, MAX_MONEY_MINOR);
        if (a.currency_code !== settings.currency_code || a.currency_exponent !== settings.currency_exponent)
            throw Error('Account currency mismatch');
    }
    const seenIntent = new Set(), seenNumber = new Set();
    for (const v of d.cashbook_vouchers) {
        ref('money_accounts', v.account_id);
        ref('cashbook_parties', v.party_id, true);
        ref('cashbook_categories', v.category_id, true);
        finite(v.amount_minor, MAX_MONEY_MINOR);
        if (v.amount_minor <= 0 || !['inflow', 'outflow'].includes(v.direction) || !['posted', 'reversed'].includes(v.status) || !/^\d{4}-\d{2}-\d{2}$/.test(v.business_date))
            throw Error('Invalid voucher');
        if (seenIntent.has(v.idempotency_key) || seenNumber.has(v.voucher_number))
            throw Error('Duplicate voucher identity');
        seenIntent.add(v.idempotency_key);
        seenNumber.add(v.voucher_number);
        const match = /^(RCP(?:-REV)?|PAY(?:-REV)?)-(\d{6})-(\d+)$/.exec(v.voucher_number);
        if (!match || match[2] !== v.business_date.replace(/-/g, '').slice(0, 6))
            throw Error('Invalid voucher number');
        const sequence = d.cashbook_sequences.find((s: any) => s.sequence_key === `${match[1]}-${match[2]}`);
        if (!sequence || sequence.current_number < Number(match[3]))
            throw Error('Missing or stale voucher sequence');
        if (v.is_reversal) {
            ref('cashbook_vouchers', v.reversal_for_voucher_id);
            const original = d.cashbook_vouchers.find((o: any) => o.id === v.reversal_for_voucher_id);
            if (!original.is_reversed || original.reversed_by_voucher_id !== v.id || original.is_reversal || original.amount_minor !== v.amount_minor || original.account_id !== v.account_id || original.direction === v.direction)
                throw Error('Invalid reversal relationship');
            for (const key of ['party_id', 'category_id', 'classification', 'payment_method', 'business_name_snap', 'business_tax_id_snap', 'business_address_snap', 'business_phone_snap', 'party_name_snap', 'party_phone_snap', 'party_tax_id_snap', 'party_address_snap', 'account_name_snap', 'currency_code_snap', 'currency_exponent_snap'])
                if ((original[key] ?? null) !== (v[key] ?? null))
                    throw Error('Reversal snapshot mismatch');
        }
        else if (v.reversal_for_voucher_id)
            throw Error('Unexpected reversal reference');
        if (v.is_reversed) {
            ref('cashbook_vouchers', v.reversed_by_voucher_id);
            const reversal = d.cashbook_vouchers.find((r: any) => r.id === v.reversed_by_voucher_id);
            if (!reversal.is_reversal || reversal.reversal_for_voucher_id !== v.id)
                throw Error('Invalid reversed voucher');
        }
        else if (v.reversed_by_voucher_id)
            throw Error('Unexpected reversed-by reference');
        const moves = d.cashbook_movements.filter((m: any) => m.voucher_id === v.id);
        if (moves.length !== 1 || moves[0].account_id !== v.account_id || moves[0].business_date !== v.business_date || moves[0].amount_minor !== (v.direction === 'inflow' ? v.amount_minor : -v.amount_minor))
            throw Error('Voucher movement mismatch');
    }
    for (const m of d.cashbook_movements) {
        ref('cashbook_vouchers', m.voucher_id);
        ref('money_accounts', m.account_id);
        finite(m.amount_minor);
        finite(m.sequence_number);
    }
    for (const a of d.money_accounts) {
        let balance = BigInt(a.opening_balance_minor);
        for (const m of d.cashbook_movements.filter((m: any) => m.account_id === a.id))
            balance += BigInt(m.amount_minor);
        if (balance > BigInt(MAX_TOTAL_MINOR) || balance < -BigInt(MAX_TOTAL_MINOR))
            throw Error('Account balance exceeds maximum');
    }
    for (const a of d.cashbook_audit_events)
        ref('cashbook_vouchers', a.voucher_id, true);
    for (const seq of d.cashbook_sequences)
        finite(seq.current_number);
}
export async function restoreWebWorkspace(data: WorkspaceBackupEnvelope) {
    validateWebWorkspace(data);
    await workspaceTransaction(true, t => { for (const key of workspaceTables)
        t[key] = key === 'business_settings' ? [data.business_settings] : (data as any)[key].map((row: any) => { const copy = { ...row }; for (const field of ['is_active', 'is_stock_tracked', 'is_archived', 'is_default', 'allow_negative_balance', 'is_reversal', 'is_reversed'])
            if (field in copy)
                copy[field] = Boolean(copy[field]); return copy; }); });
    return { success: true, message: 'Workspace restored atomically in browser storage.', restored_tables: [...workspaceTables], record_counts: Object.fromEntries(workspaceTables.map(k => [k, k === 'business_settings' ? 1 : (data as any)[k].length])) };
}
