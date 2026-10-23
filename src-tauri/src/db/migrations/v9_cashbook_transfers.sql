-- V9: Atomic transfer headers; existing vouchers/movements remain authoritative.
CREATE TABLE cashbook_transfers (
  id TEXT PRIMARY KEY NOT NULL,
  transfer_number TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  payload_hash TEXT NOT NULL,
  from_account_id TEXT NOT NULL REFERENCES money_accounts(id) ON DELETE RESTRICT,
  to_account_id TEXT NOT NULL REFERENCES money_accounts(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0 AND amount_minor <= 100000000000),
  business_date TEXT NOT NULL,
  out_voucher_id TEXT UNIQUE NOT NULL REFERENCES cashbook_vouchers(id) ON DELETE RESTRICT,
  in_voucher_id TEXT UNIQUE NOT NULL REFERENCES cashbook_vouchers(id) ON DELETE RESTRICT,
  reference_note TEXT,
  notes TEXT,
  currency_code_snap TEXT NOT NULL,
  currency_exponent_snap INTEGER NOT NULL CHECK(currency_exponent_snap IN (2,3)),
  created_at INTEGER NOT NULL,
  posted_at INTEGER NOT NULL,
  is_reversal INTEGER NOT NULL DEFAULT 0 CHECK(is_reversal IN (0,1)),
  reversal_for_transfer_id TEXT UNIQUE REFERENCES cashbook_transfers(id) ON DELETE RESTRICT,
  is_reversed INTEGER NOT NULL DEFAULT 0 CHECK(is_reversed IN (0,1)),
  reversed_by_transfer_id TEXT UNIQUE REFERENCES cashbook_transfers(id) ON DELETE RESTRICT,
  reversed_at INTEGER,
  CHECK(from_account_id <> to_account_id),
  CHECK(out_voucher_id <> in_voucher_id),
  CHECK((is_reversal=0 AND reversal_for_transfer_id IS NULL) OR (is_reversal=1 AND reversal_for_transfer_id IS NOT NULL)),
  CHECK((is_reversed=0 AND reversed_by_transfer_id IS NULL AND reversed_at IS NULL) OR (is_reversed=1 AND reversed_by_transfer_id IS NOT NULL AND reversed_at IS NOT NULL))
);
CREATE INDEX idx_transfers_from_date ON cashbook_transfers(from_account_id,business_date);
CREATE INDEX idx_transfers_to_date ON cashbook_transfers(to_account_id,business_date);
CREATE TRIGGER trg_transfer_validate_insert BEFORE INSERT ON cashbook_transfers BEGIN
 SELECT CASE WHEN NEW.is_reversed<>0 OR NEW.reversed_by_transfer_id IS NOT NULL OR NEW.reversed_at IS NOT NULL THEN RAISE(ABORT,'New transfer must be unreversed') END;
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM cashbook_vouchers o JOIN cashbook_vouchers i
 WHERE o.id=NEW.out_voucher_id AND i.id=NEW.in_voucher_id
 AND o.account_id=NEW.from_account_id AND i.account_id=NEW.to_account_id
 AND o.status='posted' AND i.status='posted'
 AND o.direction='outflow' AND i.direction='inflow'
 AND o.voucher_number=NEW.transfer_number || '-OUT' AND i.voucher_number=NEW.transfer_number || '-IN'
 AND o.classification='transfer' AND i.classification='transfer'
 AND o.party_id IS NULL AND i.party_id IS NULL AND o.category_id IS NULL AND i.category_id IS NULL
 AND o.amount_minor=NEW.amount_minor AND i.amount_minor=NEW.amount_minor
 AND o.business_date=NEW.business_date AND i.business_date=NEW.business_date
 AND o.currency_code_snap=NEW.currency_code_snap AND i.currency_code_snap=NEW.currency_code_snap
 AND o.currency_exponent_snap=NEW.currency_exponent_snap AND i.currency_exponent_snap=NEW.currency_exponent_snap
 AND o.is_reversal=NEW.is_reversal AND i.is_reversal=NEW.is_reversal
 AND (SELECT COUNT(*) FROM cashbook_movements m WHERE m.voucher_id=o.id)=1
 AND EXISTS (SELECT 1 FROM cashbook_movements m WHERE m.voucher_id=o.id AND m.account_id=o.account_id AND m.amount_minor=-NEW.amount_minor)
 AND (SELECT COUNT(*) FROM cashbook_movements m WHERE m.voucher_id=i.id)=1
 AND EXISTS (SELECT 1 FROM cashbook_movements m WHERE m.voucher_id=i.id AND m.account_id=i.account_id AND m.amount_minor=NEW.amount_minor)
 ) THEN RAISE(ABORT,'Invalid transfer voucher pair') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cashbook_transfers t WHERE t.out_voucher_id IN (NEW.out_voucher_id,NEW.in_voucher_id) OR t.in_voucher_id IN (NEW.out_voucher_id,NEW.in_voucher_id)) THEN RAISE(ABORT,'Transfer leg already owned') END;
 SELECT CASE WHEN NEW.is_reversal=1 AND NOT EXISTS (
 SELECT 1 FROM cashbook_transfers original
 WHERE original.id=NEW.reversal_for_transfer_id AND original.is_reversal=0 AND original.is_reversed=0
 AND original.from_account_id=NEW.to_account_id AND original.to_account_id=NEW.from_account_id
 AND original.amount_minor=NEW.amount_minor AND original.currency_code_snap=NEW.currency_code_snap
 AND original.currency_exponent_snap=NEW.currency_exponent_snap
 AND EXISTS(SELECT 1 FROM cashbook_vouchers v WHERE v.id=NEW.out_voucher_id AND v.reversal_for_voucher_id=original.in_voucher_id)
 AND EXISTS(SELECT 1 FROM cashbook_vouchers v WHERE v.id=NEW.in_voucher_id AND v.reversal_for_voucher_id=original.out_voucher_id)
 ) THEN RAISE(ABORT,'Invalid transfer reversal pair') END;
END;
CREATE TRIGGER trg_transfer_no_delete BEFORE DELETE ON cashbook_transfers BEGIN
 SELECT RAISE(ABORT,'Cannot delete posted transfer');
END;
CREATE TRIGGER trg_transfer_immutable BEFORE UPDATE ON cashbook_transfers BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.transfer_number IS NOT OLD.transfer_number OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.payload_hash IS NOT OLD.payload_hash OR NEW.from_account_id IS NOT OLD.from_account_id OR NEW.to_account_id IS NOT OLD.to_account_id OR NEW.amount_minor IS NOT OLD.amount_minor OR NEW.business_date IS NOT OLD.business_date OR NEW.out_voucher_id IS NOT OLD.out_voucher_id OR NEW.in_voucher_id IS NOT OLD.in_voucher_id OR NEW.reference_note IS NOT OLD.reference_note OR NEW.notes IS NOT OLD.notes OR NEW.currency_code_snap IS NOT OLD.currency_code_snap OR NEW.currency_exponent_snap IS NOT OLD.currency_exponent_snap OR NEW.created_at IS NOT OLD.created_at OR NEW.posted_at IS NOT OLD.posted_at OR NEW.is_reversal IS NOT OLD.is_reversal OR NEW.reversal_for_transfer_id IS NOT OLD.reversal_for_transfer_id THEN RAISE(ABORT,'Cannot modify posted transfer fields') END;
 SELECT CASE WHEN OLD.is_reversed=1 OR OLD.is_reversal=1 OR NEW.is_reversed<>1
 OR NOT EXISTS(SELECT 1 FROM cashbook_transfers r WHERE r.id=NEW.reversed_by_transfer_id AND r.is_reversal=1 AND r.reversal_for_transfer_id=OLD.id)
 THEN RAISE(ABORT,'Invalid transfer reversal transition') END;
END;

-- V8 intentionally exempts transfer from the ordinary movement guard; close that gap.
CREATE TRIGGER trg_transfer_single_movement BEFORE INSERT ON cashbook_movements
WHEN EXISTS(SELECT 1 FROM cashbook_vouchers v WHERE v.id=NEW.voucher_id AND v.classification='transfer')
 AND EXISTS(SELECT 1 FROM cashbook_movements m WHERE m.voucher_id=NEW.voucher_id)
BEGIN SELECT RAISE(ABORT,'Transfer voucher must have exactly one movement'); END;
