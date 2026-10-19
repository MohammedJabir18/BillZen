import { describe, it, expect } from 'vitest';
import { integerToWords, minorUnitsToWords } from './number_to_words';

describe('integerToWords', () => {
  it('converts zero and simple integers', () => {
    expect(integerToWords(0)).toBe('Zero');
    expect(integerToWords(1)).toBe('One');
    expect(integerToWords(15)).toBe('Fifteen');
    expect(integerToWords(20)).toBe('Twenty');
    expect(integerToWords(42)).toBe('Forty Two');
    expect(integerToWords(105)).toBe('One Hundred Five');
    expect(integerToWords(1234)).toBe('One Thousand Two Hundred Thirty Four');
    expect(integerToWords(1000000)).toBe('One Million');
  });
});

describe('minorUnitsToWords', () => {
  it('handles zero amounts correctly', () => {
    expect(minorUnitsToWords(0, 'INR', 2)).toBe('Zero Rupees Only');
    expect(minorUnitsToWords(0, 'AED', 2)).toBe('Zero Dirhams Only');
    expect(minorUnitsToWords(0, 'KWD', 3)).toBe('Zero Dinars Only');
  });

  it('formats INR (Rupees and Paise) correctly', () => {
    expect(minorUnitsToWords(10000, 'INR', 2)).toBe('One Hundred Rupees Only');
    expect(minorUnitsToWords(1000000, 'INR', 2)).toBe('Ten Thousand Rupees Only');
    expect(minorUnitsToWords(1050, 'INR', 2)).toBe('Ten Rupees and Fifty Paise Only');
    expect(minorUnitsToWords(75, 'INR', 2)).toBe('Seventy Five Paise Only');
  });

  it('formats GCC currencies correctly (AED, SAR, KWD)', () => {
    // AED (Dirhams & Fils, 2 decimals)
    expect(minorUnitsToWords(250050, 'AED', 2)).toBe(
      'Two Thousand Five Hundred Dirhams and Fifty Fils Only'
    );

    // SAR (Riyals & Halalas, 2 decimals)
    expect(minorUnitsToWords(15000, 'SAR', 2)).toBe('One Hundred Fifty Riyals Only');

    // KWD (Dinars & Fils, 3 decimals)
    expect(minorUnitsToWords(12345, 'KWD', 3)).toBe(
      'Twelve Dinars and Three Hundred Forty Five Fils Only'
    );
    expect(minorUnitsToWords(500, 'KWD', 3)).toBe('Five Hundred Fils Only');
  });

  it('formats international currencies (USD, EUR, GBP)', () => {
    expect(minorUnitsToWords(5000, 'USD', 2)).toBe('Fifty Dollars Only');
    expect(minorUnitsToWords(9999, 'EUR', 2)).toBe(
      'Ninety Nine Euros and Ninety Nine Cents Only'
    );
    expect(minorUnitsToWords(10025, 'GBP', 2)).toBe(
      'One Hundred Pounds and Twenty Five Pence Only'
    );
  });
});
