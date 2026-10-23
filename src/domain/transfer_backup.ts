import { normalizeTransferIntent, transferIntentHash, TRANSFER_INTERNAL_PREFIX } from './transfers';
import type { CreateTransferInput } from '../types/transfers';

type Tables = Record<string, any>;
const snapshotFields = ['business_name_snap', 'business_tax_id_snap', 'business_address_snap', 'business_phone_snap', 'party_name_snap', 'party_phone_snap', 'party_tax_id_snap', 'party_address_snap', 'account_name_snap', 'currency_code_snap', 'currency_exponent_snap', 'amount_in_words_snap'];
const flag = (v: unknown): boolean => { if (![true, false, 0, 1].includes(v as any)) throw Error('Invalid transfer flag'); return Boolean(v); };
const same = (a: any, b: any) => (a ?? null) === (b ?? null);
const require = (ok: unknown, message: string) => { if (!ok) throw Error(`Invalid transfer backup: ${message}`); };

/** Validate the complete proposed graph before opening a replacement transaction. */
export function validateTransferWorkspace(d: Tables): void {
  const headers = d.cashbook_transfers;
  require(Array.isArray(headers), 'missing headers');
  const vouchers = new Map<string, any>(d.cashbook_vouchers.map((v: any) => [v.id, v]));
  const accounts = new Map<string, any>(d.money_accounts.map((a: any) => [a.id, a]));
  const transfers = new Map<string, any>(headers.map((h: any) => [h.id, h]));
  const owners = new Set<string>(), numbers = new Set<string>(), intents = new Set<string>();
  require(transfers.size === headers.length, 'duplicate header');
  for (const h of headers) {
    const reversal = flag(h.is_reversal), reversed = flag(h.is_reversed);
    require(typeof h.id === 'string' && h.id && !numbers.has(h.transfer_number) && !intents.has(h.idempotency_key), 'duplicate identity');
    numbers.add(h.transfer_number); intents.add(h.idempotency_key);
    const normalized = normalizeTransferIntent({ ...h, idempotency_key: reversal ? 'reversal-validation' : h.idempotency_key });
    for (const [key, value] of Object.entries(normalized)) require(same(h[key], value), 'noncanonical intent field');
    require(h.idempotency_key === h.idempotency_key.trim(), 'noncanonical retry key');
    require(h.currency_code_snap === d.business_settings.currency_code && h.currency_exponent_snap === d.business_settings.currency_exponent, 'header currency');
    const match = /^(TRF(?:-REV)?)-(\d{6})-(\d{5,})$/.exec(h.transfer_number);
    require(match && match[1] === (reversal ? 'TRF-REV' : 'TRF') && match[2] === h.business_date.replace(/-/g, '').slice(0, 6), 'header number');
    const seq = d.cashbook_sequences.find((s: any) => s.sequence_key === `${match![1]}-${match![2]}`);
    require(seq && Number.isSafeInteger(seq.current_number) && seq.current_number >= Number(match![3]) && Number(match![3]) > 0 && String(Number(match![3])).padStart(5, '0') === match![3], 'sequence floor');
    const out = vouchers.get(h.out_voucher_id), into = vouchers.get(h.in_voucher_id);
    for (const [leg, id, accountId, direction, suffix] of [[out, h.out_voucher_id, h.from_account_id, 'outflow', 'OUT'], [into, h.in_voucher_id, h.to_account_id, 'inflow', 'IN']]) {
      require(leg && !owners.has(id), 'missing or multiply owned leg'); owners.add(id);
      const a = accounts.get(accountId);
      require(a && a.currency_code === h.currency_code_snap && a.currency_exponent === h.currency_exponent_snap, 'account currency');
      require(leg.account_id === accountId && leg.direction === direction && leg.classification === 'transfer' && leg.status === 'posted' && leg.payment_method === 'bank_transfer' && leg.party_id == null && leg.category_id == null, 'leg role');
      require(leg.voucher_number === `${h.transfer_number}-${suffix}` && leg.idempotency_key === `${TRANSFER_INTERNAL_PREFIX}${h.id}:${suffix}` && leg.payload_hash === h.payload_hash, 'leg identity');
      for (const key of ['amount_minor', 'business_date', 'currency_code_snap', 'currency_exponent_snap', 'reference_note', 'notes']) require(same(leg[key], h[key]), 'leg/header mismatch');
      require(flag(leg.is_reversal) === reversal && flag(leg.is_reversed) === reversed && same(leg.reversed_at, h.reversed_at), 'half reversal');
      const movements = d.cashbook_movements.filter((m: any) => m.voucher_id === id);
      require(movements.length === 1 && movements[0].account_id === accountId && movements[0].business_date === h.business_date && movements[0].amount_minor === (direction === 'outflow' ? -h.amount_minor : h.amount_minor), 'movement');
    }
    for (const key of snapshotFields.filter(k => k !== 'account_name_snap')) require(same(out[key], into[key]), 'pair snapshots');
    if (reversal) {
      const original = transfers.get(h.reversal_for_transfer_id);
      require(original && !flag(original.is_reversal) && flag(original.is_reversed) && original.reversed_by_transfer_id === h.id && !reversed, 'reversal header link');
      require(h.idempotency_key === `${TRANSFER_INTERNAL_PREFIX}reverse:${original.id}` && h.payload_hash === 'reversal', 'reversal identity');
      require(original.from_account_id === h.to_account_id && original.to_account_id === h.from_account_id && original.amount_minor === h.amount_minor, 'reversal accounts/amount');
      require(out.reversal_for_voucher_id === original.in_voucher_id && into.reversal_for_voucher_id === original.out_voucher_id, 'reversal legs');
      for (const [leg, originalId] of [[out, original.in_voucher_id], [into, original.out_voucher_id]]) {
        const old = vouchers.get(originalId);
        require(old && old.reversed_by_voucher_id === leg.id, 'original leg link');
        for (const key of snapshotFields) require(same(leg[key], old[key]), 'historical snapshot');
      }
    } else {
      require(h.reversal_for_transfer_id == null && out.reversal_for_voucher_id == null && into.reversal_for_voucher_id == null, 'unexpected reversal reference');
    }
    if (reversed) {
      const r = transfers.get(h.reversed_by_transfer_id);
      require(!reversal && r && flag(r.is_reversal) && r.reversal_for_transfer_id === h.id && Number.isSafeInteger(h.reversed_at), 'reversed header link');
    } else require(h.reversed_by_transfer_id == null && h.reversed_at == null && out.reversed_by_voucher_id == null && into.reversed_by_voucher_id == null, 'unexpected reversed metadata');
  }
  for (const v of d.cashbook_vouchers) {
    if (v.classification === 'transfer') require(owners.has(v.id), 'unowned transfer voucher');
    else require(!v.idempotency_key?.startsWith(TRANSFER_INTERNAL_PREFIX), 'reserved ordinary identity');
  }
}

export async function verifyTransferHashes(d: Tables): Promise<void> {
  for (const h of d.cashbook_transfers) if (!h.is_reversal) {
    const hash = await transferIntentHash(h as CreateTransferInput);
    require(hash === h.payload_hash, 'intent hash');
  }
}
