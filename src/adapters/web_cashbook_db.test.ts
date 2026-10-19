import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearWebCashbookDatabase,
  getWebMoneyAccounts,
  createWebMoneyAccount,
  updateWebMoneyAccount,
  getWebCashbookCategories,
  getWebCashbookParties,
  createWebCashbookParty,
  postWebCashbookVoucher,
  reverseWebCashbookVoucher,
  getWebCashbookLedger,
  exportWebCashbookTables,
  restoreWebCashbookTables,
  MAX_MONEY_MINOR,
} from './web_cashbook_db';

describe('web_cashbook_db (financial invariants & lifecycle)', () => {
  beforeEach(async () => {
    await clearWebCashbookDatabase();
  });

  it('initializes default money accounts and categories', async () => {
    const accounts = await getWebMoneyAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(2);
    expect(accounts.some((a) => a.id === 'acc_cash_default')).toBe(true);
    expect(accounts.some((a) => a.id === 'acc_bank_default')).toBe(true);

    const categories = await getWebCashbookCategories();
    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(categories.some((c) => c.id === 'cat_sales')).toBe(true);
  });

  it('enforces money amount bounds and positive values', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;

    // Non-positive amount
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-1',
        account_id: cashAcc.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 0,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow('Amount must be strictly positive');

    // Amount exceeding MAX_MONEY_MINOR
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-2',
        account_id: cashAcc.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: MAX_MONEY_MINOR + 1,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow('exceeds maximum permissible money minor');
  });

  it('rejects invalid business date format', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;

    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-date-1',
        account_id: cashAcc.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 100000,
        business_date: '19-10-2026',
      })
    ).rejects.toThrow('Invalid business date format');
  });

  it('validates direction and classification compatibility', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;

    // Inflow cannot be operating_expense
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-cls-1',
        account_id: cashAcc.id,
        direction: 'inflow',
        classification: 'operating_expense',
        payment_method: 'cash',
        amount_minor: 100000,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow("Incompatible direction 'inflow' with classification 'operating_expense'");

    // Outflow cannot be operating_income
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-cls-2',
        account_id: cashAcc.id,
        direction: 'outflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 100000,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow("Incompatible direction 'outflow' with classification 'operating_income'");
  });

  it('validates direction and category compatibility', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;
    const categories = await getWebCashbookCategories();
    const expenseCat = categories.find((c) => c.category_type === 'expense')!;
    const incomeCat = categories.find((c) => c.category_type === 'income')!;

    // Inflow with expense category
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-cat-1',
        account_id: cashAcc.id,
        category_id: expenseCat.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 100000,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow("Incompatible direction 'inflow' with category type 'expense'");

    // Outflow with income category
    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-cat-2',
        account_id: cashAcc.id,
        category_id: incomeCat.id,
        direction: 'outflow',
        classification: 'operating_expense',
        payment_method: 'cash',
        amount_minor: 100000,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow("Incompatible direction 'outflow' with category type 'income'");
  });

  it('supports idempotent replay and detects idempotency key conflict', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;
    const key = 'shared-idempotency-key';

    const voucherInput = {
      idempotency_key: key,
      account_id: cashAcc.id,
      direction: 'inflow' as const,
      classification: 'operating_income' as const,
      payment_method: 'cash' as const,
      amount_minor: 500000,
      business_date: '2026-10-19',
      notes: 'Original invoice payment',
    };

    // First post
    const res1 = await postWebCashbookVoucher(voucherInput);
    expect(res1.status).toBe('posted');

    // Idempotent replay: exact same payload returns existing voucher
    const res2 = await postWebCashbookVoucher(voucherInput);
    expect(res2.status).toBe('posted');
    if (res1.status === 'posted' && res2.status === 'posted') {
      expect(res2.id).toBe(res1.id);
      expect(res2.voucher_number).toBe(res1.voucher_number);
    }

    // Idempotency conflict: same key, different amount
    await expect(
      postWebCashbookVoucher({
        ...voucherInput,
        amount_minor: 600000,
      })
    ).rejects.toThrow('Idempotency key conflict');
  });

  it('enforces negative balance guard with confirmation requirement', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;
    expect(cashAcc.allow_negative_balance).toBe(false);

    // Opening is 0. Paying ₹100 without confirmation prompts RequiresConfirmation
    const resPrompt = await postWebCashbookVoucher({
      idempotency_key: 'idem-neg-1',
      account_id: cashAcc.id,
      direction: 'outflow',
      classification: 'operating_expense',
      payment_method: 'cash',
      amount_minor: 10000,
      business_date: '2026-10-19',
      confirmed_negative_balance: false,
    });

    expect(resPrompt.status).toBe('requires_confirmation');
    if (resPrompt.status === 'requires_confirmation') {
      expect(resPrompt.current_balance_minor).toBe(0);
      expect(resPrompt.amount_minor).toBe(10000);
      expect(resPrompt.projected_balance_minor).toBe(-10000);
    }

    // With confirmed_negative_balance = true, successfully posts
    const resConfirmed = await postWebCashbookVoucher({
      idempotency_key: 'idem-neg-2',
      account_id: cashAcc.id,
      direction: 'outflow',
      classification: 'operating_expense',
      payment_method: 'cash',
      amount_minor: 10000,
      business_date: '2026-10-19',
      confirmed_negative_balance: true,
    });

    expect(resConfirmed.status).toBe('posted');
  });

  it('rejects posting to or reversing on archived accounts', async () => {
    const newAcc = await createWebMoneyAccount({
      account_name: 'Temporary Petty Drawer',
      account_type: 'cash',
      opening_balance_minor: 50000,
      allow_negative_balance: false,
    });

    // Archive the account
    await updateWebMoneyAccount({
      id: newAcc.id,
      account_name: 'Temporary Petty Drawer',
      allow_negative_balance: false,
      is_archived: true,
    });

    await expect(
      postWebCashbookVoucher({
        idempotency_key: 'idem-arch-1',
        account_id: newAcc.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 10000,
        business_date: '2026-10-19',
      })
    ).rejects.toThrow('Cannot post to or modify archived account');
  });

  it('reverses vouchers atomically and forbids double reversal', async () => {
    const accounts = await getWebMoneyAccounts();
    const bankAcc = accounts.find((a) => a.account_type === 'bank')!;

    // 1. Post initial receipt of ₹5,000 (500,000 minor)
    const postRes = await postWebCashbookVoucher({
      idempotency_key: 'idem-rev-orig',
      account_id: bankAcc.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'bank_transfer',
      amount_minor: 500000,
      business_date: '2026-10-19',
    });
    expect(postRes.status).toBe('posted');
    if (postRes.status !== 'posted') return;

    // 2. Reverse the voucher
    const revRes = await reverseWebCashbookVoucher(postRes.id, true);
    expect(revRes.status).toBe('posted');
    if (revRes.status !== 'posted') return;

    expect(revRes.is_reversal).toBe(true);
    expect(revRes.reversal_for_voucher_id).toBe(postRes.id);
    expect(revRes.direction).toBe('outflow');
    expect(revRes.amount_minor).toBe(500000);
    expect(revRes.voucher_number).toMatch(/^RCP-REV-\d{6}-\d{5}$/);

    // 3. Cannot reverse an already reversed voucher
    await expect(reverseWebCashbookVoucher(postRes.id)).rejects.toThrow('Voucher is already reversed');

    // 4. Cannot reverse a reversal voucher
    await expect(reverseWebCashbookVoucher(revRes.id)).rejects.toThrow('Cannot reverse a reversal voucher');
  });

  it('roundtrips workspace cashbook tables via export and restore', async () => {
    const accounts = await getWebMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;

    // Create party and voucher
    const party = await createWebCashbookParty({
      name: 'Test Client X',
      party_type: 'customer',
      phone: '+91 9999999999',
    });

    const vch = await postWebCashbookVoucher({
      idempotency_key: 'idem-roundtrip-1',
      account_id: cashAcc.id,
      party_id: party.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 250000,
      business_date: '2026-10-19',
    });
    expect(vch.status).toBe('posted');

    // Export tables
    const exported = await exportWebCashbookTables();
    expect(exported.money_accounts.length).toBeGreaterThanOrEqual(2);
    expect(exported.cashbook_parties.some((p) => p.id === party.id)).toBe(true);
    expect(exported.cashbook_vouchers.some((v) => v.id === (vch as any).id)).toBe(true);
    expect(exported.cashbook_movements.length).toBeGreaterThan(0);

    // Clear DB
    await clearWebCashbookDatabase();
    const afterClear = await getWebCashbookParties();
    expect(afterClear.some((p) => p.id === party.id)).toBe(false);

    // Restore tables
    await restoreWebCashbookTables(exported);

    const afterRestoreParties = await getWebCashbookParties();
    expect(afterRestoreParties.some((p) => p.id === party.id)).toBe(true);

    const afterRestoreLedger = await getWebCashbookLedger({});
    expect(afterRestoreLedger.entries.some((e) => e.voucher.id === (vch as any).id)).toBe(true);
    expect(afterRestoreLedger.summary.total_cash_minor).toBe(250000);
  });

  it('handles 3-decimal currency (KWD) with exact minor units calculation', async () => {
    const originalLocal = (globalThis as any).localStorage;
    const map = new Map<string, string>();
    map.set(
      'billzen_browser_settings',
      JSON.stringify({
        business_name: 'Kuwait Trading Co',
        currency_code: 'KWD',
        currency_exponent: 3,
        timezone: 'Asia/Kuwait',
      })
    );
    (globalThis as any).localStorage = {
      getItem: (k: string) => map.get(k) || null,
      setItem: (k: string, v: string) => map.set(k, String(v)),
      removeItem: (k: string) => map.delete(k),
    };

    try {
      const kwdAccount = await createWebMoneyAccount({
        account_name: 'Kuwait Cash Till',
        account_type: 'cash',
        opening_balance_minor: 12500, // 12.500 KWD
        allow_negative_balance: false,
        currency_code: 'KWD',
        currency_exponent: 3,
      });

      expect(kwdAccount.currency_code).toBe('KWD');
      expect(kwdAccount.currency_exponent).toBe(3);
      expect(kwdAccount.opening_balance_minor).toBe(12500);

      // Post 1.250 KWD (1250 minor units) receipt
      const vch = await postWebCashbookVoucher({
        idempotency_key: 'idem-kwd-1',
        account_id: kwdAccount.id,
        direction: 'inflow',
        classification: 'operating_income',
        payment_method: 'cash',
        amount_minor: 1250,
        business_date: '2026-10-19',
      });

      expect(vch.status).toBe('posted');
      if (vch.status === 'posted') {
        expect(vch.currency_code_snap).toBe('KWD');
        expect(vch.currency_exponent_snap).toBe(3);
        expect(vch.amount_minor).toBe(1250);
      }

      const ledger = await getWebCashbookLedger({ account_id: kwdAccount.id });
      expect(ledger.entries.length).toBe(1);
      // 12.500 + 1.250 = 13.750 KWD (13750 minor)
      expect(ledger.entries[0].running_balance_minor).toBe(13750);
      expect(ledger.summary.closing_balance_minor).toBe(13750);
    } finally {
      (globalThis as any).localStorage = originalLocal;
    }
  });

  it('matches shared reporting fixture for review baseline, 3-decimal KWD, and cross-period reversals', async () => {
    // 1. Test fixture_review_baseline
    const accounts = await getWebMoneyAccounts();
    const mainCash = accounts.find((a) => a.account_type === 'cash')!;

    // Post review baseline vouchers
    const p1 = await createWebCashbookParty({ name: 'Customer Prior', party_type: 'customer' });
    const p2 = await createWebCashbookParty({ name: 'Customer Today', party_type: 'customer' });
    const p3 = await createWebCashbookParty({ name: 'Bank Lender', party_type: 'lender' });
    const p4 = await createWebCashbookParty({ name: 'Customer Future', party_type: 'customer' });

    await postWebCashbookVoucher({
      idempotency_key: 'fix-base-1',
      account_id: mainCash.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 10000,
      business_date: '2026-10-19',
      party_id: p1.id,
      notes: 'Prior day sales',
    });

    await postWebCashbookVoucher({
      idempotency_key: 'fix-base-2',
      account_id: mainCash.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 5000,
      business_date: '2026-10-20',
      party_id: p2.id,
      notes: 'Today operating receipt',
    });

    await postWebCashbookVoucher({
      idempotency_key: 'fix-base-3',
      account_id: mainCash.id,
      direction: 'inflow',
      classification: 'loan',
      payment_method: 'cash',
      amount_minor: 20000,
      business_date: '2026-10-20',
      party_id: p3.id,
      notes: 'Working capital loan',
    });

    await postWebCashbookVoucher({
      idempotency_key: 'fix-base-4',
      account_id: mainCash.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 30000,
      business_date: '2026-10-21',
      party_id: p4.id,
      notes: 'Future day sales',
    });

    // Full period query for 2026-10-20
    const todayLedger = await getWebCashbookLedger({
      start_date: '2026-10-20',
      end_date: '2026-10-20',
      include_archived: false,
    });

    expect(todayLedger.summary.opening_balance_minor).toBe(10000);
    expect(todayLedger.summary.period_inflows_minor).toBe(25000);
    expect(todayLedger.summary.period_outflows_minor).toBe(0);
    expect(todayLedger.summary.net_operating_cash_flow_minor).toBe(5000);
    expect(todayLedger.summary.closing_balance_minor).toBe(35000);
    expect(todayLedger.summary.total_cash_minor).toBe(65000);
    expect(todayLedger.summary.active_cash_minor).toBe(65000);
    expect(todayLedger.summary.matching_inflows_minor).toBeNull();
    expect(todayLedger.summary.matching_outflows_minor).toBeNull();

    // Query 2026-10-20 with non-matching search filter
    const searchLedger = await getWebCashbookLedger({
      start_date: '2026-10-20',
      end_date: '2026-10-20',
      search: 'NonExistentTerm',
      include_archived: false,
    });

    // Period financial totals must remain identical!
    expect(searchLedger.summary.opening_balance_minor).toBe(10000);
    expect(searchLedger.summary.period_inflows_minor).toBe(25000);
    expect(searchLedger.summary.period_outflows_minor).toBe(0);
    expect(searchLedger.summary.net_operating_cash_flow_minor).toBe(5000);
    expect(searchLedger.summary.closing_balance_minor).toBe(35000);
    // Display filter matching metrics:
    expect(searchLedger.summary.matching_inflows_minor).toBe(0);
    expect(searchLedger.summary.matching_outflows_minor).toBe(0);
    expect(searchLedger.summary.matching_count).toBe(0);

    // 2. Test fixture_cross_period_reversal
    const revCash = await createWebMoneyAccount({
      account_name: 'Cross Period Drawer',
      account_type: 'cash',
      opening_balance_minor: 0,
      allow_negative_balance: true,
    });

    const pWalkin = await createWebCashbookParty({ name: 'Walk-in Customer', party_type: 'customer' });
    const vchDay1 = await postWebCashbookVoucher({
      idempotency_key: 'fix-rev-1',
      account_id: revCash.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 100000,
      business_date: '2026-10-10',
      party_id: pWalkin.id,
      notes: 'Day 1 receipt',
    });
    expect(vchDay1.status).toBe('posted');

    // Reversal posted on Day 2: 2026-10-11
    const revDay2 = await reverseWebCashbookVoucher((vchDay1 as any).id, true, '2026-10-11');
    expect(revDay2.status).toBe('posted');

    // Day 1 query: closing balance is 100000 despite future reversal
    const day1Ledger = await getWebCashbookLedger({
      account_id: revCash.id,
      start_date: '2026-10-10',
      end_date: '2026-10-10',
    });
    expect(day1Ledger.summary.opening_balance_minor).toBe(0);
    expect(day1Ledger.summary.period_inflows_minor).toBe(100000);
    expect(day1Ledger.summary.period_outflows_minor).toBe(0);
    expect(day1Ledger.summary.net_operating_cash_flow_minor).toBe(100000);
    expect(day1Ledger.summary.closing_balance_minor).toBe(100000);

    // Day 2 query: opening is 100000, period outflow 100000, closing 0
    const day2Ledger = await getWebCashbookLedger({
      account_id: revCash.id,
      start_date: '2026-10-11',
      end_date: '2026-10-11',
    });
    expect(day2Ledger.summary.opening_balance_minor).toBe(100000);
    expect(day2Ledger.summary.period_inflows_minor).toBe(0);
    expect(day2Ledger.summary.period_outflows_minor).toBe(100000);
    expect(day2Ledger.summary.net_operating_cash_flow_minor).toBe(-100000);
    expect(day2Ledger.summary.closing_balance_minor).toBe(0);
  });
});


