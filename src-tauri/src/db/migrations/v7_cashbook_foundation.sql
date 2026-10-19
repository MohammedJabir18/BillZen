-- Migration 7: Offline Company Cashbook Foundation
-- Supports money accounts, categories, parties, immutable vouchers, running ledger movements, sequences, and audit events.

-- 1. Money Accounts
CREATE TABLE IF NOT EXISTS money_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    account_name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'bank', 'wallet', 'other')),
    opening_balance_minor INTEGER NOT NULL DEFAULT 0,
    allow_negative_balance INTEGER NOT NULL DEFAULT 0 CHECK (allow_negative_balance IN (0, 1)),
    currency_code TEXT NOT NULL,
    currency_exponent INTEGER NOT NULL DEFAULT 2 CHECK (currency_exponent IN (2, 3)),
    bank_name TEXT,
    account_number TEXT,
    ifsc_or_routing TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_money_accounts_archived ON money_accounts(is_archived);

-- 2. Cashbook Categories
CREATE TABLE IF NOT EXISTS cashbook_categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'both')),
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_categories_type ON cashbook_categories(category_type);

-- 3. Cashbook Parties
CREATE TABLE IF NOT EXISTS cashbook_parties (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier', 'employee', 'owner', 'lender', 'other')),
    customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    phone TEXT,
    email TEXT,
    tax_id TEXT,
    address TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_parties_type ON cashbook_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_cashbook_parties_customer ON cashbook_parties(customer_id);

-- 4. Cashbook Vouchers
CREATE TABLE IF NOT EXISTS cashbook_vouchers (
    id TEXT PRIMARY KEY NOT NULL,
    voucher_number TEXT UNIQUE NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload_hash TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES money_accounts(id) ON DELETE RESTRICT,
    party_id TEXT REFERENCES cashbook_parties(id) ON DELETE RESTRICT,
    category_id TEXT REFERENCES cashbook_categories(id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
    classification TEXT NOT NULL CHECK (classification IN (
        'operating_income',
        'operating_expense',
        'capital',
        'loan',
        'advance',
        'refund',
        'transfer',
        'opening_balance'
    )),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    business_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
    is_reversal INTEGER NOT NULL DEFAULT 0 CHECK (is_reversal IN (0, 1)),
    reversal_for_voucher_id TEXT REFERENCES cashbook_vouchers(id) ON DELETE RESTRICT,
    is_reversed INTEGER NOT NULL DEFAULT 0 CHECK (is_reversed IN (0, 1)),
    reversed_by_voucher_id TEXT UNIQUE REFERENCES cashbook_vouchers(id) ON DELETE RESTRICT,
    reversed_at INTEGER,
    reference_note TEXT,
    notes TEXT,
    
    -- Immutable Historical Snapshots
    business_name_snap TEXT,
    business_tax_id_snap TEXT,
    business_address_snap TEXT,
    business_phone_snap TEXT,
    party_name_snap TEXT,
    party_phone_snap TEXT,
    party_tax_id_snap TEXT,
    party_address_snap TEXT,
    account_name_snap TEXT,
    currency_code_snap TEXT,
    currency_exponent_snap INTEGER NOT NULL DEFAULT 2,
    amount_in_words_snap TEXT,
    
    created_at INTEGER NOT NULL,
    posted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_vouchers_account ON cashbook_vouchers(account_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_vouchers_date ON cashbook_vouchers(business_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_vouchers_party ON cashbook_vouchers(party_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_vouchers_category ON cashbook_vouchers(category_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_vouchers_idempotency ON cashbook_vouchers(idempotency_key);

-- 5. Cashbook Ledger Movements
CREATE TABLE IF NOT EXISTS cashbook_movements (
    id TEXT PRIMARY KEY NOT NULL,
    voucher_id TEXT NOT NULL REFERENCES cashbook_vouchers(id) ON DELETE RESTRICT,
    account_id TEXT NOT NULL REFERENCES money_accounts(id) ON DELETE RESTRICT,
    amount_minor INTEGER NOT NULL CHECK (amount_minor != 0),
    business_date TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_movements_account_date ON cashbook_movements(account_id, business_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_movements_voucher ON cashbook_movements(voucher_id);

-- 6. Number Sequences
CREATE TABLE IF NOT EXISTS cashbook_sequences (
    sequence_key TEXT PRIMARY KEY NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- 7. Audit Events
CREATE TABLE IF NOT EXISTS cashbook_audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    voucher_id TEXT REFERENCES cashbook_vouchers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    details_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_audit_voucher ON cashbook_audit_events(voucher_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_audit_type ON cashbook_audit_events(event_type);

-- TRIGGERS & CONSTRAINTS

-- Trigger 1: Protect posted voucher immutability on UPDATE
-- Allows updating ONLY is_reversed, reversed_by_voucher_id, and reversed_at when unreversed -> reversed.
CREATE TRIGGER IF NOT EXISTS trg_prevent_posted_voucher_update
BEFORE UPDATE ON cashbook_vouchers
FOR EACH ROW
WHEN OLD.status = 'posted'
BEGIN
    -- Forbid reversing a voucher that is itself a reversal
    SELECT CASE
        WHEN OLD.is_reversal = 1 AND NEW.is_reversed = 1
        THEN RAISE(ABORT, 'Cannot reverse a reversal voucher')
    END;

    -- Forbid any modification if already reversed
    SELECT CASE
        WHEN OLD.is_reversed = 1
        THEN RAISE(ABORT, 'Cannot modify already reversed voucher')
    END;

    -- Forbid modifying any financial or snapshot attributes
    SELECT CASE
        WHEN NEW.id IS NOT OLD.id
          OR NEW.voucher_number IS NOT OLD.voucher_number
          OR NEW.account_id IS NOT OLD.account_id
          OR NEW.party_id IS NOT OLD.party_id
          OR NEW.category_id IS NOT OLD.category_id
          OR NEW.direction IS NOT OLD.direction
          OR NEW.classification IS NOT OLD.classification
          OR NEW.payment_method IS NOT OLD.payment_method
          OR NEW.amount_minor IS NOT OLD.amount_minor
          OR NEW.business_date IS NOT OLD.business_date
          OR NEW.is_reversal IS NOT OLD.is_reversal
          OR NEW.reversal_for_voucher_id IS NOT OLD.reversal_for_voucher_id
          OR NEW.business_name_snap IS NOT OLD.business_name_snap
          OR NEW.business_tax_id_snap IS NOT OLD.business_tax_id_snap
          OR NEW.business_address_snap IS NOT OLD.business_address_snap
          OR NEW.business_phone_snap IS NOT OLD.business_phone_snap
          OR NEW.party_name_snap IS NOT OLD.party_name_snap
          OR NEW.party_phone_snap IS NOT OLD.party_phone_snap
          OR NEW.party_tax_id_snap IS NOT OLD.party_tax_id_snap
          OR NEW.party_address_snap IS NOT OLD.party_address_snap
          OR NEW.account_name_snap IS NOT OLD.account_name_snap
          OR NEW.currency_code_snap IS NOT OLD.currency_code_snap
          OR NEW.currency_exponent_snap IS NOT OLD.currency_exponent_snap
          OR NEW.amount_in_words_snap IS NOT OLD.amount_in_words_snap
          OR NEW.posted_at IS NOT OLD.posted_at
        THEN RAISE(ABORT, 'Cannot modify posted financial or snapshot fields of a voucher')
    END;
END;

-- Trigger 2: Prevent deletion of posted vouchers
CREATE TRIGGER IF NOT EXISTS trg_prevent_posted_voucher_delete
BEFORE DELETE ON cashbook_vouchers
FOR EACH ROW
WHEN OLD.status = 'posted'
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete posted cashbook vouchers');
END;

-- Trigger 3: Prevent direct update of ledger movements
CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_movement_update
BEFORE UPDATE ON cashbook_movements
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot update cashbook movements');
END;

-- Trigger 4: Prevent direct deletion of ledger movements
CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_movement_delete
BEFORE DELETE ON cashbook_movements
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete cashbook movements');
END;

-- Trigger 5: Prevent changing opening balance or currency when movements exist
CREATE TRIGGER IF NOT EXISTS trg_cashbook_prevent_opening_balance_update_when_movements_exist
BEFORE UPDATE OF opening_balance_minor, currency_code, currency_exponent ON money_accounts
FOR EACH ROW
WHEN (NEW.opening_balance_minor IS NOT OLD.opening_balance_minor 
   OR NEW.currency_code IS NOT OLD.currency_code 
   OR NEW.currency_exponent IS NOT OLD.currency_exponent)
  AND EXISTS (SELECT 1 FROM cashbook_movements WHERE account_id = OLD.id)
BEGIN
    SELECT RAISE(ABORT, 'Cannot alter opening balance or currency of account with existing movements');
END;

-- Trigger 6: Prevent currency change when cashbook records or non-zero accounts exist
CREATE TRIGGER IF NOT EXISTS trg_business_settings_prevent_currency_change_when_cashbook_records_exist
BEFORE UPDATE OF currency_code, currency_exponent ON business_settings
FOR EACH ROW
WHEN (NEW.currency_code IS NOT OLD.currency_code OR NEW.currency_exponent IS NOT OLD.currency_exponent)
  AND (
    EXISTS (SELECT 1 FROM cashbook_vouchers WHERE status = 'posted') OR
    EXISTS (SELECT 1 FROM money_accounts WHERE opening_balance_minor != 0)
  )
BEGIN
    SELECT RAISE(ABORT, 'Cannot change business base currency after cashbook vouchers or non-zero accounts exist');
END;

-- Default Seed Categories
INSERT OR IGNORE INTO cashbook_categories (id, name, category_type, is_default, is_archived, created_at) VALUES
    ('cat-sales', 'Sales Revenue', 'income', 1, 0, 1729337400000),
    ('cat-services', 'Services & Consulting', 'income', 1, 0, 1729337400000),
    ('cat-rent', 'Rent & Facilities', 'expense', 1, 0, 1729337400000),
    ('cat-utilities', 'Utilities & Electricity', 'expense', 1, 0, 1729337400000),
    ('cat-salaries', 'Salaries & Wages', 'expense', 1, 0, 1729337400000),
    ('cat-supplies', 'Office Supplies', 'expense', 1, 0, 1729337400000),
    ('cat-capital', 'Owner Capital', 'both', 1, 0, 1729337400000),
    ('cat-loan', 'Loan & Finance', 'both', 1, 0, 1729337400000),
    ('cat-general', 'General Expenses', 'expense', 1, 0, 1729337400000);
