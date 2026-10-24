export interface DraftItemInput {
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  unit: string;
  cost_price_minor: number;
  quantity_scaled: number;
  unit_price_minor: number;
  discount_minor: number;
  tax_rate_bp: number;
}
export interface CreateDraftInvoiceRequest {
  idempotency_key: string;
  customer_id: string | null;
  business_date: string | null;
  notes: string | null;
  items: DraftItemInput[];
  expected_currency?: {code:string;exponent:number};
}
export interface UpdateDraftInvoiceRequest extends Omit<CreateDraftInvoiceRequest,'idempotency_key'> {
  id: string;
  expected_version: number;
}
export interface InvoiceDraftItemDto extends DraftItemInput {
  id: string;
  line_number: number;
  product_archived: boolean;
  gross_minor: number;
  taxable_minor: number;
  tax_minor: number;
  line_total_minor: number;
}
export interface InvoiceDraftSummaryDto {
  id: string;
  draft_version: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_archived: boolean;
  business_date: string;
  item_count: number;
  grand_total_minor: number;
  currency_code: string;
  currency_exponent: number;
  updated_at: number;
}
export interface InvoiceDraftDetailDto extends Omit<InvoiceDraftSummaryDto,'item_count'> {
  notes: string | null;
  subtotal_minor: number;
  discount_total_minor: number;
  taxable_amount_minor: number;
  tax_total_minor: number;
  items: InvoiceDraftItemDto[];
  created_at: number;
}
