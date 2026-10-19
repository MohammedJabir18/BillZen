// Deterministic currency amount in words generator for vouchers

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertThreeDigits(num: number): string {
  let str = '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundreds > 0) {
    str += `${ONES[hundreds]} Hundred`;
    if (remainder > 0) {
      str += ' ';
    }
  }

  if (remainder > 0) {
    if (remainder < 20) {
      str += ONES[remainder];
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      str += TENS[ten];
      if (one > 0) {
        str += ` ${ONES[one]}`;
      }
    }
  }

  return str;
}

export function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (!Number.isSafeInteger(n) || n < 0) return '';

  const chunks: { divisor: number; label: string }[] = [
    { divisor: 1_000_000_000_000, label: 'Trillion' },
    { divisor: 1_000_000_000, label: 'Billion' },
    { divisor: 1_000_000, label: 'Million' },
    { divisor: 1_000, label: 'Thousand' },
    { divisor: 1, label: '' },
  ];

  let remaining = n;
  const parts: string[] = [];

  for (const chunk of chunks) {
    if (remaining >= chunk.divisor) {
      const quotient = Math.floor(remaining / chunk.divisor);
      remaining = remaining % chunk.divisor;
      const chunkWords = convertThreeDigits(quotient);
      if (chunkWords) {
        if (chunk.label) {
          parts.push(`${chunkWords} ${chunk.label}`);
        } else {
          parts.push(chunkWords);
        }
      }
    }
  }

  return parts.join(' ');
}

export interface CurrencyWordsUnit {
  majorUnit: string;
  minorUnit: string;
}

const CURRENCY_UNITS: Record<string, CurrencyWordsUnit> = {
  INR: { majorUnit: 'Rupees', minorUnit: 'Paise' },
  AED: { majorUnit: 'Dirhams', minorUnit: 'Fils' },
  SAR: { majorUnit: 'Riyals', minorUnit: 'Halalas' },
  QAR: { majorUnit: 'Riyals', minorUnit: 'Dirhams' },
  KWD: { majorUnit: 'Dinars', minorUnit: 'Fils' },
  BHD: { majorUnit: 'Dinars', minorUnit: 'Fils' },
  OMR: { majorUnit: 'Rials', minorUnit: 'Baisa' },
  USD: { majorUnit: 'Dollars', minorUnit: 'Cents' },
  EUR: { majorUnit: 'Euros', minorUnit: 'Cents' },
  GBP: { majorUnit: 'Pounds', minorUnit: 'Pence' },
};

/**
 * Converts minor units (e.g. 10000 for ₹100.00) into deterministic English words.
 */
export function minorUnitsToWords(
  amountMinor: number,
  currencyCode: string = 'INR',
  exponent: number = 2
): string {
  const exp = exponent < 0 || exponent > 6 ? 2 : exponent;
  const absMinor = Math.abs(amountMinor);
  const divisor = Math.pow(10, exp);
  const major = Math.floor(absMinor / divisor);
  const minor = absMinor % divisor;

  const unit = CURRENCY_UNITS[currencyCode.toUpperCase()] || {
    majorUnit: currencyCode.toUpperCase(),
    minorUnit: 'Cents',
  };

  const majorWords = integerToWords(major);
  let result = '';

  if (major > 0) {
    result = `${majorWords} ${unit.majorUnit}`;
  } else if (minor === 0) {
    result = `Zero ${unit.majorUnit}`;
  }

  if (minor > 0) {
    const minorWords = integerToWords(minor);
    if (result) {
      result += ` and ${minorWords} ${unit.minorUnit}`;
    } else {
      result = `${minorWords} ${unit.minorUnit}`;
    }
  }

  return `${result} Only`;
}
