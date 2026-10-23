import type {
  MoneyAccount,
  CreateMoneyAccountDto,
  UpdateMoneyAccountDto,
  CashbookCategory,
  CreateCashbookCategoryDto,
  CashbookParty,
  CreateCashbookPartyDto,
  CashbookVoucher,
  CashbookMovement,
  CashbookLedgerEntry,
  CashbookSummary,
  CreateVoucherInput,
  PostVoucherResult,
  CashbookLedgerFilter,
  MovementDirection,
  CashbookClassification,
  CategoryType,
} from '../types/cashbook';
import { getTodayBusinessDate } from '../domain/financial';
import { computeClientIntentHash } from '../domain/backup_crypto';

const DB_NAME = 'BillZen_Web_DB';
const DB_VERSION = 3;

export const MAX_MONEY_MINOR = 100_000_000_000; // 10^11
export const MAX_TOTAL_MINOR = 100_000_000_000_000; // 10^14

export interface CashbookSequenceRecord {
  sequence_key: string;
  current_number: number;
  updated_at: number;
}

export interface CashbookAuditEventRecord {
  id: string;
  voucher_id: string;
  event_type: string;
  details_json: string;
  created_at: number;
}

// ---------------------------------------------------------------------------
// In-Memory Fallback Store (for Headless Node.js / Vitest when indexedDB is undefined)
// ---------------------------------------------------------------------------
interface InMemStore {
  money_accounts: Map<string, MoneyAccount>;
  cashbook_categories: Map<string, CashbookCategory>;
  cashbook_parties: Map<string, CashbookParty>;
  cashbook_vouchers: Map<string, CashbookVoucher>;
  cashbook_movements: Map<string, CashbookMovement>;
  cashbook_sequences: Map<string, CashbookSequenceRecord>;
  cashbook_audit_events: Map<string, CashbookAuditEventRecord>;
}

function createDefaultInMemStore(): InMemStore {
  const store: InMemStore = {
    money_accounts: new Map(),
    cashbook_categories: new Map(),
    cashbook_parties: new Map(),
    cashbook_vouchers: new Map(),
    cashbook_movements: new Map(),
    cashbook_sequences: new Map(),
    cashbook_audit_events: new Map(),
  };

  const now = Date.now();
  const defaultAccounts: MoneyAccount[] = [
    {
      id: 'acc_cash_default',
      account_name: 'Main Cash Drawer',
      account_type: 'cash',
      opening_balance_minor: 0,
      allow_negative_balance: false,
      currency_code: 'INR',
      currency_exponent: 2,
      bank_name: null,
      account_number: null,
      ifsc_or_routing: null,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'acc_bank_default',
      account_name: 'Current Bank Account',
      account_type: 'bank',
      opening_balance_minor: 0,
      allow_negative_balance: true,
      currency_code: 'INR',
      currency_exponent: 2,
      bank_name: 'State Bank of India',
      account_number: '1234567890',
      ifsc_or_routing: 'SBIN0001234',
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
  ];
  for (const a of defaultAccounts) store.money_accounts.set(a.id, { ...a });

  const defaultCategories: CashbookCategory[] = [
    { id: 'cat_sales', name: 'Sales Revenue', category_type: 'income', is_default: true, is_archived: false, created_at: now },
    { id: 'cat_rent', name: 'Shop Rent', category_type: 'expense', is_default: true, is_archived: false, created_at: now },
    { id: 'cat_salary', name: 'Staff Salaries', category_type: 'expense', is_default: true, is_archived: false, created_at: now },
    { id: 'cat_general', name: 'General Expense', category_type: 'both', is_default: true, is_archived: false, created_at: now },
  ];
  for (const c of defaultCategories) store.cashbook_categories.set(c.id, { ...c });

  return store;
}

let inMemStore: InMemStore = createDefaultInMemStore();

// ---------------------------------------------------------------------------
// Environment & Helper Utilities
// ---------------------------------------------------------------------------

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

async function getCompanySettings(transaction?: IDBTransaction): Promise<{
  business_name: string;
  tax_identifier: string | null;
  phone: string | null;
  address: string | null;
  currency_code: string;
  currency_exponent: number;
  timezone: string;
}> {
  try {
    const storage: Storage | undefined =
      typeof localStorage !== 'undefined'
        ? localStorage
        : typeof globalThis !== 'undefined' && (globalThis as any).localStorage
        ? (globalThis as any).localStorage
        : undefined;
    const db = transaction ? null : await openWebDb();
    let durable: any = null;
    if (db || transaction) {
      const tx = transaction || db!.transaction('business_settings', 'readonly');
      durable = await reqToPromise(tx.objectStore('business_settings').get('default'));
      if (!transaction) await txToPromise(tx);
    }
    const raw = durable ? JSON.stringify(durable) : storage ? storage.getItem('billzen_browser_settings') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        business_name: parsed.business_name || 'BillZen Store (Browser Preview)',
        tax_identifier: parsed.tax_identifier || null,
        phone: parsed.phone || null,
        address: parsed.address_line1 || null,
        currency_code: parsed.currency_code || 'INR',
        currency_exponent: typeof parsed.currency_exponent === 'number' ? parsed.currency_exponent : 2,
        timezone: parsed.timezone || 'Asia/Kolkata',
      };
    }
  } catch {}
  return {
    business_name: 'BillZen Store (Browser Preview)',
    tax_identifier: '32AAAAA0000A1Z5',
    phone: '+91 9876543210',
    address: '123 Market Road, Kochi',
    currency_code: 'INR',
    currency_exponent: 2,
    timezone: 'Asia/Kolkata',
  };
}

export function validateMoneyAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Amount must be strictly positive: ${amount}`);
  }
  if (amount > MAX_MONEY_MINOR) {
    throw new Error(`Amount ${amount} exceeds maximum permissible money minor ${MAX_MONEY_MINOR}`);
  }
}

export function validateBusinessDate(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid business date format (expected YYYY-MM-DD): '${dateStr}'`);
  }
}

export function validateDirectionAndClassification(
  direction: MovementDirection,
  classification: CashbookClassification
): void {
  if (classification === 'transfer') {
    throw new Error('Transfers are not supported in C1 ordinary voucher route');
  }
  if (classification === 'opening_balance') {
    throw new Error('Opening balance cannot be posted as a voucher');
  }
  if (direction === 'inflow') {
    if (
      classification !== 'operating_income' &&
      classification !== 'capital' &&
      classification !== 'loan' &&
      classification !== 'refund'
    ) {
      throw new Error(`Incompatible direction '${direction}' with classification '${classification}'`);
    }
  } else if (direction === 'outflow') {
    if (
      classification !== 'operating_expense' &&
      classification !== 'capital' &&
      classification !== 'loan' &&
      classification !== 'advance' &&
      classification !== 'refund'
    ) {
      throw new Error(`Incompatible direction '${direction}' with classification '${classification}'`);
    }
  }
}

export function validateDirectionAndCategory(
  direction: MovementDirection,
  categoryType: CategoryType
): void {
  if (direction === 'inflow' && categoryType === 'expense') {
    throw new Error(`Incompatible direction '${direction}' with category type '${categoryType}'`);
  }
  if (direction === 'outflow' && categoryType === 'income') {
    throw new Error(`Incompatible direction '${direction}' with category type '${categoryType}'`);
  }
}

export function formatVoucherNumber(prefix: string, yearMonth: string, seq: number): string {
  return `${prefix}-${yearMonth}-${seq.toString().padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// IndexedDB Lifecycle and Connection Management
// ---------------------------------------------------------------------------

let cachedDb: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      const err = req.error;
      if (err?.name === 'QuotaExceededError') {
        reject(new Error('Storage quota exceeded. Please free up browser storage space.'));
      } else {
        reject(err || new Error('IndexedDB request error'));
      }
    };
  });
}

function txToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      const err = tx.error;
      if (err?.name === 'QuotaExceededError') {
        reject(new Error('Storage quota exceeded. Please free up browser storage space.'));
      } else {
        reject(err || new Error('Transaction error'));
      }
    };
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function openWebDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return null;
  if (cachedDb) return cachedDb;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    let shouldSeed = false;
    req.onupgradeneeded = (event) => {
      shouldSeed = (event as IDBVersionChangeEvent).oldVersion === 0;
      const db = req.result;
      const migrateOpeningStock = !db.objectStoreNames.contains('stock_movements');
      for (const name of ['products', 'customers', 'categories', 'stock_movements', 'business_settings', 'category_merges']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: name === 'category_merges' ? 'merged_category_id' : 'id' });
      }

      if (migrateOpeningStock) {
        const tx = req.transaction!;
        const cursor = tx.objectStore('products').openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          const p = row.value;
          if (p.is_stock_tracked && p.current_stock_scaled > 0) tx.objectStore('stock_movements').add({
            id: `opening_${p.id}`, product_id: p.id, reference_type: 'opening', reference_id: null,
            quantity_delta_scaled: p.current_stock_scaled, resulting_stock_scaled: p.current_stock_scaled,
            notes: 'Opening Stock (catalog migration)', created_at: p.created_at,
          });
          row.continue();
        };
      }

      if (!db.objectStoreNames.contains('money_accounts')) {
        db.createObjectStore('money_accounts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cashbook_categories')) {
        db.createObjectStore('cashbook_categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cashbook_parties')) {
        db.createObjectStore('cashbook_parties', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cashbook_vouchers')) {
        const vStore = db.createObjectStore('cashbook_vouchers', { keyPath: 'id' });
        vStore.createIndex('by_account_id', 'account_id', { unique: false });
        vStore.createIndex('by_business_date', 'business_date', { unique: false });
        vStore.createIndex('by_idempotency_key', 'idempotency_key', { unique: true });
        vStore.createIndex('by_voucher_number', 'voucher_number', { unique: true });
      }
      if (!db.objectStoreNames.contains('cashbook_movements')) {
        const mStore = db.createObjectStore('cashbook_movements', { keyPath: 'id' });
        mStore.createIndex('by_voucher_id', 'voucher_id', { unique: false });
        mStore.createIndex('by_account_id', 'account_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('cashbook_sequences')) {
        db.createObjectStore('cashbook_sequences', { keyPath: 'sequence_key' });
      }
      if (!db.objectStoreNames.contains('cashbook_audit_events')) {
        const aStore = db.createObjectStore('cashbook_audit_events', { keyPath: 'id' });
        aStore.createIndex('by_voucher_id', 'voucher_id', { unique: false });
      }
    };

    req.onsuccess = async () => {
      const db = req.result;

      // Multi-tab safety: Close connection if another tab triggers an upgrade
      db.onversionchange = () => {
        db.close();
        cachedDb = null;
        dbPromise = null;
      };

      try {
        if (shouldSeed) await seedDefaultWebDataIfEmpty(db);
        cachedDb = db;
        resolve(db);
      } catch (seedErr) {
        reject(seedErr);
      }
    };

    req.onblocked = () => { dbPromise = null; reject(new Error('Database upgrade blocked. Close other BillZen tabs and reload.')); };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}

async function seedDefaultWebDataIfEmpty(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(['money_accounts', 'cashbook_categories'], 'readwrite');
  const accStore = tx.objectStore('money_accounts');
  const catStore = tx.objectStore('cashbook_categories');

  const accCount = await reqToPromise(accStore.count());
  const now = Date.now();

  if (accCount === 0) {
    const defaultAccounts: MoneyAccount[] = [
      {
        id: 'acc_cash_default',
        account_name: 'Main Cash Drawer',
        account_type: 'cash',
        opening_balance_minor: 0,
        allow_negative_balance: false,
        currency_code: 'INR',
        currency_exponent: 2,
        bank_name: null,
        account_number: null,
        ifsc_or_routing: null,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'acc_bank_default',
        account_name: 'Current Bank Account',
        account_type: 'bank',
        opening_balance_minor: 0,
        allow_negative_balance: true,
        currency_code: 'INR',
        currency_exponent: 2,
        bank_name: 'State Bank of India',
        account_number: '1234567890',
        ifsc_or_routing: 'SBIN0001234',
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    ];
    for (const a of defaultAccounts) {
      accStore.put(a);
    }
  }

  const catCount = await reqToPromise(catStore.count());
  if (catCount === 0) {
    const defaultCategories: CashbookCategory[] = [
      { id: 'cat_sales', name: 'Sales Revenue', category_type: 'income', is_default: true, is_archived: false, created_at: now },
      { id: 'cat_rent', name: 'Shop Rent', category_type: 'expense', is_default: true, is_archived: false, created_at: now },
      { id: 'cat_salary', name: 'Staff Salaries', category_type: 'expense', is_default: true, is_archived: false, created_at: now },
      { id: 'cat_general', name: 'General Expense', category_type: 'both', is_default: true, is_archived: false, created_at: now },
    ];
    for (const c of defaultCategories) {
      catStore.put(c);
    }
  }

  await txToPromise(tx);
}

export async function clearWebCashbookDatabase(): Promise<void> {
  inMemStore = createDefaultInMemStore();
  if (isIndexedDbAvailable()) {
    const db = await openWebDb();
    if (db) {
      const tx = db.transaction(
        ['money_accounts', 'cashbook_categories', 'cashbook_parties', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_sequences', 'cashbook_audit_events'],
        'readwrite'
      );
      tx.objectStore('money_accounts').clear();
      tx.objectStore('cashbook_categories').clear();
      tx.objectStore('cashbook_parties').clear();
      tx.objectStore('cashbook_vouchers').clear();
      tx.objectStore('cashbook_movements').clear();
      tx.objectStore('cashbook_sequences').clear();
      tx.objectStore('cashbook_audit_events').clear();
      await txToPromise(tx);
      await seedDefaultWebDataIfEmpty(db);
    }
  }
}

// ---------------------------------------------------------------------------
// Accounts API
// ---------------------------------------------------------------------------

export async function getWebMoneyAccounts(): Promise<MoneyAccount[]> {
  const db = await openWebDb();
  if (!db) {
    return Array.from(inMemStore.money_accounts.values());
  }

  const tx = db.transaction(['money_accounts', 'cashbook_movements'], 'readonly');
  const accStore = tx.objectStore('money_accounts');
  const movStore = tx.objectStore('cashbook_movements');

  const accounts = await reqToPromise(accStore.getAll());
  const movements = await reqToPromise(movStore.getAll());
  await txToPromise(tx);

  return accounts.map((acc) => {
    const sumMovs = movements
      .filter((m) => m.account_id === acc.id)
      .reduce((sum, m) => sum + m.amount_minor, 0);
    return {
      ...acc,
      current_balance_minor: acc.opening_balance_minor + sumMovs,
    };
  });
}

export async function createWebMoneyAccount(dto: CreateMoneyAccountDto): Promise<MoneyAccount> {
  let settings = await getCompanySettings();
  const currencyCode = dto.currency_code?.trim() || settings.currency_code;
  const currencyExponent = dto.currency_exponent ?? settings.currency_exponent;

  if (currencyCode !== settings.currency_code) {
    throw new Error(`Currency code '${currencyCode}' does not match company base currency '${settings.currency_code}'`);
  }
  if (currencyExponent !== settings.currency_exponent) {
    throw new Error(`Currency exponent '${currencyExponent}' does not match expected exponent '${settings.currency_exponent}'`);
  }

  const now = Date.now();
  const id = `acc_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const account: MoneyAccount = {
    id,
    account_name: dto.account_name.trim(),
    account_type: dto.account_type as any,
    opening_balance_minor: dto.opening_balance_minor,
    allow_negative_balance: dto.allow_negative_balance,
    currency_code: currencyCode,
    currency_exponent: currencyExponent,
    bank_name: dto.bank_name ? dto.bank_name.trim() : null,
    account_number: dto.account_number ? dto.account_number.trim() : null,
    ifsc_or_routing: dto.ifsc_or_routing ? dto.ifsc_or_routing.trim() : null,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  const db = await openWebDb();
  if (!db) {
    inMemStore.money_accounts.set(id, account);
    return account;
  }

  const tx = db.transaction(['business_settings', 'money_accounts'], 'readwrite');
  const currentSettings = await getCompanySettings(tx);
  if ((dto.currency_code && dto.currency_code !== currentSettings.currency_code) || (dto.currency_exponent != null && dto.currency_exponent !== currentSettings.currency_exponent)) {
    tx.abort(); throw new Error('Currency changed; reload before creating this account');
  }
  account.currency_code = currentSettings.currency_code;
  account.currency_exponent = currentSettings.currency_exponent;
  tx.objectStore('money_accounts').put(account);
  await txToPromise(tx);

  return account;
}

export async function updateWebMoneyAccount(dto: UpdateMoneyAccountDto): Promise<MoneyAccount> {
  const db = await openWebDb();
  if (!db) {
    const existing = inMemStore.money_accounts.get(dto.id);
    if (!existing) throw new Error(`Account ${dto.id} not found`);
    const updated: MoneyAccount = {
      ...existing,
      account_name: dto.account_name.trim(),
      allow_negative_balance: dto.allow_negative_balance,
      bank_name: dto.bank_name !== undefined ? dto.bank_name : existing.bank_name,
      account_number: dto.account_number !== undefined ? dto.account_number : existing.account_number,
      ifsc_or_routing: dto.ifsc_or_routing !== undefined ? dto.ifsc_or_routing : existing.ifsc_or_routing,
      is_archived: dto.is_archived !== undefined && dto.is_archived !== null ? dto.is_archived : existing.is_archived,
      updated_at: Date.now(),
    };
    inMemStore.money_accounts.set(dto.id, updated);
    return updated;
  }

  const tx = db.transaction(['money_accounts'], 'readwrite');
  const store = tx.objectStore('money_accounts');
  const existing = await reqToPromise(store.get(dto.id));
  if (!existing) {
    tx.abort();
    throw new Error(`Account ${dto.id} not found`);
  }

  const updated: MoneyAccount = {
    ...existing,
    account_name: dto.account_name.trim(),
    allow_negative_balance: dto.allow_negative_balance,
    bank_name: dto.bank_name !== undefined ? dto.bank_name : existing.bank_name,
    account_number: dto.account_number !== undefined ? dto.account_number : existing.account_number,
    ifsc_or_routing: dto.ifsc_or_routing !== undefined ? dto.ifsc_or_routing : existing.ifsc_or_routing,
    is_archived: dto.is_archived !== undefined && dto.is_archived !== null ? dto.is_archived : existing.is_archived,
    updated_at: Date.now(),
  };

  store.put(updated);
  await txToPromise(tx);
  return updated;
}

// ---------------------------------------------------------------------------
// Categories API
// ---------------------------------------------------------------------------

export async function getWebCashbookCategories(): Promise<CashbookCategory[]> {
  const db = await openWebDb();
  if (!db) {
    return Array.from(inMemStore.cashbook_categories.values());
  }

  const tx = db.transaction(['cashbook_categories'], 'readonly');
  const items = await reqToPromise(tx.objectStore('cashbook_categories').getAll());
  await txToPromise(tx);
  return items;
}

export async function createWebCashbookCategory(dto: CreateCashbookCategoryDto): Promise<CashbookCategory> {
  const now = Date.now();
  const id = `cat_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const category: CashbookCategory = {
    id,
    name: dto.name.trim(),
    category_type: dto.category_type,
    is_default: false,
    is_archived: false,
    created_at: now,
  };

  const db = await openWebDb();
  if (!db) {
    inMemStore.cashbook_categories.set(id, category);
    return category;
  }

  const tx = db.transaction(['cashbook_categories'], 'readwrite');
  tx.objectStore('cashbook_categories').put(category);
  await txToPromise(tx);
  return category;
}

// ---------------------------------------------------------------------------
// Parties API
// ---------------------------------------------------------------------------

export async function getWebCashbookParties(): Promise<CashbookParty[]> {
  const db = await openWebDb();
  if (!db) {
    return Array.from(inMemStore.cashbook_parties.values());
  }

  const tx = db.transaction(['cashbook_parties'], 'readonly');
  const items = await reqToPromise(tx.objectStore('cashbook_parties').getAll());
  await txToPromise(tx);
  return items;
}

export async function createWebCashbookParty(dto: CreateCashbookPartyDto): Promise<CashbookParty> {
  const now = Date.now();
  const id = `pty_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const party: CashbookParty = {
    id,
    name: dto.name.trim(),
    party_type: dto.party_type,
    customer_id: dto.customer_id || null,
    phone: dto.phone || null,
    email: dto.email || null,
    tax_id: dto.tax_id || null,
    address: dto.address || null,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  const db = await openWebDb();
  if (!db) {
    inMemStore.cashbook_parties.set(id, party);
    return party;
  }

  const tx = db.transaction(['cashbook_parties'], 'readwrite');
  tx.objectStore('cashbook_parties').put(party);
  await txToPromise(tx);
  return party;
}

// ---------------------------------------------------------------------------
// Post Cashbook Voucher (with Invariant & Replay Parity)
// ---------------------------------------------------------------------------

export async function postWebCashbookVoucher(input: CreateVoucherInput): Promise<PostVoucherResult> {
  validateMoneyAmount(input.amount_minor);
  validateBusinessDate(input.business_date);

  if (!input.idempotency_key || input.idempotency_key.trim().length === 0) {
    throw new Error('Idempotency key cannot be empty');
  }

  validateDirectionAndClassification(input.direction, input.classification);

  const payloadHash = await computeClientIntentHash(input);
  let settings = await getCompanySettings();

  const db = await openWebDb();

  // In-Memory path
  if (!db) {
    // 1. Idempotency Check
    const existing = Array.from(inMemStore.cashbook_vouchers.values()).find(
      (v) => v.idempotency_key === input.idempotency_key
    );
    if (existing) {
      if (existing.payload_hash === payloadHash) {
        return { ...existing, status: 'posted' as const };
      }
      throw new Error('Idempotency key conflict: identical key used with different payload');
    }

    // 2. Fetch Account
    const acc = inMemStore.money_accounts.get(input.account_id);
    if (!acc) throw new Error(`Account not found: ${input.account_id}`);
    if (acc.is_archived) throw new Error(`Cannot post to or modify archived account: ${input.account_id}`);

    // 3. Currency Check
    if (acc.currency_code !== settings.currency_code) {
      throw new Error(`Currency code '${acc.currency_code}' does not match company base currency '${settings.currency_code}'`);
    }
    if (acc.currency_exponent !== settings.currency_exponent) {
      throw new Error(`Currency exponent '${acc.currency_exponent}' does not match expected exponent '${settings.currency_exponent}'`);
    }

    // 4. Category Check
    if (input.category_id) {
      const cat = inMemStore.cashbook_categories.get(input.category_id);
      if (!cat) throw new Error(`Category not found: ${input.category_id}`);
      validateDirectionAndCategory(input.direction, cat.category_type);
    }

    // 5. Balance calculation
    const movs = Array.from(inMemStore.cashbook_movements.values()).filter(
      (m) => m.account_id === input.account_id
    );
    const sumMovs = movs.reduce((s, m) => s + m.amount_minor, 0);
    const currentBal = acc.opening_balance_minor + sumMovs;
    const delta = input.direction === 'inflow' ? input.amount_minor : -input.amount_minor;
    const projected = currentBal + delta;

    if (projected < -MAX_TOTAL_MINOR || projected > MAX_TOTAL_MINOR) {
      throw new Error(`Balance exceeds maximum permissible total minor: ${projected}`);
    }

    // 6. Negative Balance Guard
    if (projected < 0 && !acc.allow_negative_balance && !input.confirmed_negative_balance) {
      return {
        status: 'requires_confirmation',
        current_balance_minor: currentBal,
        amount_minor: input.amount_minor,
        projected_balance_minor: projected,
        message: `Account balance would become negative: current ${currentBal}, projected ${projected}`,
      };
    }

    const now = Date.now();
    const ym = input.business_date.replace(/-/g, '').substring(0, 6);
    const prefix = input.direction === 'inflow' ? 'RCP' : 'PAY';
    const seqKey = `${prefix}-${ym}`;
    const seqRecord = inMemStore.cashbook_sequences.get(seqKey);
    const nextSeq = (seqRecord ? seqRecord.current_number : 0) + 1;
    inMemStore.cashbook_sequences.set(seqKey, { sequence_key: seqKey, current_number: nextSeq, updated_at: now });

    const voucherNumber = formatVoucherNumber(prefix, ym, nextSeq);
    const vchId = `vch_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const party = input.party_id ? inMemStore.cashbook_parties.get(input.party_id) : null;

    const voucher: CashbookVoucher = {
      id: vchId,
      voucher_number: voucherNumber,
      idempotency_key: input.idempotency_key,
      payload_hash: payloadHash,
      account_id: input.account_id,
      party_id: input.party_id || null,
      category_id: input.category_id || null,
      direction: input.direction,
      classification: input.classification,
      payment_method: input.payment_method,
      amount_minor: input.amount_minor,
      business_date: input.business_date,
      status: 'posted',
      is_reversal: false,
      reversal_for_voucher_id: null,
      is_reversed: false,
      reversed_by_voucher_id: null,
      reversed_at: null,
      reference_note: input.reference_note ? input.reference_note.trim() : null,
      notes: input.notes ? input.notes.trim() : null,
      business_name_snap: settings.business_name,
      business_tax_id_snap: settings.tax_identifier,
      business_address_snap: settings.address,
      business_phone_snap: settings.phone,
      party_name_snap: party?.name || null,
      party_phone_snap: party?.phone || null,
      party_tax_id_snap: party?.tax_id || null,
      party_address_snap: party?.address || null,
      account_name_snap: acc.account_name,
      currency_code_snap: acc.currency_code,
      currency_exponent_snap: acc.currency_exponent,
      amount_in_words_snap: null,
      created_at: now,
      posted_at: now,
    };

    inMemStore.cashbook_vouchers.set(vchId, voucher);
    inMemStore.cashbook_movements.set(`mov_${now}_${Math.random().toString(36).substring(2, 7)}`, {
      id: `mov_${now}`,
      voucher_id: vchId,
      account_id: input.account_id,
      amount_minor: delta,
      business_date: input.business_date,
      sequence_number: movs.length + 1,
      created_at: now,
    });

    inMemStore.cashbook_audit_events.set(`aud_${now}_1`, {
      id: `aud_${now}_1`,
      voucher_id: vchId,
      event_type: 'voucher_posted',
      details_json: JSON.stringify({ voucher_id: vchId, voucher_number: voucherNumber, amount_minor: input.amount_minor }),
      created_at: now,
    });

    if (projected < 0 && !acc.allow_negative_balance && input.confirmed_negative_balance) {
      inMemStore.cashbook_audit_events.set(`aud_${now}_2`, {
        id: `aud_${now}_2`,
        voucher_id: vchId,
        event_type: 'negative_balance_confirmed',
        details_json: JSON.stringify({ current_balance_minor: currentBal, amount_minor: input.amount_minor, projected_balance_minor: projected }),
        created_at: now,
      });
    }

    return { ...voucher, status: 'posted' as const };
  }

  // Durable IndexedDB Transaction Path
  const tx = db.transaction(
    ['business_settings', 'money_accounts', 'cashbook_categories', 'cashbook_parties', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_sequences', 'cashbook_audit_events'],
    'readwrite'
  );

  settings = await getCompanySettings(tx);
  const accStore = tx.objectStore('money_accounts');
  const catStore = tx.objectStore('cashbook_categories');
  const ptyStore = tx.objectStore('cashbook_parties');
  const vchStore = tx.objectStore('cashbook_vouchers');
  const movStore = tx.objectStore('cashbook_movements');
  const seqStore = tx.objectStore('cashbook_sequences');
  const audStore = tx.objectStore('cashbook_audit_events');

  // 1. Idempotency Check
  const idemIndex = vchStore.index('by_idempotency_key');
  const existingVoucher: CashbookVoucher | undefined = await reqToPromise(idemIndex.get(input.idempotency_key));
  if (existingVoucher) {
    if (existingVoucher.payload_hash === payloadHash) {
      return { ...existingVoucher, status: 'posted' as const };
    }
    tx.abort();
    throw new Error('Idempotency key conflict: identical key used with different payload');
  }

  // 2. Fetch Account
  const acc: MoneyAccount | undefined = await reqToPromise(accStore.get(input.account_id));
  if (!acc) {
    tx.abort();
    throw new Error(`Account not found: ${input.account_id}`);
  }
  if (acc.is_archived) {
    tx.abort();
    throw new Error(`Cannot post to or modify archived account: ${input.account_id}`);
  }

  // 3. Currency Check
  if (acc.currency_code !== settings.currency_code) {
    tx.abort();
    throw new Error(`Currency code '${acc.currency_code}' does not match company base currency '${settings.currency_code}'`);
  }
  if (acc.currency_exponent !== settings.currency_exponent) {
    tx.abort();
    throw new Error(`Currency exponent '${acc.currency_exponent}' does not match expected exponent '${settings.currency_exponent}'`);
  }

  // 4. Category Check
  if (input.category_id) {
    const cat: CashbookCategory | undefined = await reqToPromise(catStore.get(input.category_id));
    if (!cat) {
      tx.abort();
      throw new Error(`Category not found: ${input.category_id}`);
    }
    try {
      validateDirectionAndCategory(input.direction, cat.category_type);
    } catch (catErr) {
      tx.abort();
      throw catErr;
    }
  }

  // 5. Authoritative Balance Calculation
  const movIndex = movStore.index('by_account_id');
  const existingMovs: CashbookMovement[] = await reqToPromise(movIndex.getAll(input.account_id));
  const sumMovs = existingMovs.reduce((sum, m) => sum + m.amount_minor, 0);
  const currentBal = acc.opening_balance_minor + sumMovs;
  const delta = input.direction === 'inflow' ? input.amount_minor : -input.amount_minor;
  const projected = currentBal + delta;

  if (projected < -MAX_TOTAL_MINOR || projected > MAX_TOTAL_MINOR) {
    tx.abort();
    throw new Error(`Balance exceeds maximum permissible total minor: ${projected}`);
  }

  // 6. Negative Balance Guard
  if (projected < 0 && !acc.allow_negative_balance && !input.confirmed_negative_balance) {
    tx.abort();
    return {
      status: 'requires_confirmation',
      current_balance_minor: currentBal,
      amount_minor: input.amount_minor,
      projected_balance_minor: projected,
      message: `Account balance would become negative: current ${currentBal}, projected ${projected}`,
    };
  }

  const now = Date.now();
  const ym = input.business_date.replace(/-/g, '').substring(0, 6);
  const prefix = input.direction === 'inflow' ? 'RCP' : 'PAY';
  const seqKey = `${prefix}-${ym}`;
  const seqRecord: CashbookSequenceRecord | undefined = await reqToPromise(seqStore.get(seqKey));
  const nextSeq = (seqRecord ? seqRecord.current_number : 0) + 1;
  seqStore.put({ sequence_key: seqKey, current_number: nextSeq, updated_at: now });

  const voucherNumber = formatVoucherNumber(prefix, ym, nextSeq);
  const vchId = `vch_${now}_${Math.random().toString(36).substring(2, 7)}`;

  let party: CashbookParty | undefined;
  if (input.party_id) {
    party = await reqToPromise(ptyStore.get(input.party_id));
  }

  const voucher: CashbookVoucher = {
    id: vchId,
    voucher_number: voucherNumber,
    idempotency_key: input.idempotency_key,
    payload_hash: payloadHash,
    account_id: input.account_id,
    party_id: input.party_id || null,
    category_id: input.category_id || null,
    direction: input.direction,
    classification: input.classification,
    payment_method: input.payment_method,
    amount_minor: input.amount_minor,
    business_date: input.business_date,
    status: 'posted',
    is_reversal: false,
    reversal_for_voucher_id: null,
    is_reversed: false,
    reversed_by_voucher_id: null,
    reversed_at: null,
    reference_note: input.reference_note ? input.reference_note.trim() : null,
    notes: input.notes ? input.notes.trim() : null,
    business_name_snap: settings.business_name,
    business_tax_id_snap: settings.tax_identifier,
    business_address_snap: settings.address,
    business_phone_snap: settings.phone,
    party_name_snap: party?.name || null,
    party_phone_snap: party?.phone || null,
    party_tax_id_snap: party?.tax_id || null,
    party_address_snap: party?.address || null,
    account_name_snap: acc.account_name,
    currency_code_snap: acc.currency_code,
    currency_exponent_snap: acc.currency_exponent,
    amount_in_words_snap: null,
    created_at: now,
    posted_at: now,
  };

  vchStore.put(voucher);

  const movId = `mov_${now}_${Math.random().toString(36).substring(2, 7)}`;
  movStore.put({
    id: movId,
    voucher_id: vchId,
    account_id: input.account_id,
    amount_minor: delta,
    business_date: input.business_date,
    sequence_number: existingMovs.length + 1,
    created_at: now,
  });

  audStore.put({
    id: `aud_${now}_1`,
    voucher_id: vchId,
    event_type: 'voucher_posted',
    details_json: JSON.stringify({ voucher_id: vchId, voucher_number: voucherNumber, amount_minor: input.amount_minor }),
    created_at: now,
  });

  if (projected < 0 && !acc.allow_negative_balance && input.confirmed_negative_balance) {
    audStore.put({
      id: `aud_${now}_2`,
      voucher_id: vchId,
      event_type: 'negative_balance_confirmed',
      details_json: JSON.stringify({ current_balance_minor: currentBal, amount_minor: input.amount_minor, projected_balance_minor: projected }),
      created_at: now,
    });
  }

  await txToPromise(tx);
  return { ...voucher, status: 'posted' as const };
}

// ---------------------------------------------------------------------------
// Reverse Cashbook Voucher
// ---------------------------------------------------------------------------

export async function reverseWebCashbookVoucher(
  voucherId: string,
  confirmedNegativeBalance: boolean = false,
  businessDate?: string
): Promise<PostVoucherResult> {
  let settings = await getCompanySettings();
  const db = await openWebDb();

  // In-Memory path
  if (!db) {
    const orig = inMemStore.cashbook_vouchers.get(voucherId);
    if (!orig) throw new Error(`Voucher not found: ${voucherId}`);
    if (orig.status !== 'posted') throw new Error(`Voucher ${voucherId} cannot be reversed because it is not in posted state`);
    if (orig.is_reversed) throw new Error(`Voucher is already reversed: ${voucherId}`);
    if (orig.is_reversal) throw new Error(`Cannot reverse a reversal voucher: ${voucherId}`);

    const acc = inMemStore.money_accounts.get(orig.account_id);
    if (!acc) throw new Error(`Account not found: ${orig.account_id}`);
    if (acc.is_archived) throw new Error(`Cannot post to or modify archived account: ${orig.account_id}`);

    const revDelta = orig.direction === 'inflow' ? -orig.amount_minor : orig.amount_minor;
    const movs = Array.from(inMemStore.cashbook_movements.values()).filter(
      (m) => m.account_id === orig.account_id
    );
    const sumMovs = movs.reduce((sum, m) => sum + m.amount_minor, 0);
    const currentBal = acc.opening_balance_minor + sumMovs;
    const projected = currentBal + revDelta;

    if (projected < -MAX_TOTAL_MINOR || projected > MAX_TOTAL_MINOR) {
      throw new Error(`Balance exceeds maximum permissible total minor: ${projected}`);
    }

    if (projected < 0 && !acc.allow_negative_balance && !confirmedNegativeBalance) {
      return {
        status: 'requires_confirmation',
        current_balance_minor: currentBal,
        amount_minor: orig.amount_minor,
        projected_balance_minor: projected,
        message: `Reversal would make account balance negative: current ${currentBal}, projected ${projected}`,
      };
    }

    const now = Date.now();
    const effectiveBusinessDate = businessDate || getTodayBusinessDate(settings.timezone);
    const ym = effectiveBusinessDate.replace(/-/g, '').substring(0, 6);
    const prefix = orig.direction === 'inflow' ? 'RCP-REV' : 'PAY-REV';
    const seqKey = `${prefix}-${ym}`;
    const seqRecord = inMemStore.cashbook_sequences.get(seqKey);
    const nextSeq = (seqRecord ? seqRecord.current_number : 0) + 1;
    inMemStore.cashbook_sequences.set(seqKey, { sequence_key: seqKey, current_number: nextSeq, updated_at: now });

    const revVoucherNumber = formatVoucherNumber(prefix, ym, nextSeq);
    const revId = `vch_rev_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const revIdempotencyKey = `rev_${orig.id}`;

    const revVoucher: CashbookVoucher = {
      ...orig,
      id: revId,
      voucher_number: revVoucherNumber,
      idempotency_key: revIdempotencyKey,
      payload_hash: 'reversal',
      direction: orig.direction === 'inflow' ? 'outflow' : 'inflow',
      is_reversal: true,
      reversal_for_voucher_id: orig.id,
      is_reversed: false,
      reversed_by_voucher_id: null,
      reversed_at: null,
      business_date: effectiveBusinessDate,
      notes: `Reversal of voucher ${orig.voucher_number}`,
      created_at: now,
      posted_at: now,
    };

    orig.is_reversed = true;
    orig.reversed_by_voucher_id = revId;
    orig.reversed_at = now;

    inMemStore.cashbook_vouchers.set(orig.id, orig);
    inMemStore.cashbook_vouchers.set(revId, revVoucher);
    inMemStore.cashbook_movements.set(`mov_${revId}`, {
      id: `mov_${revId}`,
      voucher_id: revId,
      account_id: orig.account_id,
      amount_minor: revDelta,
      business_date: effectiveBusinessDate,
      sequence_number: movs.length + 1,
      created_at: now,
    });

    inMemStore.cashbook_audit_events.set(`aud_rev_${now}_1`, {
      id: `aud_rev_${now}_1`,
      voucher_id: orig.id,
      event_type: 'voucher_reversed',
      details_json: JSON.stringify({ original_id: orig.id, reversal_id: revId }),
      created_at: now,
    });

    return { ...revVoucher, status: 'posted' as const };
  }

  // Durable IndexedDB Transaction Path
  const tx = db.transaction(
    ['business_settings', 'money_accounts', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_sequences', 'cashbook_audit_events'],
    'readwrite'
  );

  settings = await getCompanySettings(tx);
  const accStore = tx.objectStore('money_accounts');
  const vchStore = tx.objectStore('cashbook_vouchers');
  const movStore = tx.objectStore('cashbook_movements');
  const seqStore = tx.objectStore('cashbook_sequences');
  const audStore = tx.objectStore('cashbook_audit_events');

  const orig: CashbookVoucher | undefined = await reqToPromise(vchStore.get(voucherId));
  if (!orig) {
    tx.abort();
    throw new Error(`Voucher not found: ${voucherId}`);
  }
  if (orig.status !== 'posted') {
    tx.abort();
    throw new Error(`Voucher ${voucherId} cannot be reversed because it is not in posted state`);
  }
  if (orig.is_reversed) {
    tx.abort();
    throw new Error(`Voucher is already reversed: ${voucherId}`);
  }
  if (orig.is_reversal) {
    tx.abort();
    throw new Error(`Cannot reverse a reversal voucher: ${voucherId}`);
  }

  const acc: MoneyAccount | undefined = await reqToPromise(accStore.get(orig.account_id));
  if (!acc) {
    tx.abort();
    throw new Error(`Account not found: ${orig.account_id}`);
  }
  if (acc.is_archived) {
    tx.abort();
    throw new Error(`Cannot post to or modify archived account: ${orig.account_id}`);
  }

  const revDelta = orig.direction === 'inflow' ? -orig.amount_minor : orig.amount_minor;
  const movIndex = movStore.index('by_account_id');
  const existingMovs: CashbookMovement[] = await reqToPromise(movIndex.getAll(orig.account_id));
  const sumMovs = existingMovs.reduce((sum, m) => sum + m.amount_minor, 0);
  const currentBal = acc.opening_balance_minor + sumMovs;
  const projected = currentBal + revDelta;

  if (projected < -MAX_TOTAL_MINOR || projected > MAX_TOTAL_MINOR) {
    tx.abort();
    throw new Error(`Balance exceeds maximum permissible total minor: ${projected}`);
  }

  if (projected < 0 && !acc.allow_negative_balance && !confirmedNegativeBalance) {
    tx.abort();
    return {
      status: 'requires_confirmation',
      current_balance_minor: currentBal,
      amount_minor: orig.amount_minor,
      projected_balance_minor: projected,
      message: `Reversal would make account balance negative: current ${currentBal}, projected ${projected}`,
    };
  }

  const now = Date.now();
  const effectiveBusinessDate = businessDate || getTodayBusinessDate(settings.timezone);
  const ym = effectiveBusinessDate.replace(/-/g, '').substring(0, 6);
  const prefix = orig.direction === 'inflow' ? 'RCP-REV' : 'PAY-REV';
  const seqKey = `${prefix}-${ym}`;
  const seqRecord: CashbookSequenceRecord | undefined = await reqToPromise(seqStore.get(seqKey));
  const nextSeq = (seqRecord ? seqRecord.current_number : 0) + 1;
  seqStore.put({ sequence_key: seqKey, current_number: nextSeq, updated_at: now });

  const revVoucherNumber = formatVoucherNumber(prefix, ym, nextSeq);
  const revId = `vch_rev_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const revIdempotencyKey = `rev_${orig.id}`;

  const revVoucher: CashbookVoucher = {
    ...orig,
    id: revId,
    voucher_number: revVoucherNumber,
    idempotency_key: revIdempotencyKey,
    payload_hash: 'reversal',
    direction: orig.direction === 'inflow' ? 'outflow' : 'inflow',
    is_reversal: true,
    reversal_for_voucher_id: orig.id,
    is_reversed: false,
    reversed_by_voucher_id: null,
    reversed_at: null,
    business_date: effectiveBusinessDate,
    notes: `Reversal of voucher ${orig.voucher_number}`,
    created_at: now,
    posted_at: now,
  };

  orig.is_reversed = true;
  orig.reversed_by_voucher_id = revId;
  orig.reversed_at = now;

  vchStore.put(orig);
  vchStore.put(revVoucher);

  movStore.put({
    id: `mov_${revId}`,
    voucher_id: revId,
    account_id: orig.account_id,
    amount_minor: revDelta,
    business_date: effectiveBusinessDate,
    sequence_number: existingMovs.length + 1,
    created_at: now,
  });

  audStore.put({
    id: `aud_rev_${now}_1`,
    voucher_id: orig.id,
    event_type: 'voucher_reversed',
    details_json: JSON.stringify({ original_id: orig.id, reversal_id: revId }),
    created_at: now,
  });

  if (projected < 0 && !acc.allow_negative_balance && confirmedNegativeBalance) {
    audStore.put({
      id: `aud_rev_${now}_2`,
      voucher_id: revId,
      event_type: 'negative_balance_confirmed',
      details_json: JSON.stringify({ current_balance_minor: currentBal, amount_minor: orig.amount_minor, projected_balance_minor: projected }),
      created_at: now,
    });
  }

  await txToPromise(tx);
  return { ...revVoucher, status: 'posted' as const };
}

// ---------------------------------------------------------------------------
// Ledger & Statement Summaries
// ---------------------------------------------------------------------------

export async function getWebCashbookLedger(
  filter: CashbookLedgerFilter
): Promise<{ entries: CashbookLedgerEntry[]; summary: CashbookSummary }> {
  let allVouchers: CashbookVoucher[] = [];
  let allMovements: CashbookMovement[] = [];
  let allAccounts: MoneyAccount[] = [];

  const db = await openWebDb();
  if (!db) {
    allVouchers = Array.from(inMemStore.cashbook_vouchers.values());
    allMovements = Array.from(inMemStore.cashbook_movements.values());
    allAccounts = Array.from(inMemStore.money_accounts.values());
  } else {
    const tx = db.transaction(['cashbook_vouchers', 'cashbook_movements', 'money_accounts'], 'readonly');
    allVouchers = await reqToPromise(tx.objectStore('cashbook_vouchers').getAll());
    allMovements = await reqToPromise(tx.objectStore('cashbook_movements').getAll());
    allAccounts = await reqToPromise(tx.objectStore('money_accounts').getAll());
    await txToPromise(tx);
  }

  // Relevant accounts based on filter.account_id and filter.include_archived
  const relevantAccounts = allAccounts.filter((a) =>
    filter.account_id ? a.id === filter.account_id : filter.include_archived ? true : !a.is_archived
  );
  const relevantAccountIds = new Set(relevantAccounts.map((a) => a.id));

  // 1. Period vouchers (scoped to relevant accounts and date range, but NOT display-filtered)
  let periodVouchers = allVouchers.filter((v) => relevantAccountIds.has(v.account_id));
  if (filter.start_date) {
    periodVouchers = periodVouchers.filter((v) => v.business_date >= filter.start_date!);
  }
  if (filter.end_date) {
    periodVouchers = periodVouchers.filter((v) => v.business_date <= filter.end_date!);
  }

  // 2. Period financial summary figures across all period vouchers
  const periodInflows = periodVouchers
    .filter((v) => v.direction === 'inflow')
    .reduce((sum, v) => sum + v.amount_minor, 0);

  const periodOutflows = periodVouchers
    .filter((v) => v.direction === 'outflow')
    .reduce((sum, v) => sum + v.amount_minor, 0);

  const netOperating = periodVouchers
    .filter((v) => v.classification === 'operating_income' || v.classification === 'operating_expense')
    .reduce((sum, v) => sum + (v.direction === 'inflow' ? v.amount_minor : -v.amount_minor), 0);

  // 3. Opening balance calculation (account base opening + movements strictly prior to start_date)
  const baseOpening = relevantAccounts.reduce((sum, a) => sum + a.opening_balance_minor, 0);
  const priorMovements = filter.start_date
    ? allMovements
        .filter((m) => relevantAccountIds.has(m.account_id) && m.business_date < filter.start_date!)
        .reduce((sum, m) => sum + m.amount_minor, 0)
    : 0;
  const periodOpeningBalance = baseOpening + priorMovements;
  const periodClosingBalance = periodOpeningBalance + periodInflows - periodOutflows;

  // 4. Total Cash & Active Cash (overall or account-specific)
  let totalCash: number;
  let activeCash: number;
  if (filter.account_id) {
    const targetAcc = allAccounts.find((a) => a.id === filter.account_id);
    const movSum = allMovements
      .filter((m) => m.account_id === filter.account_id)
      .reduce((s, m) => s + m.amount_minor, 0);
    const bal = (targetAcc?.opening_balance_minor || 0) + movSum;
    totalCash = bal;
    activeCash = targetAcc && !targetAcc.is_archived ? bal : 0;
  } else {
    totalCash = allAccounts.reduce((sum, a) => {
      const movs = allMovements.filter((m) => m.account_id === a.id).reduce((s, m) => s + m.amount_minor, 0);
      return sum + a.opening_balance_minor + movs;
    }, 0);
    activeCash = allAccounts
      .filter((a) => !a.is_archived)
      .reduce((sum, a) => {
        const movs = allMovements.filter((m) => m.account_id === a.id).reduce((s, m) => s + m.amount_minor, 0);
        return sum + a.opening_balance_minor + movs;
      }, 0);
  }

  // 5. Display filtering for ledger entries & matching metrics
  let filtered = [...periodVouchers];
  if (filter.party_id) filtered = filtered.filter(v => v.party_id === filter.party_id);
  if (filter.classification) {
    filtered = filtered.filter((v) => v.classification === filter.classification);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase().trim();
    filtered = filtered.filter(
      (v) =>
        v.voucher_number.toLowerCase().includes(q) ||
        (v.party_name_snap && v.party_name_snap.toLowerCase().includes(q)) ||
        (v.notes && v.notes.toLowerCase().includes(q)) ||
        (v.reference_note && v.reference_note.toLowerCase().includes(q))
    );
  }

  // Sort chronologically: business_date ASC, created_at ASC
  filtered.sort((a, b) => {
    if (a.business_date !== b.business_date) {
      return a.business_date.localeCompare(b.business_date);
    }
    return a.created_at - b.created_at;
  });

  // Calculate Running Balance partitioned by account_id
  const accountRunningTotals = new Map<string, number>();
  for (const acc of allAccounts) {
    accountRunningTotals.set(acc.id, acc.opening_balance_minor);
  }

  const sortedMovements = [...allMovements].sort((a, b) => {
    if (a.business_date !== b.business_date) {
      return a.business_date.localeCompare(b.business_date);
    }
    if (a.sequence_number !== b.sequence_number) {
      return a.sequence_number - b.sequence_number;
    }
    return a.created_at - b.created_at;
  });

  const movementRunningBalances = new Map<string, number>();
  for (const mov of sortedMovements) {
    const prev = accountRunningTotals.get(mov.account_id) ?? 0;
    const next = prev + mov.amount_minor;
    accountRunningTotals.set(mov.account_id, next);
    movementRunningBalances.set(mov.id, next);
  }

  const entries: CashbookLedgerEntry[] = filtered.map((v) => {
    const mov = allMovements.find((m) => m.voucher_id === v.id);
    const movAmount = mov ? mov.amount_minor : (v.direction === 'inflow' ? v.amount_minor : -v.amount_minor);
    const runningBal = mov
      ? movementRunningBalances.get(mov.id) ?? 0
      : (allAccounts.find((a) => a.id === v.account_id)?.opening_balance_minor || 0) + movAmount;

    return {
      voucher: v,
      movement: mov || {
        id: `mov_${v.id}`,
        voucher_id: v.id,
        account_id: v.account_id,
        amount_minor: movAmount,
        business_date: v.business_date,
        sequence_number: 1,
        created_at: v.created_at,
      },
      running_balance_minor: runningBal,
    };
  });

  const isDisplayFiltered = Boolean(filter.search || filter.classification || filter.party_id);

  const summary: CashbookSummary = {
    total_cash_minor: totalCash,
    active_cash_minor: activeCash,
    period_inflows_minor: periodInflows,
    period_outflows_minor: periodOutflows,
    net_operating_cash_flow_minor: netOperating,
    opening_balance_minor: periodOpeningBalance,
    closing_balance_minor: periodClosingBalance,
    matching_inflows_minor: isDisplayFiltered
      ? filtered.filter((v) => v.direction === 'inflow').reduce((sum, v) => sum + v.amount_minor, 0)
      : null,
    matching_outflows_minor: isDisplayFiltered
      ? filtered.filter((v) => v.direction === 'outflow').reduce((sum, v) => sum + v.amount_minor, 0)
      : null,
    matching_count: isDisplayFiltered ? filtered.length : null,
  };

  return { entries, summary };
}

// ---------------------------------------------------------------------------
// Whole-Workspace Web Backup & Restore
// ---------------------------------------------------------------------------

export async function exportWebCashbookTables(): Promise<{
  money_accounts: MoneyAccount[];
  cashbook_categories: CashbookCategory[];
  cashbook_parties: CashbookParty[];
  cashbook_vouchers: CashbookVoucher[];
  cashbook_movements: CashbookMovement[];
  cashbook_sequences: CashbookSequenceRecord[];
  cashbook_audit_events: CashbookAuditEventRecord[];
}> {
  const db = await openWebDb();
  if (!db) {
    return {
      money_accounts: Array.from(inMemStore.money_accounts.values()),
      cashbook_categories: Array.from(inMemStore.cashbook_categories.values()),
      cashbook_parties: Array.from(inMemStore.cashbook_parties.values()),
      cashbook_vouchers: Array.from(inMemStore.cashbook_vouchers.values()),
      cashbook_movements: Array.from(inMemStore.cashbook_movements.values()),
      cashbook_sequences: Array.from(inMemStore.cashbook_sequences.values()),
      cashbook_audit_events: Array.from(inMemStore.cashbook_audit_events.values()),
    };
  }

  const tx = db.transaction(
    ['money_accounts', 'cashbook_categories', 'cashbook_parties', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_sequences', 'cashbook_audit_events'],
    'readonly'
  );

  const [money_accounts, cashbook_categories, cashbook_parties, cashbook_vouchers, cashbook_movements, cashbook_sequences, cashbook_audit_events] =
    await Promise.all([
      reqToPromise(tx.objectStore('money_accounts').getAll()),
      reqToPromise(tx.objectStore('cashbook_categories').getAll()),
      reqToPromise(tx.objectStore('cashbook_parties').getAll()),
      reqToPromise(tx.objectStore('cashbook_vouchers').getAll()),
      reqToPromise(tx.objectStore('cashbook_movements').getAll()),
      reqToPromise(tx.objectStore('cashbook_sequences').getAll()),
      reqToPromise(tx.objectStore('cashbook_audit_events').getAll()),
    ]);

  await txToPromise(tx);

  return {
    money_accounts,
    cashbook_categories,
    cashbook_parties,
    cashbook_vouchers,
    cashbook_movements,
    cashbook_sequences,
    cashbook_audit_events,
  };
}

export async function restoreWebCashbookTables(data: {
  money_accounts?: MoneyAccount[];
  cashbook_categories?: CashbookCategory[];
  cashbook_parties?: CashbookParty[];
  cashbook_vouchers?: CashbookVoucher[];
  cashbook_movements?: CashbookMovement[];
  cashbook_sequences?: CashbookSequenceRecord[];
  cashbook_audit_events?: CashbookAuditEventRecord[];
}): Promise<void> {
  const db = await openWebDb();
  if (!db) {
    inMemStore = {
      money_accounts: new Map((data.money_accounts || []).map((a) => [a.id, a])),
      cashbook_categories: new Map((data.cashbook_categories || []).map((c) => [c.id, c])),
      cashbook_parties: new Map((data.cashbook_parties || []).map((p) => [p.id, p])),
      cashbook_vouchers: new Map((data.cashbook_vouchers || []).map((v) => [v.id, v])),
      cashbook_movements: new Map((data.cashbook_movements || []).map((m) => [m.id, m])),
      cashbook_sequences: new Map((data.cashbook_sequences || []).map((s) => [s.sequence_key, s])),
      cashbook_audit_events: new Map((data.cashbook_audit_events || []).map((a) => [a.id, a])),
    };
    return;
  }

  const tx = db.transaction(
    ['money_accounts', 'cashbook_categories', 'cashbook_parties', 'cashbook_vouchers', 'cashbook_movements', 'cashbook_sequences', 'cashbook_audit_events'],
    'readwrite'
  );

  const accStore = tx.objectStore('money_accounts');
  const catStore = tx.objectStore('cashbook_categories');
  const ptyStore = tx.objectStore('cashbook_parties');
  const vchStore = tx.objectStore('cashbook_vouchers');
  const movStore = tx.objectStore('cashbook_movements');
  const seqStore = tx.objectStore('cashbook_sequences');
  const audStore = tx.objectStore('cashbook_audit_events');

  accStore.clear();
  catStore.clear();
  ptyStore.clear();
  vchStore.clear();
  movStore.clear();
  seqStore.clear();
  audStore.clear();

  for (const a of data.money_accounts || []) accStore.put(a);
  for (const c of data.cashbook_categories || []) catStore.put(c);
  for (const p of data.cashbook_parties || []) ptyStore.put(p);
  for (const v of data.cashbook_vouchers || []) vchStore.put(v);
  for (const m of data.cashbook_movements || []) movStore.put(m);
  for (const s of data.cashbook_sequences || []) seqStore.put(s);
  for (const a of data.cashbook_audit_events || []) audStore.put(a);

  await txToPromise(tx);
}
