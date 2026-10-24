use super::financial::{
    calculate_invoice_totals, calculate_line_item, InvoiceTotalsCalculation, LineItemCalculation,
    MAX_MONEY_MINOR,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DraftItemInput {
    pub product_id: Option<String>,
    pub product_name: String,
    pub product_sku: Option<String>,
    pub unit: String,
    pub cost_price_minor: i64,
    pub quantity_scaled: i64,
    pub unit_price_minor: i64,
    pub discount_minor: i64,
    pub tax_rate_bp: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DraftCurrency {
    pub code: String,
    pub exponent: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDraftInvoiceRequest {
    pub idempotency_key: String,
    pub customer_id: Option<String>,
    pub business_date: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<DraftItemInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_currency: Option<DraftCurrency>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDraftInvoiceRequest {
    pub id: String,
    pub expected_version: i64,
    pub customer_id: Option<String>,
    pub business_date: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<DraftItemInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_currency: Option<DraftCurrency>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InvoiceDraftItemDto {
    pub id: String,
    pub line_number: i64,
    #[serde(flatten)]
    pub input: DraftItemInput,
    pub product_archived: bool,
    pub gross_minor: i64,
    pub taxable_minor: i64,
    pub tax_minor: i64,
    pub line_total_minor: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InvoiceDraftDetailDto {
    pub id: String,
    pub draft_version: i64,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub customer_archived: bool,
    pub business_date: String,
    pub notes: Option<String>,
    pub currency_code: String,
    pub currency_exponent: i32,
    pub subtotal_minor: i64,
    pub discount_total_minor: i64,
    pub taxable_amount_minor: i64,
    pub tax_total_minor: i64,
    pub grand_total_minor: i64,
    pub items: Vec<InvoiceDraftItemDto>,
    pub created_at: i64,
    pub updated_at: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InvoiceDraftSummaryDto {
    pub id: String,
    pub draft_version: i64,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub customer_archived: bool,
    pub business_date: String,
    pub item_count: usize,
    pub grand_total_minor: i64,
    pub currency_code: String,
    pub currency_exponent: i32,
    pub updated_at: i64,
}
pub fn normalize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
pub fn normalize_items(items: &mut [DraftItemInput]) -> Result<(), String> {
    if items.len() > 500 {
        return Err("DRAFT_REJECTED: Too many lines (maximum 500)".into());
    }
    for item in items {
        item.product_id = normalize_optional(item.product_id.take());
        item.product_sku = normalize_optional(item.product_sku.take());
        item.product_name = item.product_name.trim().to_string();
        item.unit = item.unit.trim().to_string();
        if item.product_name.is_empty()
            || item.product_name.chars().count() > 200
            || item.unit.is_empty()
            || item.unit.chars().count() > 50
            || item
                .product_sku
                .as_ref()
                .is_some_and(|s| s.chars().count() > 100)
        {
            return Err("DRAFT_REJECTED: Invalid item name, SKU or unit".into());
        }
    }
    Ok(())
}
pub fn calculate_draft(
    items: &[DraftItemInput],
) -> Result<(Vec<LineItemCalculation>, InvoiceTotalsCalculation), String> {
    let lines = items
        .iter()
        .map(|i| {
            if !(0..=MAX_MONEY_MINOR).contains(&i.cost_price_minor) {
                return Err("DRAFT_REJECTED: Invalid cost price".into());
            }
            calculate_line_item(
                i.quantity_scaled,
                i.unit_price_minor,
                i.discount_minor,
                i.tax_rate_bp,
            )
            .map_err(|e| format!("DRAFT_REJECTED: {e}"))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let totals = calculate_invoice_totals(&lines, 0).map_err(|e| format!("DRAFT_REJECTED: {e}"))?;
    Ok((lines, totals))
}
