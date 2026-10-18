-- Migration 6: Business Setup State, Appearance Preference, and Getting-Started Guide
-- Supports distinct states for first-run onboarding, appearance theme preference, and versioned guide status.

ALTER TABLE business_settings ADD COLUMN is_setup_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_settings ADD COLUMN appearance_preference TEXT NOT NULL DEFAULT 'system';
ALTER TABLE business_settings ADD COLUMN guide_status TEXT NOT NULL DEFAULT 'unseen';
ALTER TABLE business_settings ADD COLUMN guide_version INTEGER NOT NULL DEFAULT 1;

-- Conservative upgrade policy for existing installations:
-- If an existing database already has customized business settings, products, customers, invoices, categories, payments, or expenses,
-- automatically mark setup as completed and guide as completed so existing users are never forced through setup.
UPDATE business_settings
SET is_setup_completed = 1,
    guide_status = 'completed'
WHERE (
    business_name != 'My Retail Store'
    OR legal_name IS NOT NULL
    OR tax_identifier IS NOT NULL
    OR phone != '+91 9876543210'
    OR email IS NOT NULL
    OR address_line1 != '123 Market Road'
    OR address_line2 IS NOT NULL
    OR city != 'Kochi'
    OR state != 'Kerala'
    OR postal_code != '682001'
    OR (country != 'IND' AND country != 'India')
    OR currency_code != 'INR'
    OR timezone != 'Asia/Kolkata'
    OR invoice_prefix != 'INV'
    OR locale != 'en-IN'
    OR (terms_and_conditions IS NOT NULL AND terms_and_conditions != 'Thank you for your business!')
    OR EXISTS (SELECT 1 FROM products LIMIT 1)
    OR EXISTS (SELECT 1 FROM customers LIMIT 1)
    OR EXISTS (SELECT 1 FROM invoices LIMIT 1)
    OR EXISTS (SELECT 1 FROM categories LIMIT 1)
    OR EXISTS (SELECT 1 FROM payments LIMIT 1)
    OR EXISTS (SELECT 1 FROM expenses LIMIT 1)
);

