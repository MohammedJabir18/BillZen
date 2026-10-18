-- V1 SQLite Schema for BillZen

-- Pragmas applied on connection setup:
-- PRAGMA foreign_keys = ON;
-- PRAGMA journal_mode = WAL;
-- PRAGMA synchronous = FULL;
-- PRAGMA busy_timeout = 5000;

-- 0. Migration Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    checksum TEXT NOT NULL
);

-- 1. Business Profile (Singleton Table)
CREATE TABLE IF NOT EXISTS business_settings (
    id TEXT PRIMARY KEY NOT NULL CHECK (id = 'default'),
    business_name TEXT NOT NULL,
    legal_name TEXT,
    tax_identifier TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'IND',
    currency_code TEXT NOT NULL DEFAULT 'INR',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    terms_and_conditions TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Products Catalog
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'unit',
    unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
    cost_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (cost_price_minor >= 0),
    tax_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bp >= 0 AND tax_rate_bp <= 10000),
    is_stock_tracked INTEGER NOT NULL DEFAULT 1 CHECK (is_stock_tracked IN (0, 1)),
    current_stock_scaled INTEGER NOT NULL DEFAULT 0 CHECK (current_stock_scaled >= 0 OR is_stock_tracked = 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);

-- 3. Customers Directory
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address_line1 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    tax_identifier TEXT,
    current_balance_minor INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name COLLATE NOCASE);

-- 4. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT UNIQUE,
    sequence_number INTEGER,
    idempotency_key TEXT UNIQUE,
    request_fingerprint TEXT,
    draft_version INTEGER NOT NULL DEFAULT 1 CHECK (draft_version >= 1),
    customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'finalized', 'cancelled')),
    settlement_status TEXT NOT NULL DEFAULT 'fully_paid' CHECK (settlement_status IN ('unpaid', 'partially_paid', 'fully_paid')),
    business_date TEXT NOT NULL,
    
    -- Immutable Business Snapshots
    business_name_snap TEXT,
    business_legal_name_snap TEXT,
    business_address_snap TEXT,
    business_phone_snap TEXT,
    business_email_snap TEXT,
    business_tax_id_snap TEXT,
    currency_code_snap TEXT,
    currency_symbol_snap TEXT,
    terms_snap TEXT,
    
    -- Immutable Customer Snapshots
    customer_name_snap TEXT,
    customer_phone_snap TEXT,
    customer_address_snap TEXT,
    customer_tax_id_snap TEXT,
    
    -- Commercial Financial Totals (Immutable)
    subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
    discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_total_minor >= 0),
    taxable_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (taxable_amount_minor >= 0),
    tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
    grand_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (grand_total_minor >= 0),
    
    -- Settlement State (Mutable via payments)
    paid_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
    balance_due_minor INTEGER NOT NULL DEFAULT 0 CHECK (balance_due_minor >= 0),
    
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    finalized_at INTEGER,
    
    -- Financial Invariants
    CHECK (paid_amount_minor <= grand_total_minor),
    CHECK (balance_due_minor = grand_total_minor - paid_amount_minor),
    CHECK (
        (grand_total_minor == 0 AND paid_amount_minor == 0 AND balance_due_minor == 0 AND settlement_status == 'fully_paid') OR
        (grand_total_minor > 0 AND paid_amount_minor == 0 AND settlement_status == 'unpaid') OR
        (grand_total_minor > 0 AND paid_amount_minor > 0 AND paid_amount_minor < grand_total_minor AND settlement_status == 'partially_paid') OR
        (grand_total_minor > 0 AND paid_amount_minor == grand_total_minor AND settlement_status == 'fully_paid')
    ),
    CHECK (status != 'finalized' OR (
        invoice_number IS NOT NULL AND
        business_name_snap IS NOT NULL AND
        finalized_at IS NOT NULL AND
        (balance_due_minor == 0 OR customer_id IS NOT NULL)
    ))
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_business_date ON invoices(business_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- 5. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
    line_number INTEGER NOT NULL,
    
    -- Product Snapshots
    product_name_snap TEXT NOT NULL,
    product_sku_snap TEXT NOT NULL,
    unit_snap TEXT NOT NULL,
    cost_price_minor_snap INTEGER NOT NULL DEFAULT 0,
    
    -- Financials & Quantities
    quantity_scaled INTEGER NOT NULL CHECK (quantity_scaled > 0),
    unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
    discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    taxable_minor INTEGER NOT NULL CHECK (taxable_minor >= 0),
    tax_rate_bp INTEGER NOT NULL CHECK (tax_rate_bp >= 0 AND tax_rate_bp <= 10000),
    tax_minor INTEGER NOT NULL CHECK (tax_minor >= 0),
    line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
    
    created_at INTEGER NOT NULL,
    UNIQUE (invoice_id, line_number),
    CHECK (line_total_minor = taxable_minor + tax_minor)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 6. Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    reference_type TEXT NOT NULL CHECK (reference_type IN ('opening', 'sale', 'adjustment', 'return')),
    reference_id TEXT,
    quantity_delta_scaled INTEGER NOT NULL,
    resulting_stock_scaled INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- 7. Payments & Allocations
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    payment_number TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'card', 'bank_transfer', 'other')),
    payment_date TEXT NOT NULL,
    reference_note TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id TEXT PRIMARY KEY NOT NULL,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    allocated_minor INTEGER NOT NULL CHECK (allocated_minor > 0),
    created_at INTEGER NOT NULL,
    UNIQUE (payment_id, invoice_id)
);

-- 8. Number Sequences
CREATE TABLE IF NOT EXISTS invoice_sequences (
    sequence_key TEXT PRIMARY KEY NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- 9. Expenses (Schema definition for future extension)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY NOT NULL,
    expense_category TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    expense_date TEXT NOT NULL,
    payment_mode TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL
);

-- TRIGGERS: COMMERCIAL IMMUTABILITY (SPLIT UPDATE AND DELETE)

-- Trigger 1: Protect finalized invoice commercial snapshot fields on UPDATE
CREATE TRIGGER IF NOT EXISTS trg_prevent_finalized_invoice_update
BEFORE UPDATE ON invoices
FOR EACH ROW
WHEN OLD.status = 'finalized'
BEGIN
    SELECT CASE
        WHEN NEW.invoice_number IS NOT OLD.invoice_number
          OR NEW.business_date IS NOT OLD.business_date
          OR NEW.finalized_at IS NOT OLD.finalized_at
          OR NEW.status IS NOT OLD.status
          OR NEW.customer_id IS NOT OLD.customer_id
          OR NEW.idempotency_key IS NOT OLD.idempotency_key
          OR NEW.request_fingerprint IS NOT OLD.request_fingerprint
          OR NEW.business_name_snap IS NOT OLD.business_name_snap
          OR NEW.business_legal_name_snap IS NOT OLD.business_legal_name_snap
          OR NEW.business_address_snap IS NOT OLD.business_address_snap
          OR NEW.business_phone_snap IS NOT OLD.business_phone_snap
          OR NEW.business_email_snap IS NOT OLD.business_email_snap
          OR NEW.business_tax_id_snap IS NOT OLD.business_tax_id_snap
          OR NEW.currency_code_snap IS NOT OLD.currency_code_snap
          OR NEW.currency_symbol_snap IS NOT OLD.currency_symbol_snap
          OR NEW.terms_snap IS NOT OLD.terms_snap
          OR NEW.customer_name_snap IS NOT OLD.customer_name_snap
          OR NEW.customer_phone_snap IS NOT OLD.customer_phone_snap
          OR NEW.customer_address_snap IS NOT OLD.customer_address_snap
          OR NEW.customer_tax_id_snap IS NOT OLD.customer_tax_id_snap
          OR NEW.subtotal_minor IS NOT OLD.subtotal_minor
          OR NEW.discount_total_minor IS NOT OLD.discount_total_minor
          OR NEW.taxable_amount_minor IS NOT OLD.taxable_amount_minor
          OR NEW.tax_total_minor IS NOT OLD.tax_total_minor
          OR NEW.grand_total_minor IS NOT OLD.grand_total_minor
        THEN RAISE(ABORT, 'Commercial data on finalized invoices is strictly immutable.')
    END;
END;

-- Trigger 2: Prevent deletion of finalized invoices
CREATE TRIGGER IF NOT EXISTS trg_prevent_finalized_invoice_delete
BEFORE DELETE ON invoices
FOR EACH ROW
WHEN OLD.status = 'finalized'
BEGIN
    SELECT RAISE(ABORT, 'Finalized invoices cannot be deleted.');
END;

-- Trigger 3: Prevent inserting line items into finalized invoices
CREATE TRIGGER IF NOT EXISTS trg_prevent_finalized_items_insert
BEFORE INSERT ON invoice_items
FOR EACH ROW
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) = 'finalized'
BEGIN
    SELECT RAISE(ABORT, 'Cannot insert line items into a finalized invoice.');
END;

-- Trigger 4: Prevent updating line items of finalized invoices or reassigning to a finalized invoice
CREATE TRIGGER IF NOT EXISTS trg_prevent_finalized_items_update
BEFORE UPDATE ON invoice_items
FOR EACH ROW
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) = 'finalized'
  OR (SELECT status FROM invoices WHERE id = NEW.invoice_id) = 'finalized'
BEGIN
    SELECT RAISE(ABORT, 'Line items on finalized invoices cannot be modified or reassigned.');
END;

-- Trigger 5: Prevent deleting line items from finalized invoices
CREATE TRIGGER IF NOT EXISTS trg_prevent_finalized_items_delete
BEFORE DELETE ON invoice_items
FOR EACH ROW
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) = 'finalized'
BEGIN
    SELECT RAISE(ABORT, 'Line items on finalized invoices cannot be deleted.');
END;
