import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell, exportTransactionsToCsv } from './csv_export';
import type { BusinessSettings } from '../types';
import type { CashbookLedgerEntry, CashbookSummary } from '../types/cashbook';

describe('sanitizeCsvCell', () => {
  it('escapes CSV formula injection prefixes (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeCsvCell('=cmd|\' /C calc\'!A0')).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeCsvCell('+12345')).toBe("'+12345");
    expect(sanitizeCsvCell('-500')).toBe("'-500");
    expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(sanitizeCsvCell('\ttab_injection')).toBe("'\ttab_injection");
    expect(sanitizeCsvCell('\rcarriage_return')).toBe('"\'\rcarriage_return"');
  });

  it('escapes and quotes strings containing commas, quotes, or newlines', () => {
    expect(sanitizeCsvCell('Acme, Corp')).toBe('"Acme, Corp"');
    expect(sanitizeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });

  it('handles empty and nullish values cleanly', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell('')).toBe('');
    expect(sanitizeCsvCell(12345)).toBe('12345');
  });
});

describe('exportTransactionsToCsv', () => {
  const dummySettings: BusinessSettings = {
    business_name: 'SuperStore =Malicious',
    tax_identifier: '32ABCDE1234F1Z5',
    currency_code: 'INR',
    currency_exponent: 2,
    timezone: 'Asia/Kolkata',
  } as BusinessSettings;

  const dummySummary: CashbookSummary = {
    total_cash_minor: 30000,
    active_cash_minor: 30000,
    opening_balance_minor: 10000,
    period_inflows_minor: 25000,
    period_outflows_minor: 5000,
    closing_balance_minor: 30000,
    net_operating_cash_flow_minor: 20000,
    matching_inflows_minor: 0,
    matching_outflows_minor: 0,
    matching_count: 0,
  };

  const dummyEntries: CashbookLedgerEntry[] = [
    {
      voucher: {
        id: 'v1',
        voucher_number: 'VCH-001',
        business_date: '2026-10-20',
        direction: 'inflow',
        amount_minor: 25000,
        currency_code_snap: 'INR',
        account_id: 'acc1',
        account_name_snap: 'Main Cash',
        category_id: 'Sales',
        party_name_snap: '+Dangerous Customer',
        classification: 'operating_income',
        payment_method: 'cash',
        notes: '=SUM(1,2)',
        status: 'posted',
        created_at: 1000,
      } as unknown as import('../types/cashbook').CashbookVoucher,
      movement: {
        id: 'm1',
        voucher_id: 'v1',
        account_id: 'acc1',
        amount_minor: 25000,
        business_date: '2026-10-20',
        sequence_number: 1,
        created_at: 1000,
      },
      running_balance_minor: 35000,
    },
    {
      voucher: {
        id: 'v2',
        voucher_number: 'VCH-002',
        business_date: '2026-10-20',
        direction: 'outflow',
        amount_minor: 5000,
        currency_code_snap: 'INR',
        account_id: 'acc1',
        account_name_snap: 'Main Cash',
        category_id: 'Office',
        party_name_snap: 'Stationery Supplier',
        classification: 'operating_expense',
        payment_method: 'cash',
        notes: 'Office supplies, pens',
        status: 'posted',
        created_at: 2000,
      } as unknown as import('../types/cashbook').CashbookVoucher,
      movement: {
        id: 'm2',
        voucher_id: 'v2',
        account_id: 'acc1',
        amount_minor: 5000,
        business_date: '2026-10-20',
        sequence_number: 2,
        created_at: 2000,
      },
      running_balance_minor: 30000,
    },
  ];

  it('generates an RFC-compliant CSV with escaped formulas and proper metadata', () => {
    const csv = exportTransactionsToCsv({
      settings: dummySettings,
      summary: dummySummary,
      entries: dummyEntries,
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      accountName: 'Main Cash',
    });

    expect(csv).toContain('BillZen Company Cashbook Report');
    // Formula defense on business name '=Malicious'
    expect(csv).toContain('SuperStore =Malicious');
    // Check party name '+Dangerous Customer' is escaped with single quote
    expect(csv).toContain("'+Dangerous Customer");
    // Check notes '=SUM(1,2)' is escaped with single quote
    expect(csv).toContain("'=SUM(1,2)");
    // Check comma escaping in 'Office supplies, pens'
    expect(csv).toContain('"Office supplies, pens"');
    // Check summary numbers
    expect(csv).toContain('Opening Balance,100.00');
    expect(csv).toContain('Total Receipts (Inflows),250.00');
    expect(csv).toContain('Total Payments (Outflows),50.00');
    expect(csv).toContain('Closing Balance,300.00');
    expect(csv).toContain('Net Cash Change,200.00');
    expect(csv).toContain('Total Transactions,2');
  });
});

describe('report category presentation', () => {
  it('resolves category IDs to names while retaining CSV formula protection', () => {
    const csv = exportTransactionsToCsv({
      settings: { currency_code: 'INR', currency_exponent: 2 } as BusinessSettings,
      summary: { opening_balance_minor: 0, period_inflows_minor: 100, period_outflows_minor: 0, closing_balance_minor: 100 } as CashbookSummary,
      entries: [{ voucher: { category_id: 'cat-retail', direction: 'inflow', amount_minor: 100 }, running_balance_minor: 100 } as CashbookLedgerEntry],
      categoryNames: { 'cat-retail': '=Retail sales' },
    });
    expect(csv).toContain("'=Retail sales");
    expect(csv).not.toContain('cat-retail');
  });
});
