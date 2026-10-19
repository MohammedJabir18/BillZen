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
  is_setup_completed: boolean;
  appearance_preference: 'system' | 'light' | 'dark';
  guide_status: 'unseen' | 'completed' | 'skipped';
  guide_version: number;
  created_at: number;
  updated_at: number;
}

export interface BusinessProfileDto {
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

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateCategoryDto {
  name: string;
  description?: string | null;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string;
  unit_price_minor: number;
  cost_price_minor: number;
  tax_rate_bp: number;
  is_stock_tracked: boolean;
  current_stock_scaled: number;
  min_stock_threshold_scaled: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateProductDto {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  category_id?: string | null;
  unit?: string | null;
  unit_price_minor: number;
  cost_price_minor?: number | null;
  tax_rate_bp?: number | null;
  is_stock_tracked?: boolean | null;
  opening_stock_scaled?: number | null;
  min_stock_threshold_scaled?: number | null;
}

export interface UpdateProductDto {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  category_id?: string | null;
  unit: string;
  unit_price_minor: number;
  cost_price_minor: number;
  tax_rate_bp: number;
  is_stock_tracked: boolean;
  min_stock_threshold_scaled: number;
}

export interface ProductFilter {
  search?: string | null;
  category_id?: string | null;
  is_active?: boolean | null;
  low_stock_only?: boolean | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  tax_identifier: string | null;
  current_balance_minor: number;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateCustomerDto {
  name: string;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tax_identifier?: string | null;
}

export interface UpdateCustomerDto {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country: string;
  tax_identifier?: string | null;
}

export interface CustomerFilter {
  search?: string | null;
  is_active?: boolean | null;
}

import type { CashbookVoucher } from './cashbook';

export type ActivePrintDocument =
  | { type: 'invoice'; invoice: InvoiceDTO; format?: 'a4' }
  | { type: 'voucher'; voucher: CashbookVoucher; format: 'a4' | 'thermal80' }
  | null;

