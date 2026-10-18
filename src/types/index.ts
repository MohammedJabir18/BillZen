export interface BusinessSettings {
  id: string;
  business_name: string;
  legal_name: string | null;
  tax_identifier: string | null;
  phone: string;
  email: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  currency_code: string;
  currency_symbol: string;
  currency_exponent: number;
  locale: string;
  timezone: string;
  invoice_prefix: string;
  terms_and_conditions: string | null;
  created_at: number;
  updated_at: number;
}

export interface PrintSupportInfo {
  platform: string;
  native_dialog_available: boolean;
  cups_detected: boolean;
  in_app_preview_supported: boolean;
  empirical_status: string;
  notes: string;
}

export interface LineItemCalculation {
  quantity_scaled: number;
  unit_price_minor: number;
  discount_minor: number;
  tax_rate_bp: number;
  gross_minor: number;
  taxable_minor: number;
  tax_minor: number;
  line_total_minor: number;
}

export interface InvoiceTotalsCalculation {
  subtotal_minor: number;
  discount_total_minor: number;
  taxable_amount_minor: number;
  tax_total_minor: number;
  grand_total_minor: number;
  paid_amount_minor: number;
  balance_due_minor: number;
  settlement_status: 'unpaid' | 'partially_paid' | 'fully_paid';
}

export interface InvoiceItemDTO {
  id: string;
  name: string;
  name_malayalam?: string;
  name_arabic?: string;
  sku: string;
  hsn?: string;
  quantity_scaled: number;
  unit: string;
  unit_price_minor: number;
  discount_minor: number;
  tax_rate_bp: number;
}

export interface InvoiceDTO {
  id?: string;
  invoice_number: string;
  business_date: string;
  status: 'draft' | 'finalized';
  is_sample: boolean;
  business_name: string;
  business_legal_name?: string | null;
  business_tax_id?: string | null;
  business_address: string;
  business_phone: string;
  customer_name: string;
  customer_tax_id?: string | null;
  customer_address?: string | null;
  currency_code: string;
  currency_symbol: string;
  currency_exponent: number;
  locale: string;
  items: InvoiceItemDTO[];
  paid_amount_minor: number;
  notes?: string | null;
}
