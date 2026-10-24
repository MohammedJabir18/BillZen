use billzen_lib::{
    db::{initialize_database, worker::DbWorkerHandle},
    domain::invoice_drafts::*,
};
use rusqlite::Connection;

fn item() -> DraftItemInput {
    DraftItemInput {
        product_id: None,
        product_name: "Tea".into(),
        product_sku: None,
        unit: "kg".into(),
        cost_price_minor: 20,
        quantity_scaled: 1500,
        unit_price_minor: 1001,
        discount_minor: 2,
        tax_rate_bp: 500,
    }
}
fn input(key: &str) -> CreateDraftInvoiceRequest {
    CreateDraftInvoiceRequest {
        idempotency_key: key.into(),
        customer_id: None,
        business_date: Some("2026-10-24".into()),
        notes: Some(" held ".into()),
        items: vec![item(), item()],
        expected_currency: Some(DraftCurrency {
            code: "INR".into(),
            exponent: 2,
        }),
    }
}
fn update(d: &InvoiceDraftDetailDto) -> UpdateDraftInvoiceRequest {
    UpdateDraftInvoiceRequest {
        id: d.id.clone(),
        expected_version: d.draft_version,
        customer_id: d.customer_id.clone(),
        business_date: Some(d.business_date.clone()),
        notes: Some("edited".into()),
        items: vec![item()],
        expected_currency: Some(DraftCurrency {
            code: d.currency_code.clone(),
            exponent: d.currency_exponent,
        }),
    }
}
fn effects(c: &Connection) -> String {
    let mut out = String::new();
    for table in [
        "products",
        "customers",
        "stock_movements",
        "money_accounts",
        "cashbook_vouchers",
        "cashbook_movements",
        "cashbook_sequences",
        "cashbook_transfers",
        "invoice_sequences",
        "payments",
        "payment_allocations",
    ] {
        let mut s = c
            .prepare(&format!("SELECT * FROM {table} ORDER BY 1"))
            .unwrap();
        let n = s.column_count();
        let rows = s
            .query_map([], |r| {
                Ok((0..n)
                    .map(|i| format!("{:?}", r.get_ref(i).unwrap()))
                    .collect::<Vec<_>>())
            })
            .unwrap();
        out.push_str(&format!(
            "{table}:{:?}",
            rows.collect::<Result<Vec<_>, _>>().unwrap()
        ));
    }
    out
}
#[tokio::test]
async fn lifecycle_retries_conflicts_and_zero_financial_effects() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(&path).unwrap();
    let before = effects(&c);
    let d = w.create_invoice_draft(input("create-one")).await.unwrap();
    assert_eq!(d.grand_total_minor, 3150);
    assert_eq!(d.subtotal_minor, 3004);
    assert_eq!(d.tax_total_minor, 150);
    assert_eq!(d.draft_version, 1);
    assert_eq!(effects(&c), before);
    assert_eq!(
        w.create_invoice_draft(input("create-one")).await.unwrap(),
        d
    );
    let mut changed = input("create-one");
    changed.items[0].quantity_scaled = 1000;
    assert!(w
        .create_invoice_draft(changed)
        .await
        .unwrap_err()
        .contains("IDEMPOTENCY_CONFLICT"));
    let u = update(&d);
    let newer = w.update_invoice_draft(u.clone()).await.unwrap();
    assert_eq!(newer.draft_version, 2);
    assert_eq!(newer.grand_total_minor, 1575);
    assert_eq!(effects(&c), before);
    assert!(w
        .update_invoice_draft(u)
        .await
        .unwrap_err()
        .contains("CONCURRENT_MODIFICATION_ERROR"));
    assert_eq!(w.get_invoice_draft(d.id.clone()).await.unwrap(), newer);
    assert_eq!(
        w.create_invoice_draft(input("create-one")).await.unwrap(),
        newer
    );
    assert!(w
        .delete_invoice_draft(d.id.clone(), 1)
        .await
        .unwrap_err()
        .contains("CONCURRENT_MODIFICATION_ERROR"));
    let second = w.create_invoice_draft(input("create-two")).await.unwrap();
    assert_eq!(w.list_invoice_drafts().await.unwrap().len(), 2);
    w.delete_invoice_draft(d.id.clone(), 2).await.unwrap();
    w.delete_invoice_draft(d.id.clone(), 2).await.unwrap();
    assert!(w.get_invoice_draft(d.id.clone()).await.is_err());
    assert!(w
        .create_invoice_draft(input("create-one"))
        .await
        .unwrap_err()
        .contains("DRAFT_DELETED"));
    assert_eq!(w.list_invoice_drafts().await.unwrap()[0].id, second.id);
    assert_eq!(effects(&c), before);
    assert_eq!(c.query_row("SELECT count(*) FROM invoices WHERE invoice_number IS NOT NULL OR sequence_number IS NOT NULL OR finalized_at IS NOT NULL",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    drop(w);
    let reopened = DbWorkerHandle::new(path).unwrap();
    assert!(reopened
        .create_invoice_draft(input("create-one"))
        .await
        .unwrap_err()
        .contains("DRAFT_DELETED"));
    assert_eq!(
        reopened.get_invoice_draft(second.id.clone()).await.unwrap(),
        second
    );
}
#[tokio::test]
async fn line_and_total_failures_roll_back_header_lines_and_retry_journal() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(path).unwrap();
    let before = effects(&c);
    c.execute_batch("CREATE TRIGGER fail_line BEFORE INSERT ON invoice_items WHEN NEW.line_number=2 BEGIN SELECT RAISE(ABORT,'injected second line'); END;").unwrap();
    assert!(w
        .create_invoice_draft(input("retry"))
        .await
        .unwrap_err()
        .contains("injected"));
    for t in ["invoices", "invoice_items", "draft_create_operations"] {
        assert_eq!(
            c.query_row(&format!("SELECT count(*) FROM {t}"), [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    c.execute_batch("DROP TRIGGER fail_line").unwrap();
    let d = w.create_invoice_draft(input("retry")).await.unwrap();
    c.execute_batch("CREATE TRIGGER fail_total BEFORE UPDATE OF grand_total_minor ON invoices BEGIN SELECT RAISE(ABORT,'injected total'); END;").unwrap();
    assert!(w.update_invoice_draft(update(&d)).await.is_err());
    assert_eq!(w.get_invoice_draft(d.id.clone()).await.unwrap(), d);
    assert_eq!(effects(&c), before);
    c.execute_batch("DROP TRIGGER fail_total; CREATE TRIGGER fail_delete BEFORE UPDATE OF deleted_at ON draft_create_operations BEGIN SELECT RAISE(ABORT,'injected delete journal'); END;").unwrap();
    assert!(w.delete_invoice_draft(d.id.clone(), 1).await.is_err());
    assert_eq!(w.get_invoice_draft(d.id.clone()).await.unwrap(), d);
}
#[tokio::test]
async fn invalid_inputs_and_non_drafts_reject_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(path).unwrap();
    for kind in 0..9 {
        let mut i = input(&format!("bad-{kind}"));
        match kind {
            0 => i.items[0].quantity_scaled = 0,
            1 => i.items[0].discount_minor = 9999,
            2 => i.items[0].tax_rate_bp = 10001,
            3 => i.items[0].cost_price_minor = -1,
            4 => i.business_date = Some("2026-02-30".into()),
            5 => i.customer_id = Some("missing".into()),
            6 => i.items[0].product_id = Some("missing".into()),
            7 => i.items[0].product_name = " ".into(),
            _ => i.idempotency_key = " ".into(),
        };
        assert!(w.create_invoice_draft(i).await.is_err(), "kind {kind}");
    }
    let d = w.create_invoice_draft(input("cancelled")).await.unwrap();
    c.execute("UPDATE invoices SET status='cancelled' WHERE id=?", [&d.id])
        .unwrap();
    assert!(w.update_invoice_draft(update(&d)).await.is_err());
    assert!(w.delete_invoice_draft(d.id, 1).await.is_err());
    assert_eq!(w.list_invoice_drafts().await.unwrap().len(), 0);
}
#[test]
fn populated_v9_upgrade_preserves_data_and_checksums() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let c = initialize_database(&path).unwrap();
    c.execute_batch("DROP TABLE draft_create_operations; DELETE FROM schema_migrations WHERE version=10; INSERT INTO invoice_sequences VALUES('legacy',42,1);").unwrap();
    let before = effects(&c);
    let old: Vec<String> = c
        .prepare("SELECT checksum FROM schema_migrations ORDER BY version")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    drop(c);
    let c = initialize_database(&path).unwrap();
    assert_eq!(effects(&c), before);
    let after: Vec<String> = c
        .prepare("SELECT checksum FROM schema_migrations WHERE version<=9 ORDER BY version")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(old, after);
    assert_eq!(
        c.query_row("SELECT count(*) FROM draft_create_operations", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert!(std::fs::read_dir(dir.path().join("recovery"))
        .unwrap()
        .any(|p| p.unwrap().path().extension().is_some_and(|e| e == "db")));
}
#[tokio::test]
async fn catalog_references_archive_warnings_and_real_balances_are_preserved() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(path).unwrap();
    c.execute_batch("INSERT INTO products(id,sku,name,unit,unit_price_minor,cost_price_minor,current_stock_scaled,created_at,updated_at) VALUES('p','TEA','Tea','kg',1001,20,7000,1,1); INSERT INTO customers(id,name,current_balance_minor,created_at,updated_at) VALUES('c','Fictional customer',98765,1,1); INSERT INTO invoice_sequences VALUES('final',17,1);").unwrap();
    let before = effects(&c);
    let mut i = input("catalog");
    i.customer_id = Some("c".into());
    i.items[0].product_id = Some("p".into());
    let d = w.create_invoice_draft(i.clone()).await.unwrap();
    assert_eq!(d.customer_name.as_deref(), Some("Fictional customer"));
    assert_eq!(d.notes.as_deref(), Some("held"));
    assert_eq!(effects(&c), before);
    c.execute_batch("UPDATE products SET is_active=0; UPDATE customers SET is_active=0;")
        .unwrap();
    let before = effects(&c);
    let saved = w.get_invoice_draft(d.id.clone()).await.unwrap();
    assert!(saved.customer_archived);
    assert!(saved.items[0].product_archived);
    let mut u = update(&d);
    u.items[0].product_id = Some("p".into());
    assert!(w.update_invoice_draft(u).await.is_ok());
    i.idempotency_key = "new-archived".into();
    assert!(w.create_invoice_draft(i).await.is_err());
    assert_eq!(effects(&c), before);
}
#[tokio::test]
async fn concurrent_create_and_updates_serialize_and_three_decimal_empty_drafts_work() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(path).unwrap();
    c.execute_batch(
        "UPDATE business_settings SET currency_code='KWD',currency_symbol='KD',currency_exponent=3",
    )
    .unwrap();
    let (a, b) = tokio::join!(
        w.create_invoice_draft({
            let mut r = input("concurrent");
            r.expected_currency = Some(DraftCurrency {
                code: "KWD".into(),
                exponent: 3,
            });
            r
        }),
        w.create_invoice_draft({
            let mut r = input("concurrent");
            r.expected_currency = Some(DraftCurrency {
                code: "KWD".into(),
                exponent: 3,
            });
            r
        })
    );
    let d = a.unwrap();
    assert_eq!(b.unwrap(), d);
    assert_eq!(d.currency_exponent, 3);
    let u = update(&d);
    let (a, b) = tokio::join!(w.update_invoice_draft(u.clone()), w.update_invoice_draft(u));
    assert_eq!([a.is_ok(), b.is_ok()].iter().filter(|x| **x).count(), 1);
    let mut empty = input("empty");
    empty.business_date = None;
    empty.expected_currency = Some(DraftCurrency {
        code: "KWD".into(),
        exponent: 3,
    });
    empty.items.clear();
    let d = w.create_invoice_draft(empty.clone()).await.unwrap();
    assert_eq!(d.grand_total_minor, 0);
    assert_eq!(d.currency_code, "KWD");
    assert_eq!(w.create_invoice_draft(empty).await.unwrap(), d);
}
#[tokio::test]
async fn portable_draft_journal_roundtrip_rejects_malformed_totals_and_tombstones() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(&path).unwrap();
    let d = w.create_invoice_draft(input("portable")).await.unwrap();
    let removed = w.create_invoice_draft(input("removed")).await.unwrap();
    w.delete_invoice_draft(removed.id, 1).await.unwrap();
    let backup = billzen_lib::db::backup::create_workspace_backup(&c).unwrap();
    assert_eq!(backup["format_version"], "1.2");
    if let Ok(path) = std::env::var("BILLZEN_DRAFT_FIXTURE") {
        std::fs::write(path, serde_json::to_vec(&backup).unwrap()).unwrap();
    }
    assert_eq!(
        backup["draft_create_operations"].as_array().unwrap().len(),
        2
    );
    let target = dir.path().join("restored.db");
    drop(initialize_database(&target).unwrap());
    billzen_lib::db::backup::restore_workspace_backup(&target, &backup).unwrap();
    let restored = DbWorkerHandle::new(target.clone()).unwrap();
    assert_eq!(restored.get_invoice_draft(d.id.clone()).await.unwrap(), d);
    assert!(restored
        .create_invoice_draft(input("removed"))
        .await
        .unwrap_err()
        .contains("DRAFT_DELETED"));
    for kind in 0..4 {
        let mut bad = backup.clone();
        match kind {
            0 => bad["invoices"][0]["grand_total_minor"] = serde_json::json!(3151),
            1 => bad["invoice_items"][0]["taxable_minor"] = serde_json::json!(1499),
            2 => {
                bad["draft_create_operations"][0]["request_fingerprint"] = serde_json::json!("bad")
            }
            _ => bad["draft_create_operations"][0]["deleted_version"] = serde_json::json!(0),
        };
        let mut map: std::collections::BTreeMap<String, serde_json::Value> =
            serde_json::from_value(bad.clone()).unwrap();
        map.remove("checksum_sha256");
        bad["checksum_sha256"] =
            serde_json::json!(billzen_lib::db::backup::compute_canonical_checksum(&map).unwrap());
        assert!(
            billzen_lib::db::backup::restore_workspace_backup(&target, &bad).is_err(),
            "kind {kind}"
        );
        assert_eq!(restored.get_invoice_draft(d.id.clone()).await.unwrap(), d);
    }
}

#[test]
#[ignore = "synthetic browser interoperability harness supplies fixture"]
fn browser_draft_fixture_import() {
    let fixture = std::fs::read(std::env::var("BILLZEN_WEB_DRAFT_FIXTURE").unwrap()).unwrap();
    let b: serde_json::Value = serde_json::from_slice(&fixture).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("restored.db");
    drop(initialize_database(&path).unwrap());
    billzen_lib::db::backup::restore_workspace_backup(&path, &b).unwrap();
    let c = initialize_database(&path).unwrap();
    let out = billzen_lib::db::backup::create_workspace_backup(&c).unwrap();
    for key in ["invoices", "invoice_items", "draft_create_operations"] {
        let mut a = b[key].as_array().unwrap().clone();
        let mut z = out[key].as_array().unwrap().clone();
        a.sort_by_key(|v| {
            v["id"]
                .as_str()
                .or(v["idempotency_key"].as_str())
                .unwrap()
                .to_string()
        });
        z.sort_by_key(|v| {
            v["id"]
                .as_str()
                .or(v["idempotency_key"].as_str())
                .unwrap()
                .to_string()
        });
        assert_eq!(a, z, "{key}");
    }
}

#[tokio::test]
async fn stale_currency_intent_rejects_without_reinterpreting_prices() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = Connection::open(path).unwrap();
    c.execute_batch(
        "UPDATE business_settings SET currency_code='KWD',currency_symbol='KD',currency_exponent=3",
    )
    .unwrap();
    assert!(w
        .create_invoice_draft(input("stale-currency"))
        .await
        .unwrap_err()
        .contains("CURRENCY_CHANGED"));
    assert_eq!(
        c.query_row("SELECT count(*) FROM invoices", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
}
