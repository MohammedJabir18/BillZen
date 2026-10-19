import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  getMoneyAccounts,
  createMoneyAccount,
  getCashbookCategories,
  createCashbookCategory,
  getCashbookParties,
  createCashbookParty,
  postCashbookVoucher,
  reverseCashbookVoucher,
  getCashbookLedger,
} from './cashbook';

describe('cashbook adapter (in-memory mock fallback)', () => {
  it('generates unique idempotency keys', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(key1).not.toBe(key2);
  });

  it('manages money accounts and initial state', async () => {
    const accounts = await getMoneyAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(2);

    const newAcc = await createMoneyAccount({
      account_name: 'Petty Cash Test',
      account_type: 'cash',
      opening_balance_minor: 50000, // ₹500.00
      allow_negative_balance: false,
    });
    expect(newAcc.id).toBeTruthy();
    expect(newAcc.account_name).toBe('Petty Cash Test');
    expect(newAcc.opening_balance_minor).toBe(50000);

    const updatedAccounts = await getMoneyAccounts();
    expect(updatedAccounts.some((a) => a.id === newAcc.id)).toBe(true);
  });

  it('manages categories and parties', async () => {
    const categories = await getCashbookCategories();
    expect(categories.length).toBeGreaterThan(0);

    const newCat = await createCashbookCategory({
      name: 'Packaging Supplies',
      category_type: 'expense',
    });
    expect(newCat.name).toBe('Packaging Supplies');

    const newParty = await createCashbookParty({
      name: 'Supplier ABC',
      party_type: 'supplier',
      phone: '+91 9876543210',
    });
    expect(newParty.name).toBe('Supplier ABC');

    const parties = await getCashbookParties();
    expect(parties.some((p) => p.id === newParty.id)).toBe(true);
  });

  it('posts receipt (inflow) and payment (outflow) vouchers with running balances', async () => {
    const accounts = await getMoneyAccounts();
    const cashAcc = accounts.find((a) => a.account_type === 'cash')!;

    // 1. Post Receipt (Inflow) of ₹10,000 (1,000,000 minor)
    const rcpIdem = generateIdempotencyKey();
    const rcpResult = await postCashbookVoucher({
      idempotency_key: rcpIdem,
      account_id: cashAcc.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 1000000,
      business_date: '2026-10-19',
      notes: 'Test cash sales',
    });

    expect(rcpResult.status).toBe('posted');
    if (rcpResult.status === 'posted') {
      expect(rcpResult.voucher_number).toMatch(/^RCP-\d{6}-\d{5}$/);
      expect(rcpResult.amount_minor).toBe(1000000);
      expect(rcpResult.direction).toBe('inflow');
    }

    // 2. Post Payment (Outflow) of ₹2,500 (250,000 minor)
    const payIdem = generateIdempotencyKey();
    const payResult = await postCashbookVoucher({
      idempotency_key: payIdem,
      account_id: cashAcc.id,
      direction: 'outflow',
      classification: 'operating_expense',
      payment_method: 'cash',
      amount_minor: 250000,
      business_date: '2026-10-19',
      notes: 'Test tea expense',
    });

    expect(payResult.status).toBe('posted');
    if (payResult.status === 'posted') {
      expect(payResult.voucher_number).toMatch(/^PAY-\d{6}-\d{5}$/);
      expect(payResult.amount_minor).toBe(250000);
    }

    // 3. Verify Ledger
    const ledger = await getCashbookLedger({
      account_id: cashAcc.id,
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    });

    expect(ledger.entries.length).toBeGreaterThanOrEqual(2);
    expect(ledger.summary.total_cash_minor).toBeGreaterThanOrEqual(750000);
  });

  it('enforces negative balance confirmation on non-negative accounts', async () => {
    // Create an account with 0 opening balance and allow_negative_balance = false
    const tightAcc = await createMoneyAccount({
      account_name: 'Strict Cash Box',
      account_type: 'cash',
      opening_balance_minor: 0,
      allow_negative_balance: false,
    });

    // Attempt payment of ₹500 without confirmation
    const payIdem = generateIdempotencyKey();
    const result1 = await postCashbookVoucher({
      idempotency_key: payIdem,
      account_id: tightAcc.id,
      direction: 'outflow',
      classification: 'operating_expense',
      payment_method: 'cash',
      amount_minor: 50000,
      business_date: '2026-10-19',
      confirmed_negative_balance: false,
    });

    expect(result1.status).toBe('requires_confirmation');
    if (result1.status === 'requires_confirmation') {
      expect(result1.projected_balance_minor).toBe(-50000);
    }

    // Confirm negative balance with the same idempotency key
    const result2 = await postCashbookVoucher({
      idempotency_key: payIdem,
      account_id: tightAcc.id,
      direction: 'outflow',
      classification: 'operating_expense',
      payment_method: 'cash',
      amount_minor: 50000,
      business_date: '2026-10-19',
      confirmed_negative_balance: true,
    });

    expect(result2.status).toBe('posted');
  });

  it('supports voucher reversal and prevents duplicate reversals', async () => {
    const accounts = await getMoneyAccounts();
    const cashAcc = accounts[0];

    // Post a voucher to reverse
    const postRes = await postCashbookVoucher({
      idempotency_key: generateIdempotencyKey(),
      account_id: cashAcc.id,
      direction: 'inflow',
      classification: 'operating_income',
      payment_method: 'cash',
      amount_minor: 120000, // ₹1,200.00
      business_date: '2026-10-19',
      notes: 'Voucher to be reversed',
    });

    expect(postRes.status).toBe('posted');
    if (postRes.status !== 'posted') return;

    // Reverse the voucher
    const revRes = await reverseCashbookVoucher(postRes.id);
    expect(revRes.status).toBe('posted');
    if (revRes.status === 'posted') {
      expect(revRes.is_reversal).toBe(true);
      expect(revRes.reversal_for_voucher_id).toBe(postRes.id);
      expect(revRes.direction).toBe('outflow'); // Equal and opposite
    }

    // Attempting to reverse the same voucher again should fail
    await expect(reverseCashbookVoucher(postRes.id)).rejects.toThrow(
      /already reversed/i
    );
  });
});
