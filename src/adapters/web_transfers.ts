import { workspaceTransaction } from './web_workspace';
import { MAX_TOTAL_MINOR } from './web_cashbook_db';
import { normalizeTransferIntent, transferIntentHash, TRANSFER_INTERNAL_PREFIX } from '../domain/transfers';
import { getTodayBusinessDate } from '../domain/financial';
import type { CashbookTransfer, CreateTransferInput, ReverseTransferInput, TransferFilter, TransferResult } from '../types/transfers';
import type { CashbookVoucher, MoneyAccount } from '../types/cashbook';

type Tables = Record<string, any[]>;

export async function postWebTransfer(input: CreateTransferInput): Promise<TransferResult> {
  const intent = normalizeTransferIntent(input);
  // Finish asynchronous crypto before opening IndexedDB's synchronous transaction callback.
  const hash = await transferIntentHash(input);
  let changed = false;
  return workspaceTransaction(true, tables => {
    const existing = tables.cashbook_transfers.find(t => t.idempotency_key === input.idempotency_key.trim());
    if (existing) {
      if (existing.payload_hash !== hash) throw Error('Idempotency key conflict');
      return { status: 'posted', transfer: existing };
    }
    const result = writePair(tables, { ...intent, idempotency_key: input.idempotency_key.trim() }, hash, Boolean(input.confirmed_negative_balance));
    changed = result.status === 'posted';
    return result;
  }, () => changed);
}

export async function reverseWebTransfer(input: ReverseTransferInput): Promise<TransferResult> {
  let changed = false;
  return workspaceTransaction(true, tables => {
    const old = tables.cashbook_transfers.find(t => t.id === input.transfer_id.trim()) as CashbookTransfer | undefined;
    if (!old) throw Error('Transfer not found');
    if (old.is_reversal) throw Error('Cannot reverse a reversal transfer');
    if (old.is_reversed) {
      const reverse = tables.cashbook_transfers.find(t => t.id === old.reversed_by_transfer_id);
      if (!reverse) throw Error('Missing reversal transfer');
      return { status: 'posted', transfer: reverse };
    }
    const settings = tables.business_settings[0];
    if (!settings) throw Error('Save business settings before transferring money');
    const result = writePair(tables, {
      idempotency_key: `${TRANSFER_INTERNAL_PREFIX}reverse:${old.id}`,
      from_account_id: old.to_account_id, to_account_id: old.from_account_id,
      amount_minor: old.amount_minor, business_date: getTodayBusinessDate(settings.timezone),
      reference_note: old.reference_note, notes: old.notes,
    }, 'reversal', Boolean(input.confirmed_negative_balance), old);
    changed = result.status === 'posted';
    return result;
  }, () => changed);
}

export async function getWebTransfers(filter: TransferFilter = {}): Promise<CashbookTransfer[]> {
  return workspaceTransaction(false, t => t.cashbook_transfers.filter(row =>
    (!filter.account_id || [row.from_account_id, row.to_account_id].includes(filter.account_id)) &&
    (!filter.start_date || row.business_date >= filter.start_date) &&
    (!filter.end_date || row.business_date <= filter.end_date))
    .sort((a, b) => a.business_date.localeCompare(b.business_date) || a.posted_at - b.posted_at || a.id.localeCompare(b.id)));
}

function writePair(t: Tables, i: CreateTransferInput, hash: string, confirmed: boolean, old?: CashbookTransfer): TransferResult {
  const settings = t.business_settings[0];
  if (!settings) throw Error('Save business settings before transferring money');
  const account = (id: string): MoneyAccount => {
    const a = t.money_accounts.find(a => a.id === id);
    if (!a || a.is_archived) throw Error('Account missing or archived');
    if (a.currency_code !== settings.currency_code || a.currency_exponent !== settings.currency_exponent) throw Error('Account currency mismatch');
    return a;
  };
  const from = account(i.from_account_id), to = account(i.to_account_id);
  if (old && (old.currency_code_snap !== settings.currency_code || old.currency_exponent_snap !== settings.currency_exponent)) throw Error('Historical currency mismatch');
  const balance = (a: MoneyAccount) => t.cashbook_movements.filter(m => m.account_id === a.id)
    .reduce((sum, m) => sum + BigInt(m.amount_minor), BigInt(a.opening_balance_minor));
  const current = balance(from), projected = current - BigInt(i.amount_minor), destination = balance(to) + BigInt(i.amount_minor);
  for (const value of [projected, destination]) if (value < -BigInt(MAX_TOTAL_MINOR) || value > BigInt(MAX_TOTAL_MINOR)) throw Error('Balance exceeds maximum');
  if (projected < 0n && !from.allow_negative_balance && !confirmed) return {
    status: 'requires_confirmation', account_id: from.id, current_balance_minor: Number(current),
    projected_balance_minor: Number(projected), amount_minor: i.amount_minor, message: 'Transfer would make source account negative',
  };
  const now = Date.now(), id = crypto.randomUUID(), outId = crypto.randomUUID(), inId = crypto.randomUUID();
  const prefix = old ? 'TRF-REV' : 'TRF', ym = i.business_date.replace(/-/g, '').slice(0, 6), sequenceKey = `${prefix}-${ym}`;
  let sequence = t.cashbook_sequences.find(s => s.sequence_key === sequenceKey);
  if (!sequence) t.cashbook_sequences.push(sequence = { sequence_key: sequenceKey, current_number: 0, updated_at: now });
  if (!Number.isSafeInteger(sequence.current_number + 1)) throw Error('Sequence overflow');
  sequence.current_number++; sequence.updated_at = now;
  const number = `${sequenceKey}-${String(sequence.current_number).padStart(5, '0')}`;
  let movementSequence = t.cashbook_movements.reduce((max, m) => Math.max(max, m.sequence_number), 0);
  for (const [legId, a, direction, suffix, delta, originalId] of [
    [outId, from, 'outflow', 'OUT', -i.amount_minor, old?.in_voucher_id],
    [inId, to, 'inflow', 'IN', i.amount_minor, old?.out_voucher_id],
  ] as const) {
    const original = originalId ? t.cashbook_vouchers.find(v => v.id === originalId) : null;
    if (originalId && !original) throw Error('Missing original transfer leg');
    const snapshots = original || {
      business_name_snap: settings.business_name, business_tax_id_snap: settings.tax_identifier ?? null,
      business_address_snap: `${settings.address_line1 || ''}\n${settings.address_line2 || ''}\n${settings.city || ''} ${settings.state || ''} ${settings.postal_code || ''}\n${settings.country || ''}`.trim(),
      business_phone_snap: settings.phone ?? null, account_name_snap: a.account_name,
      currency_code_snap: settings.currency_code, currency_exponent_snap: settings.currency_exponent,
      amount_in_words_snap: null,
    };
    const voucher: CashbookVoucher = {
      id: legId, voucher_number: `${number}-${suffix}`, idempotency_key: `${TRANSFER_INTERNAL_PREFIX}${id}:${suffix}`, payload_hash: hash,
      account_id: a.id, party_id: null, category_id: null, direction, classification: 'transfer', payment_method: 'bank_transfer',
      amount_minor: i.amount_minor, business_date: i.business_date, status: 'posted', is_reversal: Boolean(old),
      reversal_for_voucher_id: originalId || null, is_reversed: false, reversed_by_voucher_id: null, reversed_at: null,
      reference_note: i.reference_note ?? null, notes: i.notes ?? null,
      business_name_snap: snapshots.business_name_snap, business_tax_id_snap: snapshots.business_tax_id_snap,
      business_address_snap: snapshots.business_address_snap, business_phone_snap: snapshots.business_phone_snap,
      party_name_snap: null, party_phone_snap: null, party_tax_id_snap: null, party_address_snap: null,
      account_name_snap: snapshots.account_name_snap, currency_code_snap: snapshots.currency_code_snap,
      currency_exponent_snap: snapshots.currency_exponent_snap, amount_in_words_snap: snapshots.amount_in_words_snap,
      created_at: now, posted_at: now,
    };
    t.cashbook_vouchers.push(voucher);
    if (!Number.isSafeInteger(++movementSequence)) throw Error('Movement sequence overflow');
    t.cashbook_movements.push({ id: crypto.randomUUID(), voucher_id: legId, account_id: a.id, amount_minor: delta,
      business_date: i.business_date, sequence_number: movementSequence, created_at: now });
    if (original) { original.is_reversed = true; original.reversed_by_voucher_id = legId; original.reversed_at = now; }
  }
  const transfer: CashbookTransfer = {
    id, transfer_number: number, idempotency_key: i.idempotency_key, payload_hash: hash,
    from_account_id: from.id, to_account_id: to.id, amount_minor: i.amount_minor, business_date: i.business_date,
    out_voucher_id: outId, in_voucher_id: inId, reference_note: i.reference_note ?? null, notes: i.notes ?? null,
    currency_code_snap: settings.currency_code, currency_exponent_snap: settings.currency_exponent, created_at: now, posted_at: now,
    is_reversal: Boolean(old), reversal_for_transfer_id: old?.id || null, is_reversed: false, reversed_by_transfer_id: null, reversed_at: null,
  };
  t.cashbook_transfers.push(transfer);
  if (old) { old.is_reversed = true; old.reversed_by_transfer_id = id; old.reversed_at = now; }
  const audit = (event_type: string, voucher_id: string | null, details: object) => t.cashbook_audit_events.push({
    id: crypto.randomUUID(), voucher_id, event_type, details_json: JSON.stringify(details), created_at: now,
  });
  audit(old ? 'transfer_reversed' : 'transfer_posted', null, { transfer_id: id, confirmed_negative_balance: projected < 0n && !from.allow_negative_balance && confirmed,
    current_balance_minor: Number(current), projected_balance_minor: Number(projected) });
  if (projected < 0n && !from.allow_negative_balance && confirmed) audit('negative_balance_confirmed', outId, {
    transfer_id: id, account_id: from.id, amount_minor: i.amount_minor, current_balance_minor: Number(current), projected_balance_minor: Number(projected),
  });
  return { status: 'posted', transfer };
}
