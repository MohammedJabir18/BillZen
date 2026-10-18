-- V5 Category Name Case-Insensitive Uniqueness & Legacy Reconciliation for BillZen
-- 1. Creates audit table category_merges to preserve lineage of merged duplicate categories.
-- 2. Transactionally reconciles any legacy case-variant duplicates to the earliest canonical category.
-- 3. Repoints all product foreign keys to the canonical category.
-- 4. Preserves non-empty category descriptions into the canonical category.
-- 5. Removes duplicate category rows.
-- 6. Enforces unique index on categories(name COLLATE NOCASE).

CREATE TABLE IF NOT EXISTS category_merges (
    merged_category_id TEXT PRIMARY KEY NOT NULL,
    canonical_category_id TEXT NOT NULL,
    merged_name TEXT NOT NULL,
    merged_description TEXT,
    merged_at INTEGER NOT NULL
);

-- Record duplicate -> canonical mapping (canonical has earliest created_at, tie-break MIN(id))
INSERT OR IGNORE INTO category_merges (merged_category_id, canonical_category_id, merged_name, merged_description, merged_at)
WITH Ranked AS (
    SELECT 
        id,
        name,
        description,
        FIRST_VALUE(id) OVER (
            PARTITION BY name COLLATE NOCASE 
            ORDER BY created_at ASC, id ASC
        ) as canonical_id
    FROM categories
)
SELECT 
    id, 
    canonical_id, 
    name, 
    description, 
    strftime('%s', 'now') * 1000
FROM Ranked
WHERE id != canonical_id;

-- Repoint products referencing merged duplicate categories to the canonical category
WITH Ranked AS (
    SELECT 
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY name COLLATE NOCASE 
            ORDER BY created_at ASC, id ASC
        ) as canonical_id
    FROM categories
)
UPDATE products
SET category_id = (
    SELECT canonical_id FROM Ranked WHERE Ranked.id = products.category_id
)
WHERE category_id IN (
    SELECT id FROM Ranked WHERE id != canonical_id
);

-- Preserve description: if canonical category has no description, inherit from duplicate
WITH MergedWithDesc AS (
    SELECT 
        canonical_category_id,
        merged_description
    FROM category_merges
    WHERE merged_description IS NOT NULL AND trim(merged_description) != ''
)
UPDATE categories
SET description = (
    SELECT merged_description FROM MergedWithDesc 
    WHERE MergedWithDesc.canonical_category_id = categories.id
    LIMIT 1
)
WHERE (description IS NULL OR trim(description) = '')
  AND id IN (SELECT canonical_category_id FROM MergedWithDesc);

-- Delete merged duplicate categories
DELETE FROM categories
WHERE id IN (SELECT merged_category_id FROM category_merges);

-- Replace legacy non-unique index with unique case-insensitive index
DROP INDEX IF EXISTS idx_categories_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_nocase ON categories(name COLLATE NOCASE);
