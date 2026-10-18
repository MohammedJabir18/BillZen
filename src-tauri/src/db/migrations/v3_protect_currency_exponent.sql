-- Migration 3: Protect snapshot_currency_exponent on finalized invoices
-- In v2, snapshot_currency_exponent was added to invoices, but the immutability trigger
-- was not updated to guard it. This migration replaces trg_prevent_finalized_invoice_update
-- to ensure snapshot_currency_exponent cannot be mutated once finalized.

DROP TRIGGER IF EXISTS trg_prevent_finalized_invoice_update;

CREATE TRIGGER trg_prevent_finalized_invoice_update
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
          OR NEW.snapshot_currency_exponent IS NOT OLD.snapshot_currency_exponent
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
