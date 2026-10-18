import type { LineItemCalculation, InvoiceTotalsCalculation } from '../types';

export const QUANTITY_SCALED_FACTOR = 1000;
export const TAX_BASIS_POINTS_FACTOR = 10000;

export const MAX_MONEY_MINOR = 1_000_000_000_00; // ₹1,000,000,000.00 (₹1 Billion)
export const MAX_QUANTITY_SCALED = 1_000_000_000; // 1,000,000.000 units
export const MAX_SAFE_MONEY_MINOR = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER (2^53 - 1)

export function safeBigIntToNumber(value: bigint): number {
  if (value > BigInt(MAX_SAFE_MONEY_MINOR) || value < -BigInt(MAX_SAFE_MONEY_MINOR)) {
    throw new Error(`Numeric overflow: ${value.toString()} exceeds maximum safe integer range (${MAX_SAFE_MONEY_MINOR})`);
  }
  return Number(value);
}

export function roundHalfUp(n: number, divisor: number): number {
  if (divisor <= 0) throw new Error('Divisor must be positive');
  const half = Math.floor(divisor / 2);
  return Math.floor((n + half) / divisor);
}

export function calculateLineItem(
  quantity_scaled: number,
  unit_price_minor: number,
  discount_minor: number,
  tax_rate_bp: number
): LineItemCalculation {
  if (!Number.isSafeInteger(quantity_scaled) || quantity_scaled <= 0 || quantity_scaled > MAX_QUANTITY_SCALED) {
    throw new Error(`Invalid quantity_scaled: ${quantity_scaled}`);
  }
  if (!Number.isSafeInteger(unit_price_minor) || unit_price_minor < 0 || unit_price_minor > MAX_MONEY_MINOR) {
    throw new Error(`Invalid unit_price_minor: ${unit_price_minor}`);
  }
  if (!Number.isSafeInteger(discount_minor) || discount_minor < 0) {
    throw new Error(`Invalid discount_minor: ${discount_minor}`);
  }
  if (!Number.isSafeInteger(tax_rate_bp) || tax_rate_bp < 0 || tax_rate_bp > TAX_BASIS_POINTS_FACTOR) {
    throw new Error(`Invalid tax_rate_bp: ${tax_rate_bp}`);
  }

  // Exact intermediate arithmetic with BigInt prevents IEEE 754 floating point distortion
  const qBig = BigInt(quantity_scaled);
  const pBig = BigInt(unit_price_minor);
  const productBig = qBig * pBig;
  const grossBig = (productBig + 500n) / 1000n;
  const gross_minor = safeBigIntToNumber(grossBig);

  if (discount_minor > gross_minor) {
    throw new Error(`Discount ${discount_minor} exceeds gross line amount ${gross_minor}`);
  }

  const taxable_minor = gross_minor - discount_minor;

  const taxableBig = BigInt(taxable_minor);
  const taxRateBig = BigInt(tax_rate_bp);
  const taxProductBig = taxableBig * taxRateBig;
  const taxBig = (taxProductBig + 5000n) / 10000n;
  const tax_minor = safeBigIntToNumber(taxBig);

  const lineTotalBig = BigInt(taxable_minor) + BigInt(tax_minor);
  const line_total_minor = safeBigIntToNumber(lineTotalBig);

  return {
    quantity_scaled,
    unit_price_minor,
    discount_minor,
    tax_rate_bp,
    gross_minor,
    taxable_minor,
    tax_minor,
    line_total_minor,
  };
}

export function calculateInvoiceTotals(
  items: LineItemCalculation[],
  paid_amount_minor: number
): InvoiceTotalsCalculation {
  if (!Number.isSafeInteger(paid_amount_minor) || paid_amount_minor < 0) {
    throw new Error(`Invalid paid_amount_minor: ${paid_amount_minor}`);
  }

  let subtotalBig = 0n;
  let discountTotalBig = 0n;
  let taxableAmountBig = 0n;
  let taxTotalBig = 0n;
  let grandTotalBig = 0n;

  for (const item of items) {
    subtotalBig += BigInt(item.gross_minor);
    discountTotalBig += BigInt(item.discount_minor);
    taxableAmountBig += BigInt(item.taxable_minor);
    taxTotalBig += BigInt(item.tax_minor);
    grandTotalBig += BigInt(item.line_total_minor);
  }

  const subtotal_minor = safeBigIntToNumber(subtotalBig);
  const discount_total_minor = safeBigIntToNumber(discountTotalBig);
  const taxable_amount_minor = safeBigIntToNumber(taxableAmountBig);
  const tax_total_minor = safeBigIntToNumber(taxTotalBig);
  const grand_total_minor = safeBigIntToNumber(grandTotalBig);

  if (paid_amount_minor > grand_total_minor) {
    throw new Error(`Payment ${paid_amount_minor} exceeds grand total ${grand_total_minor}`);
  }

  const balance_due_minor = grand_total_minor - paid_amount_minor;

  let settlement_status: 'unpaid' | 'partially_paid' | 'fully_paid';
  if (grand_total_minor === 0) {
    settlement_status = 'fully_paid';
  } else if (paid_amount_minor === 0) {
    settlement_status = 'unpaid';
  } else if (paid_amount_minor === grand_total_minor) {
    settlement_status = 'fully_paid';
  } else {
    settlement_status = 'partially_paid';
  }

  return {
    subtotal_minor,
    discount_total_minor,
    taxable_amount_minor,
    tax_total_minor,
    grand_total_minor,
    paid_amount_minor,
    balance_due_minor,
    settlement_status,
  };
}

export function formatMinorUnits(minor: number, exponent: number = 2): string {
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Invalid minor units: ${minor}`);
  }
  const exp = exponent < 0 || exponent > 6 ? 2 : exponent;
  const isNegative = minor < 0;
  const absMinor = Math.abs(minor);
  const divisor = Math.pow(10, exp);
  const whole = Math.floor(absMinor / divisor);
  const fraction = absMinor % divisor;
  return `${isNegative ? '-' : ''}${whole}.${fraction.toString().padStart(exp, '0')}`;
}

export function parseToMinorUnits(valueStr: string, exponent: number = 2): number {
  const trimmed = valueStr.trim();
  if (!trimmed) return 0;
  const exp = exponent < 0 || exponent > 6 ? 2 : exponent;

  let isNegative = false;
  let rest = trimmed;
  if (rest.startsWith('-')) {
    isNegative = true;
    rest = rest.slice(1);
  } else if (rest.startsWith('+')) {
    rest = rest.slice(1);
  }

  if (!rest) {
    throw new Error(`Invalid numeric input: '${valueStr}'`);
  }

  const parts = rest.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal format with multiple points: '${valueStr}'`);
  }

  const wholeStr = parts[0];
  const fractionStr = parts[1];

  // Validate whole string grouping
  let rawWhole: string;
  if (wholeStr.includes(',')) {
    const segments = wholeStr.split(',');
    if (segments.some((s) => s.length === 0)) {
      throw new Error(`Invalid thousands grouping in '${valueStr}'`);
    }
    if (segments[0].length === 0 || segments[0].length > 3 || !/^\d+$/.test(segments[0])) {
      throw new Error(`Invalid thousands grouping in '${valueStr}'`);
    }
    const isStandard = segments.slice(1).every((s) => s.length === 3 && /^\d+$/.test(s));
    const isIndian =
      segments.length >= 2 &&
      segments[0].length <= 2 &&
      segments[segments.length - 1].length === 3 &&
      /^\d+$/.test(segments[segments.length - 1]) &&
      segments.slice(1, -1).every((s) => s.length === 2 && /^\d+$/.test(s));

    if (!isStandard && !isIndian) {
      throw new Error(`Invalid thousands separator formatting in '${valueStr}'`);
    }
    rawWhole = wholeStr.replace(/,/g, '');
  } else {
    if (!/^\d+$/.test(wholeStr)) {
      throw new Error(`Invalid numeric characters in integer part: '${valueStr}'`);
    }
    rawWhole = wholeStr;
  }

  // Fraction validation & excess-precision policy
  let rawFraction = 0;
  if (fractionStr !== undefined) {
    if (!/^\d+$/.test(fractionStr)) {
      throw new Error(`Invalid decimal characters in fractional part: '${valueStr}'`);
    }
    if (fractionStr.length > exp) {
      throw new Error(
        `Excess decimal precision: '${valueStr}' has ${fractionStr.length} decimal places, maximum permitted is ${exp}`
      );
    }
    const padded = fractionStr.padEnd(exp, '0');
    rawFraction = Number(padded);
  }

  const wholeBig = BigInt(rawWhole);
  const multiplier = 10n ** BigInt(exp);
  const fractionBig = BigInt(rawFraction);
  const minorBig = wholeBig * multiplier + fractionBig;

  if (minorBig > BigInt(MAX_SAFE_MONEY_MINOR)) {
    throw new Error(`Numeric value exceeds maximum allowable limit: '${valueStr}'`);
  }

  const result = safeBigIntToNumber(minorBig);
  return isNegative ? -result : result;
}
