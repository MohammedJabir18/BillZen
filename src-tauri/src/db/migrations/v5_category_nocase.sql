-- V5 Category Name Case-Insensitive Uniqueness Migration for BillZen
-- Enforces case-insensitive uniqueness on category names by replacing
-- the non-unique index with a UNIQUE index with COLLATE NOCASE.

DROP INDEX IF EXISTS idx_categories_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_nocase ON categories(name COLLATE NOCASE);
