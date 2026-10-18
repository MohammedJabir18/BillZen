import { describe, it, expect } from 'vitest';
import {
  createInvoiceViewModel,
  SAMPLE_TWO_LINE_INVOICE_DTO,
} from './invoice_view_model';
import type { InvoiceDTO } from '../types';

describe('Printable Invoice ViewModel & Oracle Tests', () => {
  it('evaluates sample two-line invoice to exact independent oracle totals', () => {
    const vm = createInvoiceViewModel(SAMPLE_TWO_LINE_INVOICE_DTO);

    // Independent Oracle Assertions (approved financial rules)
    // 1. Organic Basmati Rice: 2000 scaled @ 10000 minor, 1000 disc, 1800 bp tax
    //    gross = 20000, taxable = 19000, tax = 3420, line_total = 22420
    expect(vm.items[0].raw.gross_minor).toBe(20000);
    expect(vm.items[0].raw.taxable_minor).toBe(19000);
    expect(vm.items[0].raw.tax_minor).toBe(3420);
    expect(vm.items[0].raw.line_total_minor).toBe(22420);
    expect(vm.items[0].lineTotalFormatted).toBe('₹224.20');

    // 2. Fresh Roasted Arabica Coffee: 1375 scaled @ 24550 minor, 500 disc, 500 bp tax
    //    gross = 33756, taxable = 33256, tax = 1663, line_total = 34919
    expect(vm.items[1].raw.gross_minor).toBe(33756);
    expect(vm.items[1].raw.taxable_minor).toBe(33256);
    expect(vm.items[1].raw.tax_minor).toBe(1663);
    expect(vm.items[1].raw.line_total_minor).toBe(34919);
    expect(vm.items[1].lineTotalFormatted).toBe('₹349.19');

    // 3. Document Totals Oracle:
    //    Subtotal Gross: 20000 + 33756 = 53756 minor (₹537.56)
    //    Discounts: 1000 + 500 = 1500 minor (₹15.00)
    //    Taxable Subtotal: 19000 + 33256 = 52256 minor (₹522.56)
    //    Total Tax: 3420 + 1663 = 5083 minor (₹50.83)
    //    Grand Total: 22420 + 34919 = 57339 minor (₹573.39)
    expect(vm.rawTotals.subtotal_gross_minor).toBe(53756);
    expect(vm.rawTotals.discount_total_minor).toBe(1500);
    expect(vm.rawTotals.taxable_subtotal_minor).toBe(52256);
    expect(vm.rawTotals.tax_total_minor).toBe(5083);
    expect(vm.rawTotals.grand_total_minor).toBe(57339);

    // Formatted presentation assertions
    expect(vm.subtotalGrossFormatted).toBe('₹537.56');
    expect(vm.discountTotalFormatted).toBe('₹15.00');
    expect(vm.taxableSubtotalFormatted).toBe('₹522.56');
    expect(vm.taxTotalFormatted).toBe('₹50.83');
    expect(vm.grandTotalFormatted).toBe('₹573.39');

    // Data-driven labels for India (INR)
    expect(vm.taxIdLabel).toBe('GST / Tax ID');
    expect(vm.taxLabel).toBe('Total Tax (CGST + SGST)');
    expect(vm.itemTaxHeader).toBe('Tax (₹)');
    expect(vm.itemTotalHeader).toBe('Total (₹)');
  });

  it('correctly formats and labels 3-decimal GCC currency invoice (KWD)', () => {
    const kwdInvoiceDTO: InvoiceDTO = {
      invoice_number: 'INV-KW-001',
      business_date: '18/10/2026',
      status: 'finalized',
      is_sample: false,
      business_name: 'Kuwait Central Trading Co.',
      business_legal_name: 'Kuwait Central W.L.L.',
      business_tax_id: '123456789012345',
      business_address: 'Salem Al Mubarak St, Salmiya, Kuwait',
      business_phone: '+965 22000000',
      customer_name: 'Ahmed Al-Sabah',
      customer_tax_id: null,
      customer_address: 'Kuwait City',
      currency_code: 'KWD',
      currency_symbol: 'KD ',
      currency_exponent: 3,
      locale: 'en-KW',
      paid_amount_minor: 3281,
      items: [
        {
          id: 'kwd-item-1',
          name: 'Premium Basmati Rice 5kg',
          sku: 'SKU-KW-RICE',
          quantity_scaled: 1500, // 1.500 units/kg
          unit: 'kg',
          unit_price_minor: 2250, // 2.250 KD
          discount_minor: 250, // 0.250 KD
          tax_rate_bp: 500, // 5% VAT (500 bp)
        },
      ],
    };

    const vm = createInvoiceViewModel(kwdInvoiceDTO);

    // 1.500 * 2250 = 3375 gross, discount = 250, taxable = 3125, tax = 156, total = 3281
    expect(vm.rawTotals.subtotal_gross_minor).toBe(3375);
    expect(vm.rawTotals.discount_total_minor).toBe(250);
    expect(vm.rawTotals.taxable_subtotal_minor).toBe(3125);
    expect(vm.rawTotals.tax_total_minor).toBe(156);
    expect(vm.rawTotals.grand_total_minor).toBe(3281);

    expect(vm.subtotalGrossFormatted).toBe('KD 3.375');
    expect(vm.discountTotalFormatted).toBe('KD 0.250');
    expect(vm.taxableSubtotalFormatted).toBe('KD 3.125');
    expect(vm.taxTotalFormatted).toBe('KD 0.156');
    expect(vm.grandTotalFormatted).toBe('KD 3.281');

    // Data-driven labels for GCC (KWD)
    expect(vm.taxIdLabel).toBe('VAT / Tax ID');
    expect(vm.taxLabel).toBe('Total VAT / Tax');
    expect(vm.itemTaxHeader).toBe('Tax (KD )');
    expect(vm.itemTotalHeader).toBe('Total (KD )');
  });
});
