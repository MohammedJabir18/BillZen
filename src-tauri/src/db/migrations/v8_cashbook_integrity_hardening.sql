-- Migration 8: Cashbook Integrity Hardening & Authoritative Protection
-- Strengthens voucher immutability, reversal linkage validity, movement agreement, and audit trail protection.

-- 1. Drop previous triggers to be replaced with hardened implementations
DROP TRIGGER IF EXISTS trg_prevent_posted_voucher_update;
DROP TRIGGER IF EXISTS trg_prevent_posted_voucher_delete;
DROP TRIGGER IF EXISTS trg_prevent_cashbook_movement_update;
DROP TRIGGER IF EXISTS trg_prevent_cashbook_movement_delete;
DROP TRIGGER IF EXISTS trg_cashbook_prevent_opening_balance_update_when_movements_exist;
DROP TRIGGER IF EXISTS trg_business_settings_prevent_currency_change_when_cashbook_records_exist;

-- 2. Hardened posted voucher immutability and reversal linkage trigger
CREATE TRIGGER IF NOT EXISTS trg_prevent_posted_voucher_update
BEFORE UPDATE ON cashbook_vouchers
FOR EACH ROW
WHEN OLD.status = 'posted'
BEGIN
    -- Forbid any change to status (cannot downgrade to draft or any other state)
    SELECT CASE
        WHEN NEW.status IS NOT 'posted'
        THEN RAISE(ABORT, 'Cannot change status of a posted voucher')
    END;

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

    -- If transitioning from unreversed to reversed, validate reversal linkage
    SELECT CASE
        WHEN OLD.is_reversed = 0 AND NEW.is_reversed = 1 THEN
            CASE
                WHEN NEW.reversed_by_voucher_id IS NULL OR NEW.reversed_at IS NULL
                THEN RAISE(ABORT, 'Reversal linkage requires non-null reversed_by_voucher_id and reversed_at')
                WHEN NOT EXISTS (
                    SELECT 1 FROM cashbook_vouchers v
                    WHERE v.id = NEW.reversed_by_voucher_id
                      AND v.is_reversal = 1
                      AND v.reversal_for_voucher_id = OLD.id
                )
                THEN RAISE(ABORT, 'Invalid reversal linkage: reversed_by_voucher_id must reference a valid linked reversal voucher')
            END
    END;

    -- Forbid setting reversal metadata on unreversed voucher
    SELECT CASE
        WHEN OLD.is_reversed = 0 AND NEW.is_reversed = 0
             AND (NEW.reversed_by_voucher_id IS NOT NULL OR NEW.reversed_at IS NOT NULL)
        THEN RAISE(ABORT, 'Cannot set reversal metadata on unreversed voucher')
    END;

    -- Forbid modifying ANY financial, snapshot, party, date, or identity attributes
    SELECT CASE
        WHEN NEW.id IS NOT OLD.id
          OR NEW.voucher_number IS NOT OLD.voucher_number
          OR NEW.idempotency_key IS NOT OLD.idempotency_key
          OR NEW.payload_hash IS NOT OLD.payload_hash
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
          OR NEW.reference_note IS NOT OLD.reference_note
          OR NEW.notes IS NOT OLD.notes
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
          OR NEW.created_at IS NOT OLD.created_at
          OR NEW.posted_at IS NOT OLD.posted_at
        THEN RAISE(ABORT, 'Cannot modify posted financial or snapshot fields of a voucher')
    END;
END;

-- 3. Prevent deletion of posted vouchers
CREATE TRIGGER IF NOT EXISTS trg_prevent_posted_voucher_delete
BEFORE DELETE ON cashbook_vouchers
FOR EACH ROW
WHEN OLD.status = 'posted'
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete posted cashbook vouchers');
END;

-- 4. Prevent updates to cashbook movements
CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_movement_update
BEFORE UPDATE ON cashbook_movements
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot update cashbook movements');
END;

-- 5. Prevent deletions from cashbook movements
CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_movement_delete
BEFORE DELETE ON cashbook_movements
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete cashbook movements');
END;

-- 6. Validate movement insertion: agreement with voucher and single movement per C1 voucher
CREATE TRIGGER IF NOT EXISTS trg_validate_cashbook_movement_insert
BEFORE INSERT ON cashbook_movements
FOR EACH ROW
BEGIN
    -- Ensure parent voucher exists
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM cashbook_vouchers WHERE id = NEW.voucher_id)
        THEN RAISE(ABORT, 'Cannot insert movement: parent voucher does not exist')
    END;

    -- Enforce agreement between voucher and movement
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM cashbook_vouchers v
            WHERE v.id = NEW.voucher_id
              AND (
                v.account_id != NEW.account_id
                OR v.business_date != NEW.business_date
                OR ABS(NEW.amount_minor) != v.amount_minor
                OR (v.direction = 'inflow' AND NEW.amount_minor <= 0)
                OR (v.direction = 'outflow' AND NEW.amount_minor >= 0)
              )
        )
        THEN RAISE(ABORT, 'Movement details (account, date, amount, sign) must agree with voucher')
    END;

    -- Enforce one-voucher/one-movement for C1 vouchers (classification != 'transfer')
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM cashbook_vouchers v
            WHERE v.id = NEW.voucher_id
              AND v.classification != 'transfer'
              AND EXISTS (SELECT 1 FROM cashbook_movements WHERE voucher_id = NEW.voucher_id)
        )
        THEN RAISE(ABORT, 'Multiple movements for a single C1 voucher are prohibited')
    END;
END;

-- 7. Protect audit events history from any modification or deletion
CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_audit_event_update
BEFORE UPDATE ON cashbook_audit_events
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot update cashbook audit events');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_cashbook_audit_event_delete
BEFORE DELETE ON cashbook_audit_events
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete cashbook audit events');
END;

-- 8. Prevent changing opening balance or currency when movements exist
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

-- 9. Prevent base currency change when cashbook records or movements exist
CREATE TRIGGER IF NOT EXISTS trg_business_settings_prevent_currency_change_when_cashbook_records_exist
BEFORE UPDATE OF currency_code, currency_exponent ON business_settings
FOR EACH ROW
WHEN (NEW.currency_code IS NOT OLD.currency_code OR NEW.currency_exponent IS NOT OLD.currency_exponent)
  AND (
    EXISTS (SELECT 1 FROM cashbook_vouchers WHERE status = 'posted') OR
    EXISTS (SELECT 1 FROM money_accounts WHERE opening_balance_minor != 0) OR
    EXISTS (SELECT 1 FROM cashbook_movements)
  )
BEGIN
    SELECT RAISE(ABORT, 'Cannot change business base currency after cashbook vouchers or non-zero accounts exist');
END;
