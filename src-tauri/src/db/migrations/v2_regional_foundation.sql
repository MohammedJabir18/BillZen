-- Migration 2: Regional Foundation for India and GCC
-- Supports multi-decimal currencies (2-decimal for INR, AED, SAR, QAR; 3-decimal for KWD, BHD, OMR)
-- Adds locale and currency exponent to business settings and invoice commercial snapshots

ALTER TABLE business_settings ADD COLUMN currency_exponent INTEGER NOT NULL DEFAULT 2;
ALTER TABLE business_settings ADD COLUMN locale TEXT NOT NULL DEFAULT 'en-IN';

ALTER TABLE invoices ADD COLUMN snapshot_currency_exponent INTEGER NOT NULL DEFAULT 2;

-- Prevent unsafe business base currency changes once finalized financial records exist
CREATE TRIGGER trg_business_settings_prevent_currency_change_when_invoices_exist
BEFORE UPDATE OF currency_code, currency_exponent ON business_settings
FOR EACH ROW
WHEN (NEW.currency_code IS NOT OLD.currency_code OR NEW.currency_exponent IS NOT OLD.currency_exponent)
  AND EXISTS (SELECT 1 FROM invoices WHERE status = 'finalized')
BEGIN
    SELECT RAISE(ABORT, 'Cannot change business base currency after finalized financial invoices exist');
END;
