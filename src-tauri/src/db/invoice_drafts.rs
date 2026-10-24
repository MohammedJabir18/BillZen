use crate::domain::financial::{InvoiceTotalsCalculation, LineItemCalculation};
use crate::domain::invoice_drafts::*;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
fn sql(e: rusqlite::Error) -> String {
    e.to_string()
}
fn date(conn: &Connection, value: Option<String>) -> Result<String, String> {
    let value = match value {
        Some(v) => v,
        None => {
            let zone: String = conn
                .query_row(
                    "SELECT timezone FROM business_settings WHERE id='default'",
                    [],
                    |r| r.get(0),
                )
                .map_err(sql)?;
            crate::domain::cashbook::format_business_date_and_year_month(chrono::Utc::now(), &zone)
                .0
        }
    };
    let parsed = chrono::NaiveDate::parse_from_str(&value, "%Y-%m-%d")
        .map_err(|_| "DRAFT_REJECTED: Invalid business date")?;
    if parsed.format("%Y-%m-%d").to_string() != value || value.len() != 10 {
        return Err("DRAFT_REJECTED: Invalid business date".into());
    }
    Ok(value)
}
fn validate_refs(
    conn: &Connection,
    customer: &Option<String>,
    items: &[DraftItemInput],
    existing: Option<&InvoiceDraftDetailDto>,
) -> Result<(), String> {
    if let Some(id) = customer {
        let active: Option<bool> = conn
            .query_row("SELECT is_active FROM customers WHERE id=?", [id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(sql)?;
        if active.is_none()
            || (active == Some(false)
                && !existing.is_some_and(|d| d.customer_id.as_ref() == Some(id)))
        {
            return Err("DRAFT_REJECTED: Customer missing or archived".into());
        }
    }
    for item in items {
        if let Some(id) = &item.product_id {
            let active: Option<bool> = conn
                .query_row("SELECT is_active FROM products WHERE id=?", [id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(sql)?;
            if active.is_none()
                || (active == Some(false)
                    && !existing.is_some_and(|d| {
                        d.items
                            .iter()
                            .any(|i| i.input.product_id.as_ref() == Some(id))
                    }))
            {
                return Err("DRAFT_REJECTED: Product missing or archived".into());
            }
        }
    }
    Ok(())
}
fn notes(value: Option<String>) -> Result<Option<String>, String> {
    let v = normalize_optional(value);
    if v.as_ref().is_some_and(|s| s.chars().count() > 2000) {
        return Err("DRAFT_REJECTED: Notes too long".into());
    }
    Ok(v)
}
pub fn get_invoice_draft(conn: &Connection, id: &str) -> Result<InvoiceDraftDetailDto, String> {
    let mut d=conn.query_row("SELECT i.id,i.draft_version,i.customer_id,c.name,COALESCE(c.is_active=0,0),i.business_date,i.notes,s.currency_code,i.snapshot_currency_exponent,i.subtotal_minor,i.discount_total_minor,i.taxable_amount_minor,i.tax_total_minor,i.grand_total_minor,i.created_at,i.updated_at FROM invoices i CROSS JOIN business_settings s LEFT JOIN customers c ON c.id=i.customer_id WHERE i.id=? AND i.status='draft' AND s.id='default'",[id],|r|Ok(InvoiceDraftDetailDto {
        id:r.get(0)?,draft_version:r.get(1)?,customer_id:r.get(2)?,customer_name:r.get(3)?,customer_archived:r.get(4)?,business_date:r.get(5)?,notes:r.get(6)?,currency_code:r.get(7)?,currency_exponent:r.get(8)?,subtotal_minor:r.get(9)?,discount_total_minor:r.get(10)?,taxable_amount_minor:r.get(11)?,tax_total_minor:r.get(12)?,grand_total_minor:r.get(13)?,items:vec![],created_at:r.get(14)?,updated_at:r.get(15)?
    })).optional().map_err(sql)?.ok_or("DRAFT_REJECTED: Draft not found")?;
    let mut stmt=conn.prepare("SELECT l.id,l.line_number,l.product_id,l.product_name_snap,l.product_sku_snap,l.unit_snap,l.cost_price_minor_snap,l.quantity_scaled,l.unit_price_minor,l.discount_minor,l.tax_rate_bp,COALESCE(p.is_active=0,0),l.taxable_minor,l.tax_minor,l.line_total_minor FROM invoice_items l LEFT JOIN products p ON p.id=l.product_id WHERE l.invoice_id=? ORDER BY l.line_number").map_err(sql)?;
    d.items = stmt
        .query_map([id], |r| {
            let taxable: i64 = r.get(12)?;
            let discount: i64 = r.get(9)?;
            Ok(InvoiceDraftItemDto {
                id: r.get(0)?,
                line_number: r.get(1)?,
                input: DraftItemInput {
                    product_id: r.get(2)?,
                    product_name: r.get(3)?,
                    product_sku: normalize_optional(Some(r.get(4)?)),
                    unit: r.get(5)?,
                    cost_price_minor: r.get(6)?,
                    quantity_scaled: r.get(7)?,
                    unit_price_minor: r.get(8)?,
                    discount_minor: discount,
                    tax_rate_bp: r.get(10)?,
                },
                product_archived: r.get(11)?,
                gross_minor: taxable + discount,
                taxable_minor: taxable,
                tax_minor: r.get(13)?,
                line_total_minor: r.get(14)?,
            })
        })
        .map_err(sql)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql)?;
    Ok(d)
}
pub fn list_invoice_drafts(conn: &Connection) -> Result<Vec<InvoiceDraftSummaryDto>, String> {
    let mut stmt=conn.prepare("SELECT i.id,i.draft_version,i.customer_id,c.name,COALESCE(c.is_active=0,0),i.business_date,(SELECT count(*) FROM invoice_items l WHERE l.invoice_id=i.id),i.grand_total_minor,s.currency_code,i.snapshot_currency_exponent,i.updated_at FROM invoices i CROSS JOIN business_settings s LEFT JOIN customers c ON c.id=i.customer_id WHERE i.status='draft' AND s.id='default' ORDER BY i.updated_at DESC,i.id DESC").map_err(sql)?;
    let result = stmt
        .query_map([], |r| {
            Ok(InvoiceDraftSummaryDto {
                id: r.get(0)?,
                draft_version: r.get(1)?,
                customer_id: r.get(2)?,
                customer_name: r.get(3)?,
                customer_archived: r.get(4)?,
                business_date: r.get(5)?,
                item_count: r.get::<_, i64>(6)? as usize,
                grand_total_minor: r.get(7)?,
                currency_code: r.get(8)?,
                currency_exponent: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })
        .map_err(sql)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql);
    result
}
fn insert_lines(
    conn: &Connection,
    id: &str,
    items: &[DraftItemInput],
    lines: &[LineItemCalculation],
    now: i64,
) -> Result<(), String> {
    for (index, (i, l)) in items.iter().zip(lines).enumerate() {
        conn.execute("INSERT INTO invoice_items(id,invoice_id,product_id,line_number,product_name_snap,product_sku_snap,unit_snap,cost_price_minor_snap,quantity_scaled,unit_price_minor,discount_minor,taxable_minor,tax_rate_bp,tax_minor,line_total_minor,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",params![uuid::Uuid::new_v4().to_string(),id,i.product_id,index as i64+1,i.product_name,i.product_sku.as_deref().unwrap_or(""),i.unit,i.cost_price_minor,i.quantity_scaled,i.unit_price_minor,i.discount_minor,l.taxable_minor,i.tax_rate_bp,l.tax_minor,l.line_total_minor,now]).map_err(sql)?;
    }
    Ok(())
}
fn write_totals(conn: &Connection, id: &str, t: &InvoiceTotalsCalculation) -> Result<(), String> {
    conn.execute("UPDATE invoices SET subtotal_minor=?2,discount_total_minor=?3,taxable_amount_minor=?4,tax_total_minor=?5,grand_total_minor=?6,paid_amount_minor=0,balance_due_minor=?6,settlement_status=?7 WHERE id=?1",params![id,t.subtotal_minor,t.discount_total_minor,t.taxable_amount_minor,t.tax_total_minor,t.grand_total_minor,t.settlement_status]).map_err(sql)?;
    Ok(())
}
pub fn create_invoice_draft(
    conn: &mut Connection,
    mut request: CreateDraftInvoiceRequest,
) -> Result<InvoiceDraftDetailDto, String> {
    request.idempotency_key = request.idempotency_key.trim().to_string();
    if request.idempotency_key.is_empty() || request.idempotency_key.len() > 200 {
        return Err("DRAFT_REJECTED: Invalid retry key".into());
    }
    request.customer_id = normalize_optional(request.customer_id);
    request.notes = notes(request.notes)?;
    normalize_items(&mut request.items)?;
    let (lines, totals) = calculate_draft(&request.items)?;
    let tx = conn.transaction().map_err(sql)?;
    let key = format!("draft-create:{}", request.idempotency_key);
    let prior:Option<(String,String,Option<i64>)>=tx.query_row("SELECT request_json,invoice_id,deleted_at FROM draft_create_operations WHERE idempotency_key=?",[&key],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(sql)?;
    // A date omitted at creation is pinned to the original date on every retry, even after midnight.
    let prior_date = prior
        .as_ref()
        .and_then(|(json, _, _)| serde_json::from_str::<CreateDraftInvoiceRequest>(json).ok())
        .and_then(|r| r.business_date);
    request.business_date = Some(date(&tx, request.business_date.or(prior_date))?);
    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    if let Some((original, id, deleted)) = prior {
        if original != json {
            return Err("IDEMPOTENCY_CONFLICT: Creation key has different content".into());
        }
        if deleted.is_some() {
            return Err("DRAFT_DELETED: Creation key belongs to a deleted draft".into());
        }
        return get_invoice_draft(&tx, &id);
    }
    validate_refs(&tx, &request.customer_id, &request.items, None)?;
    let exponent: i32 = tx
        .query_row(
            "SELECT currency_exponent FROM business_settings WHERE id='default'",
            [],
            |r| r.get(0),
        )
        .map_err(sql)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let hash = format!("{:x}", Sha256::digest(json.as_bytes()));
    tx.execute("INSERT INTO invoices(id,idempotency_key,request_fingerprint,customer_id,status,business_date,snapshot_currency_exponent,notes,created_at,updated_at) VALUES(?1,?2,?3,?4,'draft',?5,?6,?8,?7,?7)",params![id,key,hash,request.customer_id,request.business_date,exponent,now,request.notes]).map_err(sql)?;
    insert_lines(&tx, &id, &request.items, &lines, now)?;
    write_totals(&tx, &id, &totals)?;
    tx.execute("INSERT INTO draft_create_operations(idempotency_key,request_fingerprint,request_json,invoice_id,created_at) VALUES(?1,?2,?3,?4,?5)",params![key,hash,json,id,now]).map_err(sql)?;
    let result = get_invoice_draft(&tx, &id)?;
    tx.commit().map_err(sql)?;
    Ok(result)
}
pub fn update_invoice_draft(
    conn: &mut Connection,
    mut r: UpdateDraftInvoiceRequest,
) -> Result<InvoiceDraftDetailDto, String> {
    r.customer_id = normalize_optional(r.customer_id);
    r.notes = notes(r.notes)?;
    normalize_items(&mut r.items)?;
    let (lines, totals) = calculate_draft(&r.items)?;
    let tx = conn.transaction().map_err(sql)?;
    let old = get_invoice_draft(&tx, &r.id)?;
    if old.draft_version != r.expected_version
        || r.expected_version >= crate::domain::financial::MAX_SAFE_MONEY_MINOR
    {
        return Err("CONCURRENT_MODIFICATION_ERROR: Reload saved draft".into());
    }
    let business_date = date(&tx, r.business_date.or(Some(old.business_date.clone())))?;
    validate_refs(&tx, &r.customer_id, &r.items, Some(&old))?;
    let now = chrono::Utc::now().timestamp_millis();
    tx.execute("DELETE FROM invoice_items WHERE invoice_id=?", [&r.id])
        .map_err(sql)?;
    insert_lines(&tx, &r.id, &r.items, &lines, now)?;
    write_totals(&tx, &r.id, &totals)?;
    tx.execute("UPDATE invoices SET draft_version=draft_version+1,customer_id=?2,business_date=?3,notes=?4,updated_at=?5 WHERE id=?1",params![r.id,r.customer_id,business_date,r.notes,now]).map_err(sql)?;
    let result = get_invoice_draft(&tx, &r.id)?;
    tx.commit().map_err(sql)?;
    Ok(result)
}
pub fn delete_invoice_draft(
    conn: &mut Connection,
    id: &str,
    expected_version: i64,
) -> Result<(), String> {
    let tx = conn.transaction().map_err(sql)?;
    let deleted:Option<i64>=tx.query_row("SELECT deleted_version FROM draft_create_operations WHERE invoice_id=? AND deleted_at IS NOT NULL",[id],|r|r.get(0)).optional().map_err(sql)?;
    if let Some(v) = deleted {
        return if v == expected_version {
            Ok(())
        } else {
            Err("CONCURRENT_MODIFICATION_ERROR: Deleted at another version".into())
        };
    }
    let old = get_invoice_draft(&tx, id)?;
    if old.draft_version != expected_version {
        return Err("CONCURRENT_MODIFICATION_ERROR: Reload saved draft".into());
    }
    // Fail closed for unsupported legacy rows without creation evidence.
    let changed=tx.execute("UPDATE draft_create_operations SET deleted_at=?2,deleted_version=?3 WHERE invoice_id=?1",params![id,chrono::Utc::now().timestamp_millis(),expected_version]).map_err(sql)?;
    if changed != 1 {
        return Err("DRAFT_REJECTED: Draft creation journal missing".into());
    }
    tx.execute("DELETE FROM invoices WHERE id=? AND status='draft'", [id])
        .map_err(sql)?;
    tx.commit().map_err(sql)
}
