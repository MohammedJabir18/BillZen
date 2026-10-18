-- V4 Catalog Enhancement Migration for BillZen
-- Adds minimal category relationship, minimum stock threshold to products,
-- and address/country fields to customers.

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name COLLATE NOCASE);

-- 2. Enhance Products Table
ALTER TABLE products ADD COLUMN min_stock_threshold_scaled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 3. Enhance Customers Table
ALTER TABLE customers ADD COLUMN country TEXT NOT NULL DEFAULT 'IND';
ALTER TABLE customers ADD COLUMN address_line2 TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
