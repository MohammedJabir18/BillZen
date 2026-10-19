import { invoke } from '@tauri-apps/api/core';
import type {
  MoneyAccount,
  CreateMoneyAccountDto,
  UpdateMoneyAccountDto,
  CashbookCategory,
  CreateCashbookCategoryDto,
  CashbookParty,
  CreateCashbookPartyDto,
  CashbookVoucher,
  CashbookLedgerEntry,
  CashbookSummary,
  CreateVoucherInput,
  PostVoucherResult,
  CashbookLedgerFilter,
} from '../types/cashbook';
import { isTauriEnvironment } from './tauri';
import { getTodayBusinessDate } from '../domain/financial';

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Browser Preview In-Memory Fallback Store (for browser tests / web demo)
// ---------------------------------------------------------------------------
interface MockCashbookState {
  accounts: MoneyAccount[];
  categories: CashbookCategory[];
  parties: CashbookParty[];
  vouchers: CashbookVoucher[];
  movements: {
    id: string;
    voucher_id: string;
    account_id: string;
    amount_minor: number;
    business_date: string;
    sequence_number: number;
    created_at: number;
  }[];
}

const mockState: MockCashbookState = {
  accounts: [
    {
      id: 'acc_cash_default',
      account_name: 'Main Cash Drawer',
      account_type: 'cash',
      opening_balance_minor: 0,
      allow_negative_balance: false,
      currency_code: 'INR',
      currency_exponent: 2,
      bank_name: null,
      account_number: null,
      ifsc_or_routing: null,
      is_archived: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    {
      id: 'acc_bank_default',
      account_name: 'Current Bank Account',
      account_type: 'bank',
      opening_balance_minor: 0,
      allow_negative_balance: true,
      currency_code: 'INR',
      currency_exponent: 2,
      bank_name: 'State Bank of India',
      account_number: '1234567890',
      ifsc_or_routing: 'SBIN0001234',
      is_archived: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  ],
  categories: [
    { id: 'cat_sales', name: 'Sales Revenue', category_type: 'income', is_default: true, is_archived: false, created_at: Date.now() },
    { id: 'cat_rent', name: 'Shop Rent', category_type: 'expense', is_default: true, is_archived: false, created_at: Date.now() },
    { id: 'cat_salary', name: 'Staff Salaries', category_type: 'expense', is_default: true, is_archived: false, created_at: Date.now() },
    { id: 'cat_general', name: 'General Expense', category_type: 'both', is_default: true, is_archived: false, created_at: Date.now() },
  ],
  parties: [],
  vouchers: [],
  movements: [],
};

// ---------------------------------------------------------------------------
// Adapter Interface Methods
// ---------------------------------------------------------------------------

export async function getMoneyAccounts(): Promise<MoneyAccount[]> {
  if (!isTauriEnvironment()) {
    return [...mockState.accounts];
  }
  return await invoke<MoneyAccount[]>('get_money_accounts');
}

export async function createMoneyAccount(dto: CreateMoneyAccountDto): Promise<MoneyAccount> {
  if (!isTauriEnvironment()) {
    const newAcc: MoneyAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      account_name: dto.account_name.trim(),
      account_type: dto.account_type as any,
      opening_balance_minor: dto.opening_balance_minor,
      allow_negative_balance: dto.allow_negative_balance,
      currency_code: dto.currency_code || 'INR',
      currency_exponent: dto.currency_exponent || 2,
      bank_name: dto.bank_name || null,
      account_number: dto.account_number || null,
      ifsc_or_routing: dto.ifsc_or_routing || null,
      is_archived: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockState.accounts.push(newAcc);
    return newAcc;
  }
  return await invoke<MoneyAccount>('create_money_account', { dto });
}

export async function updateMoneyAccount(dto: UpdateMoneyAccountDto): Promise<MoneyAccount> {
  if (!isTauriEnvironment()) {
    const acc = mockState.accounts.find((a) => a.id === dto.id);
    if (!acc) throw new Error(`Account ${dto.id} not found`);
    acc.account_name = dto.account_name.trim();
    acc.allow_negative_balance = dto.allow_negative_balance;
    if (dto.bank_name !== undefined) acc.bank_name = dto.bank_name;
    if (dto.account_number !== undefined) acc.account_number = dto.account_number;
    if (dto.ifsc_or_routing !== undefined) acc.ifsc_or_routing = dto.ifsc_or_routing;
    if (dto.is_archived !== undefined && dto.is_archived !== null) acc.is_archived = dto.is_archived;
    acc.updated_at = Date.now();
    return { ...acc };
  }
  return await invoke<MoneyAccount>('update_money_account', { dto });
}

export async function getCashbookCategories(): Promise<CashbookCategory[]> {
  if (!isTauriEnvironment()) {
    return [...mockState.categories];
  }
  return await invoke<CashbookCategory[]>('get_cashbook_categories');
}

export async function createCashbookCategory(dto: CreateCashbookCategoryDto): Promise<CashbookCategory> {
  if (!isTauriEnvironment()) {
    const newCat: CashbookCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name.trim(),
      category_type: dto.category_type,
      is_default: false,
      is_archived: false,
      created_at: Date.now(),
    };
    mockState.categories.push(newCat);
    return newCat;
  }
  return await invoke<CashbookCategory>('create_cashbook_category', { dto });
}

export async function getCashbookParties(): Promise<CashbookParty[]> {
  if (!isTauriEnvironment()) {
    return [...mockState.parties];
  }
  return await invoke<CashbookParty[]>('get_cashbook_parties');
}

export async function createCashbookParty(dto: CreateCashbookPartyDto): Promise<CashbookParty> {
  if (!isTauriEnvironment()) {
    const newParty: CashbookParty = {
      id: `pty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name.trim(),
      party_type: dto.party_type,
      customer_id: dto.customer_id || null,
      phone: dto.phone || null,
      email: dto.email || null,
      tax_id: dto.tax_id || null,
      address: dto.address || null,
      is_archived: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockState.parties.push(newParty);
    return newParty;
  }
  return await invoke<CashbookParty>('create_cashbook_party', { dto });
}

export async function postCashbookVoucher(input: CreateVoucherInput): Promise<PostVoucherResult> {
  if (!isTauriEnvironment()) {
    if (input.idempotency_key) {
      const existing = mockState.vouchers.find((v) => v.idempotency_key === input.idempotency_key);
      if (existing) {
        return { ...existing, status: 'posted' as const };
      }
    }

    const acc = mockState.accounts.find((a) => a.id === input.account_id);
    if (!acc) throw new Error(`Account ${input.account_id} not found`);

    // Check balance
    const currentMovs = mockState.movements
      .filter((m) => m.account_id === input.account_id)
      .reduce((sum, m) => sum + m.amount_minor, 0);
    const currentBal = acc.opening_balance_minor + currentMovs;
    const delta = input.direction === 'inflow' ? input.amount_minor : -input.amount_minor;
    const projected = currentBal + delta;

    if (projected < 0 && !acc.allow_negative_balance && !input.confirmed_negative_balance) {
      return {
        status: 'requires_confirmation',
        current_balance_minor: currentBal,
        amount_minor: input.amount_minor,
        projected_balance_minor: projected,
        message: `Account balance would become negative: current ${currentBal}, projected ${projected}`,
      };
    }

    const now = Date.now();
    const ym = input.business_date.replace(/-/g, '').substring(0, 6);
    const prefix = input.direction === 'inflow' ? 'RCP' : 'PAY';
    const seq = mockState.vouchers.length + 1;
    const vchNum = `${prefix}-${ym}-${seq.toString().padStart(5, '0')}`;
    const vchId = `vch_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const party = input.party_id ? mockState.parties.find((p) => p.id === input.party_id) : null;

    const voucher: CashbookVoucher = {
      id: vchId,
      voucher_number: vchNum,
      idempotency_key: input.idempotency_key,
      payload_hash: 'mock_hash',
      account_id: input.account_id,
      party_id: input.party_id || null,
      category_id: input.category_id || null,
      direction: input.direction,
      classification: input.classification,
      payment_method: input.payment_method,
      amount_minor: input.amount_minor,
      business_date: input.business_date,
      status: 'posted',
      is_reversal: false,
      reversal_for_voucher_id: null,
      is_reversed: false,
      reversed_by_voucher_id: null,
      reversed_at: null,
      reference_note: input.reference_note || null,
      notes: input.notes || null,
      business_name_snap: 'BillZen Store (Browser Preview)',
      business_tax_id_snap: '32AAAAA0000A1Z5',
      business_address_snap: '123 Market Road, Kochi',
      business_phone_snap: '+91 9876543210',
      party_name_snap: party?.name || null,
      party_phone_snap: party?.phone || null,
      party_tax_id_snap: party?.tax_id || null,
      party_address_snap: party?.address || null,
      account_name_snap: acc.account_name,
      currency_code_snap: acc.currency_code,
      currency_exponent_snap: acc.currency_exponent,
      amount_in_words_snap: null,
      created_at: now,
      posted_at: now,
    };

    mockState.vouchers.push(voucher);
    mockState.movements.push({
      id: `mov_${now}`,
      voucher_id: vchId,
      account_id: input.account_id,
      amount_minor: delta,
      business_date: input.business_date,
      sequence_number: seq,
      created_at: now,
    });

    return { ...voucher, status: 'posted' as const };
  }

  return await invoke<PostVoucherResult>('post_cashbook_voucher', { input });
}

export async function reverseCashbookVoucher(
  voucherId: string,
  confirmedNegativeBalance: boolean = false
): Promise<PostVoucherResult> {
  if (!isTauriEnvironment()) {
    const orig = mockState.vouchers.find((v) => v.id === voucherId);
    if (!orig) throw new Error(`Voucher ${voucherId} not found`);
    if (orig.is_reversed) throw new Error(`Voucher ${voucherId} is already reversed`);

    const acc = mockState.accounts.find((a) => a.id === orig.account_id);
    if (!acc) throw new Error(`Account ${orig.account_id} not found`);

    const revDelta = orig.direction === 'inflow' ? -orig.amount_minor : orig.amount_minor;
    const currentMovs = mockState.movements
      .filter((m) => m.account_id === orig.account_id)
      .reduce((sum, m) => sum + m.amount_minor, 0);
    const currentBal = acc.opening_balance_minor + currentMovs;
    const projected = currentBal + revDelta;

    if (projected < 0 && !acc.allow_negative_balance && !confirmedNegativeBalance) {
      return {
        status: 'requires_confirmation',
        current_balance_minor: currentBal,
        amount_minor: orig.amount_minor,
        projected_balance_minor: projected,
        message: `Reversal would make account balance negative: current ${currentBal}, projected ${projected}`,
      };
    }

    const now = Date.now();
    const todayStr = getTodayBusinessDate('Asia/Kolkata');
    const ym = todayStr.replace(/-/g, '').substring(0, 6);
    const prefix = orig.direction === 'inflow' ? 'RCP-REV' : 'PAY-REV';
    const seq = mockState.vouchers.length + 1;
    const revNum = `${prefix}-${ym}-${seq.toString().padStart(5, '0')}`;
    const revId = `vch_rev_${now}`;

    const revVoucher: CashbookVoucher = {
      ...orig,
      id: revId,
      voucher_number: revNum,
      direction: orig.direction === 'inflow' ? 'outflow' : 'inflow',
      is_reversal: true,
      reversal_for_voucher_id: orig.id,
      is_reversed: false,
      reversed_by_voucher_id: null,
      reversed_at: null,
      business_date: todayStr,
      notes: `Reversal of voucher ${orig.voucher_number}`,
      created_at: now,
      posted_at: now,
    };

    orig.is_reversed = true;
    orig.reversed_by_voucher_id = revId;
    orig.reversed_at = now;

    mockState.vouchers.push(revVoucher);
    mockState.movements.push({
      id: `mov_rev_${now}`,
      voucher_id: revId,
      account_id: orig.account_id,
      amount_minor: revDelta,
      business_date: todayStr,
      sequence_number: seq,
      created_at: now,
    });

    return { ...revVoucher, status: 'posted' as const };
  }

  return await invoke<PostVoucherResult>('reverse_cashbook_voucher', {
    voucherId,
    confirmedNegativeBalance,
  });
}

export async function getCashbookLedger(
  filter: CashbookLedgerFilter
): Promise<{ entries: CashbookLedgerEntry[]; summary: CashbookSummary }> {
  if (!isTauriEnvironment()) {
    let filtered = [...mockState.vouchers];
    if (filter.account_id) {
      filtered = filtered.filter((v) => v.account_id === filter.account_id);
    }
    if (filter.start_date) {
      filtered = filtered.filter((v) => v.business_date >= filter.start_date!);
    }
    if (filter.end_date) {
      filtered = filtered.filter((v) => v.business_date <= filter.end_date!);
    }
    if (filter.classification) {
      filtered = filtered.filter((v) => v.classification === filter.classification);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      filtered = filtered.filter(
        (v) =>
          v.voucher_number.toLowerCase().includes(q) ||
          (v.party_name_snap && v.party_name_snap.toLowerCase().includes(q)) ||
          (v.notes && v.notes.toLowerCase().includes(q)) ||
          (v.reference_note && v.reference_note.toLowerCase().includes(q))
      );
    }

    let running = 0;
    const entries: CashbookLedgerEntry[] = filtered.map((v) => {
      const mov = mockState.movements.find((m) => m.voucher_id === v.id)!;
      running += mov ? mov.amount_minor : 0;
      return {
        voucher: v,
        movement: mov || {
          id: `mov_${v.id}`,
          voucher_id: v.id,
          account_id: v.account_id,
          amount_minor: v.direction === 'inflow' ? v.amount_minor : -v.amount_minor,
          business_date: v.business_date,
          sequence_number: 1,
          created_at: v.created_at,
        },
        running_balance_minor: running,
      };
    });

    const totalCash = mockState.accounts.reduce((sum, a) => {
      const movs = mockState.movements.filter((m) => m.account_id === a.id).reduce((s, m) => s + m.amount_minor, 0);
      return sum + a.opening_balance_minor + movs;
    }, 0);

    const activeCash = mockState.accounts.filter((a) => !a.is_archived).reduce((sum, a) => {
      const movs = mockState.movements.filter((m) => m.account_id === a.id).reduce((s, m) => s + m.amount_minor, 0);
      return sum + a.opening_balance_minor + movs;
    }, 0);

    const inflows = filtered.filter((v) => v.direction === 'inflow').reduce((s, v) => s + v.amount_minor, 0);
    const outflows = filtered.filter((v) => v.direction === 'outflow').reduce((s, v) => s + v.amount_minor, 0);

    const isDisplayFiltered = Boolean(filter.search || filter.classification);

    const summary: CashbookSummary = {
      total_cash_minor: totalCash,
      active_cash_minor: activeCash,
      period_inflows_minor: inflows,
      period_outflows_minor: outflows,
      net_operating_cash_flow_minor: inflows - outflows,
      opening_balance_minor: 0,
      closing_balance_minor: totalCash,
      matching_inflows_minor: isDisplayFiltered ? inflows : null,
      matching_outflows_minor: isDisplayFiltered ? outflows : null,
      matching_count: isDisplayFiltered ? filtered.length : null,
    };

    return { entries, summary };
  }

  const rawTuple = await invoke<[CashbookLedgerEntry[], CashbookSummary]>('get_cashbook_ledger', {
    filter,
  });
  return { entries: rawTuple[0], summary: rawTuple[1] };
}
