import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateInvoiceTotals, formatMinorUnits, parseToMinorUnits, getTodayBusinessDate } from './financial';
import fixtures from '../../shared/fixtures/calculations.json';

describe('Financial Calculation Parity Tests', () => {
  for (const tc of fixtures.cases) {
    it(`evaluates fixture: ${tc.id} (${tc.description})`, () => {
      if ((tc as any).should_overflow) {
        expect(() =>
          calculateLineItem(
            tc.input.quantity_scaled,
            tc.input.unit_price_minor,
            tc.input.discount_minor,
            tc.input.tax_rate_bp
          )
        ).toThrow(/Numeric overflow/);
        return;
      }

      const line = calculateLineItem(
        tc.input.quantity_scaled,
        tc.input.unit_price_minor,
        tc.input.discount_minor,
        tc.input.tax_rate_bp
      );

      expect(line.gross_minor).toBe(tc.expected!.gross_minor);
      expect(line.taxable_minor).toBe(tc.expected!.taxable_minor);
      expect(line.tax_minor).toBe(tc.expected!.tax_minor);
      expect(line.line_total_minor).toBe(tc.expected!.line_total_minor);

      const totals = calculateInvoiceTotals([line], tc.input.paid_minor);
      expect(totals.grand_total_minor).toBe(tc.expected!.grand_total_minor);
      expect(totals.balance_due_minor).toBe(tc.expected!.balance_due_minor);
      expect(totals.settlement_status).toBe(tc.expected!.settlement_status);
    });
  }

  it('rejects multi-item accumulation when total exceeds MAX_SAFE_MONEY_MINOR', () => {
    // Two lines, each at 5 Quadrillion minor units (5,000,000,000,000,000), accumulating to 10 Quadrillion (> 9,007,199,254,740,991)
    const line1 = calculateLineItem(500000000, 10000000000, 0, 0); // 5 Quadrillion
    const line2 = calculateLineItem(500000000, 10000000000, 0, 0); // 5 Quadrillion
    expect(() => calculateInvoiceTotals([line1, line2], 0)).toThrow(/Numeric overflow/);
  });

  it('rejects overpayment cleanly', () => {
    const line = calculateLineItem(1000, 10000, 0, 0);
    expect(() => calculateInvoiceTotals([line], 15000)).toThrow('exceeds grand total');
  });

  it('correctly formats and parses 2-decimal and 3-decimal currencies', () => {
    expect(formatMinorUnits(34919, 2)).toBe('349.19');
    expect(formatMinorUnits(3281, 3)).toBe('3.281');
    expect(formatMinorUnits(50, 2)).toBe('0.50');
    expect(formatMinorUnits(5, 3)).toBe('0.005');

    expect(parseToMinorUnits('349.19', 2)).toBe(34919);
    expect(parseToMinorUnits('3.281', 3)).toBe(3281);
    expect(parseToMinorUnits('100', 2)).toBe(10000);
    expect(parseToMinorUnits('100', 3)).toBe(100000);
  });

  it('correctly formats and parses negative minor units without losing negative sign', () => {
    expect(formatMinorUnits(-50, 2)).toBe('-0.50');
    expect(formatMinorUnits(-1234, 2)).toBe('-12.34');
    expect(formatMinorUnits(-5, 3)).toBe('-0.005');
    expect(parseToMinorUnits('-0.50', 2)).toBe(-50);
    expect(parseToMinorUnits('-50', 2)).toBe(-5000);
    expect(parseToMinorUnits('-12.34', 2)).toBe(-1234);
    expect(parseToMinorUnits('-0.005', 3)).toBe(-5);
  });

  it('correctly handles thousands grouping and rejects invalid decimal syntax or excess precision', () => {
    // 1. Valid standard 3-digit comma grouping: 1,000.00 -> 100,000 paise
    expect(parseToMinorUnits('1,000.00', 2)).toBe(100000);
    expect(parseToMinorUnits('1,000,000.50', 2)).toBe(100000050);

    // 2. Valid Indian lakh/crore grouping: 1,00,000.00 -> 10,000,000 paise
    expect(parseToMinorUnits('1,00,000.00', 2)).toBe(10000000);
    expect(parseToMinorUnits('12,34,567.89', 2)).toBe(123456789);

    // 3. Reject non-numeric characters (reproducing "12abc.34")
    expect(() => parseToMinorUnits('12abc.34', 2)).toThrow();
    expect(() => parseToMinorUnits('abc', 2)).toThrow();

    // 4. Reject excess precision (reproducing "1.999" for exponent 2)
    expect(() => parseToMinorUnits('1.999', 2)).toThrow(/Excess decimal precision/);
    expect(() => parseToMinorUnits('1.0001', 3)).toThrow(/Excess decimal precision/);

    // 5. Reject invalid comma placements
    expect(() => parseToMinorUnits('12,34.56', 2)).toThrow();
    expect(() => parseToMinorUnits(',100.00', 2)).toThrow();
    expect(() => parseToMinorUnits('100,.00', 2)).toThrow();
    expect(() => parseToMinorUnits('1,,000.00', 2)).toThrow();
  });

  it('determines the correct business date across timezones and midnight boundaries', () => {
    // 2026-10-19 19:30:00 UTC = 2026-10-20 01:00:00 IST
    const lateUtcDate = new Date('2026-10-19T19:30:00.000Z');
    expect(getTodayBusinessDate('Asia/Kolkata', lateUtcDate)).toBe('2026-10-20');
    expect(getTodayBusinessDate('UTC', lateUtcDate)).toBe('2026-10-19');

    // GCC Timezone (UTC+4): 2026-10-19 20:30:00 UTC = 2026-10-20 00:30:00 Dubai
    const gccBoundary = new Date('2026-10-19T20:30:00.000Z');
    expect(getTodayBusinessDate('Asia/Dubai', gccBoundary)).toBe('2026-10-20');

    // Gracefully handle undefined, null or invalid timezone
    expect(getTodayBusinessDate(null, lateUtcDate)).toBe('2026-10-20'); // falls back to Asia/Kolkata
    expect(getTodayBusinessDate('Invalid/Timezone', lateUtcDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

