//! Validate draft arithmetic and durable retry evidence before workspace replacement.
use crate::domain::invoice_drafts::*;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
fn rows<'a>(d: &'a BTreeMap<String, Value>, key: &str) -> Result<&'a Vec<Value>, String> {
    d.get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Missing draft backup table {key}"))
}
fn integer(v: &Value, min: i64) -> bool {
    v.as_i64()
        .is_some_and(|n| n >= min && n <= crate::domain::financial::MAX_SAFE_MONEY_MINOR)
}
macro_rules! check {
    ($condition:expr,$message:expr) => {
        if !$condition {
            return Err(format!("Invalid draft backup: {}", $message));
        }
    };
}
fn date(v: &Value) -> Result<(), String> {
    let s = v.as_str().ok_or("Missing draft date")?;
    let d = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| "Invalid draft date")?;
    check!(
        s.len() == 10 && d.format("%Y-%m-%d").to_string() == s,
        "date"
    );
    Ok(())
}
pub fn validate(d: &BTreeMap<String, Value>) -> Result<(), String> {
    let invoices = rows(d, "invoices")?;
    let lines = rows(d, "invoice_items")?;
    let journal = rows(d, "draft_create_operations")?;
    let mut owners = HashMap::new();
    let mut keys = HashSet::new();
    for j in journal {
        let key = j["idempotency_key"]
            .as_str()
            .ok_or("Missing draft retry key")?;
        let id = j["invoice_id"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or("Missing draft invoice identity")?;
        check!(
            keys.insert(key) && owners.insert(id, j).is_none(),
            "duplicate journal identity"
        );
        let json = j["request_json"].as_str().ok_or("Missing draft request")?;
        let mut request: CreateDraftInvoiceRequest =
            serde_json::from_str(json).map_err(|e| e.to_string())?;
        check!(
            request.idempotency_key == request.idempotency_key.trim()
                && !request.idempotency_key.is_empty()
                && request.idempotency_key.len() <= 200,
            "retry key"
        );
        request.customer_id = normalize_optional(request.customer_id);
        request.notes = normalize_optional(request.notes);
        normalize_items(&mut request.items)?;
        calculate_draft(&request.items)?;
        check!(
            request
                .notes
                .as_ref()
                .is_none_or(|s| s.chars().count() <= 2000),
            "notes"
        );
        date(&serde_json::json!(request.business_date))?;
        check!(
            serde_json::to_string(&request).map_err(|e| e.to_string())? == json
                && key == format!("draft-create:{}", request.idempotency_key),
            "canonical create intent"
        );
        check!(
            j["request_fingerprint"] == format!("{:x}", Sha256::digest(json.as_bytes()))
                && integer(&j["created_at"], 0),
            "journal hash/time"
        );
        let invoice = invoices.iter().find(|i| i["id"] == id);
        if !j["deleted_at"].is_null() {
            check!(
                integer(&j["deleted_at"], 0)
                    && integer(&j["deleted_version"], 1)
                    && invoice.is_none(),
                "deleted identity"
            );
        } else {
            check!(j["deleted_version"].is_null(), "live deletion version");
            let i = invoice.ok_or("Live draft journal missing invoice")?;
            if let Some(expected) = &request.expected_currency {
                check!(
                    d["business_settings"]["currency_code"] == expected.code
                        && d["business_settings"]["currency_exponent"] == expected.exponent,
                    "creation currency"
                );
            }
            check!(
                i["status"] == "draft"
                    && i["idempotency_key"] == key
                    && i["request_fingerprint"] == j["request_fingerprint"]
                    && i["created_at"] == j["created_at"],
                "creation evidence"
            );
        }
    }
    for i in invoices.iter().filter(|i| i["status"] == "draft") {
        let id = i["id"].as_str().ok_or("Missing draft ID")?;
        check!(
            owners.contains_key(id)
                && integer(&i["draft_version"], 1)
                && integer(&i["created_at"], 0)
                && integer(&i["updated_at"], 0),
            "draft journal/version"
        );
        date(&i["business_date"])?;
        check!(
            i["customer_id"].is_null()
                || rows(d, "customers")?
                    .iter()
                    .any(|c| c["id"] == i["customer_id"]),
            "customer reference"
        );
        check!(
            i["snapshot_currency_exponent"] == d["business_settings"]["currency_exponent"],
            "currency exponent"
        );
        for key in [
            "invoice_number",
            "sequence_number",
            "finalized_at",
            "business_name_snap",
            "business_legal_name_snap",
            "business_address_snap",
            "business_phone_snap",
            "business_email_snap",
            "business_tax_id_snap",
            "currency_code_snap",
            "currency_symbol_snap",
            "terms_snap",
            "customer_name_snap",
            "customer_phone_snap",
            "customer_address_snap",
            "customer_tax_id_snap",
        ] {
            check!(i[key].is_null(), "finalization fields");
        }
        check!(
            i["notes"].is_null()
                || i["notes"]
                    .as_str()
                    .is_some_and(|s| s.chars().count() <= 2000),
            "notes"
        );
        let mut own: Vec<&Value> = lines.iter().filter(|l| l["invoice_id"] == id).collect();
        own.sort_by_key(|l| l["line_number"].as_i64().unwrap_or(-1));
        let mut inputs = vec![];
        for (index, l) in own.iter().enumerate() {
            check!(
                l["line_number"].as_i64() == Some(index as i64 + 1) && integer(&l["created_at"], 0),
                "line order/time"
            );
            check!(
                l["product_id"].is_null()
                    || rows(d, "products")?
                        .iter()
                        .any(|p| p["id"] == l["product_id"]),
                "product reference"
            );
            let raw = serde_json::json!({"product_id":l["product_id"],"product_name":l["product_name_snap"],"product_sku":if l["product_sku_snap"]=="" {Value::Null}else{l["product_sku_snap"].clone()},"unit":l["unit_snap"],"cost_price_minor":l["cost_price_minor_snap"],"quantity_scaled":l["quantity_scaled"],"unit_price_minor":l["unit_price_minor"],"discount_minor":l["discount_minor"],"tax_rate_bp":l["tax_rate_bp"]});
            let mut input: Vec<DraftItemInput> =
                vec![serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?];
            normalize_items(&mut input)?;
            check!(
                serde_json::to_value(&input[0]).map_err(|e| e.to_string())? == raw,
                "canonical line"
            );
            let (calc, _) = calculate_draft(&input)?;
            let calc = serde_json::to_value(&calc[0]).map_err(|e| e.to_string())?;
            for key in ["taxable_minor", "tax_minor", "line_total_minor"] {
                check!(l[key] == calc[key], "line arithmetic");
            }
            inputs.push(input.remove(0));
        }
        let (_, totals) = calculate_draft(&inputs)?;
        let totals = serde_json::to_value(totals).map_err(|e| e.to_string())?;
        for (key, value) in totals.as_object().unwrap() {
            check!(i[key] == *value, "invoice totals");
        }
    }
    for l in lines {
        check!(
            invoices.iter().any(|i| i["id"] == l["invoice_id"]),
            "orphan invoice item"
        );
    }
    Ok(())
}
