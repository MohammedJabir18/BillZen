import type { InvoiceDTO } from '../types';
import {
  calculateLineItem,
  calculateInvoiceTotals,
  formatMinorUnits,
} from './financial';

export interface CalculatedInvoiceItemViewModel {
  id: string;
  name: string;
  nameMalayalam?: string;
  nameArabic?: string;
  sku: string;
  hsn: string;
  quantityFormatted: string;
  unit: string;
  unitPriceFormatted: string;
  discountFormatted: string;
  taxRatePercent: string;
  taxAmountFormatted: string;
  lineTotalFormatted: string;
  // Raw minor values for test verification
  raw: {
    gross_minor: number;
    taxable_minor: number;
    tax_minor: number;
    line_total_minor: number;
  };
}

export interface CalculatedInvoiceViewModel {
  invoiceNumber: string;
  date: string;
  isSample: boolean;
  businessName: string;
  businessLegalName?: string | null;
  businessTaxId: string;
  businessAddress: string;
  businessPhone: string;
  customerName: string;
  customerTaxId: string;
  customerAddress: string;
  currencyCode: string;
  currencySymbol: string;
  currencyExponent: number;
  locale: string;
  items: CalculatedInvoiceItemViewModel[];
  subtotalGrossFormatted: string;
  discountTotalFormatted: string;
  taxableSubtotalFormatted: string;
  taxTotalFormatted: string;
  grandTotalFormatted: string;
  paidAmountFormatted: string;
  balanceDueFormatted: string;
  settlementStatus: 'unpaid' | 'partially_paid' | 'fully_paid';
  settlementStatusText: string;
  taxLabel: string;
  taxIdLabel: string;
  itemTaxHeader: string;
  itemTotalHeader: string;
  notes: string;
  rawTotals: {
    subtotal_gross_minor: number;
    discount_total_minor: number;
    taxable_subtotal_minor: number;
    tax_total_minor: number;
    grand_total_minor: number;
    paid_amount_minor: number;
    balance_due_minor: number;
  };
}

export function createInvoiceViewModel(dto: InvoiceDTO): CalculatedInvoiceViewModel {
  const currencyExponent = dto.currency_exponent ?? 2;
  const currencySymbol = dto.currency_symbol || '₹';

  const formatMoney = (minor: number) => {
    return `${currencySymbol}${formatMinorUnits(minor, currencyExponent)}`;
  };

  const calculatedItems: CalculatedInvoiceItemViewModel[] = [];
  const lineCalculations = dto.items.map((item) => {
    const calc = calculateLineItem(
      item.quantity_scaled,
      item.unit_price_minor,
      item.discount_minor,
      item.tax_rate_bp
    );

    const qtyNumber = item.quantity_scaled / 1000;
    const taxRatePercent = `${(item.tax_rate_bp / 100).toFixed(2)}%`;

    calculatedItems.push({
      id: item.id,
      name: item.name,
      nameMalayalam: item.name_malayalam,
      nameArabic: item.name_arabic,
      sku: item.sku,
      hsn: item.hsn || 'N/A',
      quantityFormatted: qtyNumber.toFixed(3),
      unit: item.unit,
      unitPriceFormatted: formatMoney(item.unit_price_minor),
      discountFormatted: formatMoney(item.discount_minor),
      taxRatePercent,
      taxAmountFormatted: formatMoney(calc.tax_minor),
      lineTotalFormatted: formatMoney(calc.line_total_minor),
      raw: {
        gross_minor: calc.gross_minor,
        taxable_minor: calc.taxable_minor,
        tax_minor: calc.tax_minor,
        line_total_minor: calc.line_total_minor,
      },
    });

    return calc;
  });

  const totals = calculateInvoiceTotals(lineCalculations, dto.paid_amount_minor);

  // Data-driven labels based on jurisdiction / currency
  const isIndia = dto.currency_code === 'INR';
  const taxIdLabel = isIndia ? 'GST / Tax ID' : 'VAT / Tax ID';
  const taxLabel = isIndia ? 'Total Tax (CGST + SGST)' : 'Total VAT / Tax';
  const itemTaxHeader = `Tax (${currencySymbol})`;
  const itemTotalHeader = `Total (${currencySymbol})`;

  let settlementStatusText: string;
  if (totals.settlement_status === 'fully_paid') {
    settlementStatusText = 'Fully Paid';
  } else if (totals.settlement_status === 'partially_paid') {
    settlementStatusText = `Partially Paid (Bal: ${formatMoney(totals.balance_due_minor)})`;
  } else {
    settlementStatusText = 'Unpaid';
  }

  return {
    invoiceNumber: dto.invoice_number,
    date: dto.business_date,
    isSample: dto.is_sample,
    businessName: dto.business_name,
    businessLegalName: dto.business_legal_name,
    businessTaxId: dto.business_tax_id || 'N/A',
    businessAddress: dto.business_address,
    businessPhone: dto.business_phone,
    customerName: dto.customer_name,
    customerTaxId: dto.customer_tax_id || 'Unregistered',
    customerAddress: dto.customer_address || 'Walk-in Counter',
    currencyCode: dto.currency_code,
    currencySymbol,
    currencyExponent,
    locale: dto.locale,
    items: calculatedItems,
    subtotalGrossFormatted: formatMoney(totals.subtotal_minor),
    discountTotalFormatted: formatMoney(totals.discount_total_minor),
    taxableSubtotalFormatted: formatMoney(totals.taxable_amount_minor),
    taxTotalFormatted: formatMoney(totals.tax_total_minor),
    grandTotalFormatted: formatMoney(totals.grand_total_minor),
    paidAmountFormatted: formatMoney(totals.paid_amount_minor),
    balanceDueFormatted: formatMoney(totals.balance_due_minor),
    settlementStatus: totals.settlement_status,
    settlementStatusText,
    taxLabel,
    taxIdLabel,
    itemTaxHeader,
    itemTotalHeader,
    notes: dto.notes || 'Thank you for your business. Computer generated invoice.',
    rawTotals: {
      subtotal_gross_minor: totals.subtotal_minor,
      discount_total_minor: totals.discount_total_minor,
      taxable_subtotal_minor: totals.taxable_amount_minor,
      tax_total_minor: totals.tax_total_minor,
      grand_total_minor: totals.grand_total_minor,
      paid_amount_minor: totals.paid_amount_minor,
      balance_due_minor: totals.balance_due_minor,
    },
  };
}

export const SAMPLE_TWO_LINE_INVOICE_DTO: InvoiceDTO = {
  invoice_number: 'INV-2026-0001',
  business_date: '18/10/2026',
  status: 'finalized',
  is_sample: true,
  business_name: 'BillZen Retail & Wholesale Store',
  business_legal_name: null,
  business_tax_id: '32AAAAA0000A1Z5',
  business_address: '123 Market Road, Kochi, Kerala - 682001, India',
  business_phone: '+91 9876543210',
  customer_name: 'Walk-in Retail Customer / നഗര ഉപഭോക്താവ്',
  customer_tax_id: 'Unregistered',
  customer_address: 'Panampilly Nagar, Kochi, Kerala - 682036',
  currency_code: 'INR',
  currency_symbol: '₹',
  currency_exponent: 2,
  locale: 'en-IN',
  paid_amount_minor: 57339,
  notes: 'Thank you for your business. Computer generated sample invoice.',
  items: [
    {
      id: 'item-1',
      name: 'Organic Basmati Rice 1kg',
      name_malayalam: 'ഓർഗാനിക് ബസുമതി അരി (1 കി.ഗ്രാം)',
      name_arabic: 'أرز بسمتي عضوي 1 كجم',
      sku: 'SKU-RICE-001',
      hsn: '1006.30',
      quantity_scaled: 2000,
      unit: 'kg',
      unit_price_minor: 10000,
      discount_minor: 1000,
      tax_rate_bp: 1800,
    },
    {
      id: 'item-2',
      name: 'Fresh Roasted Arabica Coffee Beans',
      name_malayalam: 'ഫ്രഷ് അറബിക്ക കാപ്പിപ്പൊടി (പ്രീമിയം)',
      name_arabic: 'حبوب بن أرابيكا محمصة طازجة',
      sku: 'SKU-COFFEE-002',
      hsn: '0901.21',
      quantity_scaled: 1375,
      unit: 'kg',
      unit_price_minor: 24550,
      discount_minor: 500,
      tax_rate_bp: 500,
    },
  ],
};
