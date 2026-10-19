use crate::db::{initialize_database, run_integrity_check};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

pub const BACKUP_FORMAT_VERSION: &str = "1.0";
pub const BACKUP_SCOPE_WORKSPACE: &str = "workspace";
pub const APP_VERSION: &str = "0.1.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreBackupResult {
    pub success: bool,
    pub message: String,
    pub recovery_path: Option<String>,
    pub restored_tables: Vec<String>,
    pub record_counts: HashMap<String, usize>,
}

pub struct TableSpec {
    pub name: &'static str,
    pub order_by: &'static str,
    pub is_single_object: bool,
}

pub const WORKSPACE_TABLE_SPECS: &[TableSpec] = &[
    TableSpec { name: "business_settings", order_by: "id ASC", is_single_object: true },
    TableSpec { name: "categories", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "category_merges", order_by: "merged_at ASC, merged_category_id ASC", is_single_object: false },
    TableSpec { name: "products", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "customers", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "invoice_sequences", order_by: "sequence_key ASC", is_single_object: false },
    TableSpec { name: "invoice_items", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "invoices", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "stock_movements", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "payments", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "payment_allocations", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "expenses", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "money_accounts", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "cashbook_categories", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "cashbook_parties", order_by: "id ASC", is_single_object: false },
    TableSpec { name: "cashbook_sequences", order_by: "sequence_key ASC", is_single_object: false },
    TableSpec { name: "cashbook_vouchers", order_by: "voucher_number ASC, id ASC", is_single_object: false },
    TableSpec { name: "cashbook_movements", order_by: "sequence_number ASC, id ASC", is_single_object: false },
    TableSpec { name: "cashbook_audit_events", order_by: "id ASC", is_single_object: false },
];

/// Exports all rows of a table into a vector of Value objects whose keys are sorted.
pub fn export_table_rows(conn: &Connection, table: &str, order_by: &str) -> Result<Vec<Value>, String> {
    let query = format!("SELECT * FROM {} ORDER BY {}", table, order_by);
    let mut stmt = match conn.prepare(&query) {
        Ok(s) => s,
        Err(e) => return Err(format!("Failed to prepare query for table {}: {}", table, e)),
    };

    let col_names: Vec<String> = stmt
        .column_names()
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Failed to query table {}: {}", table, e))?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut map = BTreeMap::new();
        for (i, col) in col_names.iter().enumerate() {
            let val_ref = row.get_ref(i).map_err(|e| e.to_string())?;
            let json_val = match val_ref {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(n) => Value::Number(serde_json::Number::from(n)),
                rusqlite::types::ValueRef::Real(f) => serde_json::Number::from_f64(f)
                    .map(Value::Number)
                    .unwrap_or(Value::Null),
                rusqlite::types::ValueRef::Text(t) => {
                    let s = std::str::from_utf8(t).unwrap_or("");
                    Value::String(s.to_string())
                }
                rusqlite::types::ValueRef::Blob(b) => {
                    let hex_str = b.iter().map(|byte| format!("{:02x}", byte)).collect::<String>();
                    Value::String(hex_str)
                }
            };
            map.insert(col.clone(), json_val);
        }
        result.push(Value::Object(map.into_iter().collect()));
    }

    Ok(result)
}

/// Computes the SHA-256 checksum over the canonical UTF-8 JSON bytes of a payload map.
pub fn compute_canonical_checksum(payload_map: &BTreeMap<String, Value>) -> Result<String, String> {
    let canonical_bytes = serde_json::to_vec(payload_map)
        .map_err(|e| format!("Failed to serialize canonical payload: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&canonical_bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Exports the entire workspace into a versioned JSON backup envelope with SHA-256 integrity hash.
pub fn create_workspace_backup(conn: &Connection) -> Result<Value, String> {
    let mut payload_map = BTreeMap::new();
    let now_ts = chrono::Utc::now().timestamp_millis();

    payload_map.insert("format_version".to_string(), Value::String(BACKUP_FORMAT_VERSION.to_string()));
    payload_map.insert("scope".to_string(), Value::String(BACKUP_SCOPE_WORKSPACE.to_string()));
    payload_map.insert("app_version".to_string(), Value::String(APP_VERSION.to_string()));
    payload_map.insert("generated_at".to_string(), Value::Number(serde_json::Number::from(now_ts)));

    for spec in WORKSPACE_TABLE_SPECS {
        let rows = export_table_rows(conn, spec.name, spec.order_by)?;
        if spec.is_single_object {
            let single_val = rows.into_iter().next().unwrap_or(Value::Object(serde_json::Map::new()));
            payload_map.insert(spec.name.to_string(), single_val);
        } else {
            payload_map.insert(spec.name.to_string(), Value::Array(rows));
        }
    }

    let checksum = compute_canonical_checksum(&payload_map)?;

    // Create final envelope with checksum_sha256 as top-level property
    let mut envelope_map = BTreeMap::new();
    envelope_map.insert("checksum_sha256".to_string(), Value::String(checksum));
    for (k, v) in payload_map {
        envelope_map.insert(k, v);
    }

    Ok(Value::Object(envelope_map.into_iter().collect()))
}

/// Tier 1 Pre-Restore Validation: Checks format version, scope, and verifies SHA-256 payload checksum.
pub fn verify_tier1_checksum(backup_json: &Value) -> Result<BTreeMap<String, Value>, String> {
    let root_obj = backup_json
        .as_object()
        .ok_or_else(|| "Backup root must be a JSON object".to_string())?;

    let format_version = root_obj
        .get("format_version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'format_version' in backup payload".to_string())?;

    if format_version != BACKUP_FORMAT_VERSION {
        return Err(format!(
            "Unsupported backup format version '{}': expected '{}'",
            format_version, BACKUP_FORMAT_VERSION
        ));
    }

    let scope = root_obj
        .get("scope")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'scope' in backup payload".to_string())?;

    if scope != BACKUP_SCOPE_WORKSPACE {
        return Err(format!(
            "Invalid backup scope '{}': expected '{}'",
            scope, BACKUP_SCOPE_WORKSPACE
        ));
    }

    let expected_checksum = root_obj
        .get("checksum_sha256")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'checksum_sha256' in backup envelope".to_string())?;

    // Build map of all fields except checksum_sha256
    let mut canonical_map = BTreeMap::new();
    for (k, v) in root_obj {
        if k != "checksum_sha256" {
            canonical_map.insert(k.clone(), v.clone());
        }
    }

    let computed_checksum = compute_canonical_checksum(&canonical_map)?;
    if computed_checksum != expected_checksum {
        return Err(format!(
            "Integrity check failed: checksum mismatch (expected {}, computed {})",
            expected_checksum, computed_checksum
        ));
    }

    Ok(canonical_map)
}

/// Inserts rows into a table using generic rusqlite binding.
pub fn insert_table_rows(conn: &Connection, table_name: &str, rows: &[Value]) -> Result<usize, String> {
    if rows.is_empty() {
        return Ok(0);
    }
    let mut count = 0;
    for row_val in rows {
        let obj = row_val
            .as_object()
            .ok_or_else(|| format!("Row in {} must be a JSON object", table_name))?;
        if obj.is_empty() {
            continue;
        }

        let cols: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
        let placeholders: Vec<String> = (1..=cols.len()).map(|i| format!("?{}", i)).collect();
        let sql = format!(
            "INSERT INTO {} ({}) VALUES ({});",
            table_name,
            cols.join(", "),
            placeholders.join(", ")
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Failed to prepare insert for table {}: {}", table_name, e))?;

        let rusqlite_values: Vec<rusqlite::types::Value> = cols
            .iter()
            .map(|col| match obj.get(*col) {
                Some(Value::Null) | None => rusqlite::types::Value::Null,
                Some(Value::Bool(b)) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
                Some(Value::Number(n)) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else if let Some(f) = n.as_f64() {
                        rusqlite::types::Value::Real(f)
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                Some(Value::String(s)) => rusqlite::types::Value::Text(s.clone()),
                Some(other) => rusqlite::types::Value::Text(other.to_string()),
            })
            .collect();

        stmt.execute(rusqlite::params_from_iter(rusqlite_values))
            .map_err(|e| format!("Failed to execute insert for table {}: {}", table_name, e))?;
        count += 1;
    }
    Ok(count)
}

/// Tier 2 Pre-Restore Validation: Verifies zero foreign key violations in the staged database.
pub fn verify_tier2_foreign_keys(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    let mut stmt = conn
        .prepare("PRAGMA foreign_key_check;")
        .map_err(|e| format!("Failed to prepare foreign key check: {}", e))?;

    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Failed to query foreign key check: {}", e))?;

    let mut violations = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let table: String = row.get(0).unwrap_or_default();
        let rowid: i64 = row.get(1).unwrap_or_default();
        let parent: String = row.get(2).unwrap_or_default();
        let fkid: i64 = row.get(3).unwrap_or_default();
        violations.push(format!(
            "table '{}' rowid {} -> parent '{}' (fk idx {})",
            table, rowid, parent, fkid
        ));
    }

    if !violations.is_empty() {
        return Err(format!(
            "Tier 2 Foreign Key check failed with violations: {:?}",
            violations
        ));
    }
    Ok(())
}

/// Tier 3 Pre-Restore Validation: Verifies database structure via PRAGMA integrity_check.
pub fn verify_tier3_integrity(conn: &Connection) -> Result<(), String> {
    run_integrity_check(conn).map_err(|e| format!("Tier 3 Structural integrity check failed: {}", e))
}

/// Tier 4 Pre-Restore Validation: Verifies cashbook balances and movement agreements.
pub fn verify_tier4_financial_invariants(conn: &Connection) -> Result<(), String> {
    // 1. Check each money account balance invariant
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.account_name, a.opening_balance_minor, a.allow_negative_balance,
                    COALESCE(SUM(m.amount_minor), 0) AS movements_sum
             FROM money_accounts a
             LEFT JOIN cashbook_movements m ON m.account_id = a.id
             GROUP BY a.id;",
        )
        .map_err(|e| format!("Failed to prepare financial check: {}", e))?;

    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Failed to query financial check: {}", e))?;

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let account_name: String = row.get(1).unwrap_or_default();
        let opening: i64 = row.get(2).unwrap_or(0);
        let allow_negative: i64 = row.get(3).unwrap_or(0);
        let movements_sum: i64 = row.get(4).unwrap_or(0);
        let current_balance = opening + movements_sum;

        if allow_negative == 0 && current_balance < 0 {
            let has_audit: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM cashbook_audit_events WHERE event_type = 'negative_balance_confirmed');",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(false);

            if !has_audit {
                return Err(format!(
                    "Tier 4 Financial check failed: Account '{}' has unconfirmed negative balance ({} minor)",
                    account_name, current_balance
                ));
            }
        }
    }

    // 2. Check for orphaned movements
    let orphaned_movements: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cashbook_movements m
             WHERE NOT EXISTS (SELECT 1 FROM cashbook_vouchers v WHERE v.id = m.voucher_id);",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if orphaned_movements > 0 {
        return Err(format!(
            "Tier 4 Financial check failed: {} orphaned movements found without parent voucher",
            orphaned_movements
        ));
    }

    // 3. Check agreement between posted voucher and its movement
    let mismatched_movements: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cashbook_movements m
             JOIN cashbook_vouchers v ON v.id = m.voucher_id
             WHERE v.account_id != m.account_id
                OR v.business_date != m.business_date
                OR ABS(m.amount_minor) != v.amount_minor;",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if mismatched_movements > 0 {
        return Err(format!(
            "Tier 4 Financial check failed: {} mismatched movements found whose details differ from parent voucher",
            mismatched_movements
        ));
    }

    Ok(())
}

/// Restores a workspace backup into a staging database, validates Tiers 1-4,
/// creates a recovery copy of the current active database, and swaps the staging file in place.
pub fn restore_workspace_backup(
    db_path: &Path,
    backup_json: &Value,
) -> Result<RestoreBackupResult, String> {
    // Tier 1 Validation
    let canonical_map = verify_tier1_checksum(backup_json)?;

    let db_dir = db_path
        .parent()
        .ok_or_else(|| "Invalid database path: missing parent directory".to_string())?;

    let staging_path = db_dir.join("billzen.staging.db");

    // Clean up any existing stale staging database
    if staging_path.exists() {
        let _ = std::fs::remove_file(&staging_path);
    }
    let _ = std::fs::remove_file(db_dir.join("billzen.staging.db-wal"));
    let _ = std::fs::remove_file(db_dir.join("billzen.staging.db-shm"));

    // Initialize staging database schema with all migrations
    let staging_conn = initialize_database(&staging_path)
        .map_err(|e| format!("Failed to initialize staging database: {}", e))?;

    // Clear any seeded default rows
    staging_conn
        .execute_batch(
            "DELETE FROM business_settings;
             DELETE FROM cashbook_categories;",
        )
        .map_err(|e| format!("Failed to clear default seeded rows: {}", e))?;

    // Disable foreign keys temporarily during data population
    staging_conn
        .execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| format!("Failed to disable foreign keys: {}", e))?;

    let mut record_counts = HashMap::new();
    let mut restored_tables = Vec::new();

    // Populate all tables from the backup
    for spec in WORKSPACE_TABLE_SPECS {
        if let Some(val) = canonical_map.get(spec.name) {
            let count = if spec.is_single_object {
                if val.is_object() && !val.as_object().unwrap().is_empty() {
                    insert_table_rows(&staging_conn, spec.name, &[val.clone()])?
                } else {
                    0
                }
            } else if let Some(arr) = val.as_array() {
                insert_table_rows(&staging_conn, spec.name, arr)?
            } else {
                0
            };
            record_counts.insert(spec.name.to_string(), count);
            restored_tables.push(spec.name.to_string());
        }
    }

    // Tier 2: Referential Integrity
    verify_tier2_foreign_keys(&staging_conn)?;

    // Tier 3: Structural Integrity
    verify_tier3_integrity(&staging_conn)?;

    // Tier 4: Financial Balances
    verify_tier4_financial_invariants(&staging_conn)?;

    // Drop staging connection so files are closed and flushed
    drop(staging_conn);

    // Create timestamped recovery backup of the current database
    let now_ts = chrono::Utc::now().timestamp_millis();
    let recovery_filename = format!("billzen.db.recovery-{}", now_ts);
    let recovery_path = db_dir.join(&recovery_filename);

    if db_path.exists() {
        std::fs::copy(db_path, &recovery_path)
            .map_err(|e| format!("Failed to create recovery backup: {}", e))?;
    }

    // Atomic Swap: rename staging to db_path
    std::fs::rename(&staging_path, db_path)
        .map_err(|e| format!("Failed to atomically swap staging database: {}", e))?;

    // Clean up staging companions if any
    let _ = std::fs::remove_file(db_dir.join("billzen.staging.db-wal"));
    let _ = std::fs::remove_file(db_dir.join("billzen.staging.db-shm"));
    // Clean up active companion files so new db starts clean
    let _ = std::fs::remove_file(db_dir.join("billzen.db-wal"));
    let _ = std::fs::remove_file(db_dir.join("billzen.db-shm"));

    Ok(RestoreBackupResult {
        success: true,
        message: "Workspace successfully restored from backup archive.".to_string(),
        recovery_path: Some(recovery_path.to_string_lossy().to_string()),
        restored_tables,
        record_counts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_backup_export_and_tier1_checksum_verification() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_backup.db");
        let conn = initialize_database(&db_path).unwrap();

        let backup = create_workspace_backup(&conn).unwrap();
        assert_eq!(backup["format_version"], "1.0");
        assert_eq!(backup["scope"], "workspace");
        assert_eq!(backup["app_version"], "0.1.0");
        assert!(backup["checksum_sha256"].is_string());
        assert!(backup["business_settings"].is_object());

        // Verify valid tier 1 passes
        let verified_map = verify_tier1_checksum(&backup).unwrap();
        assert_eq!(verified_map["format_version"], "1.0");

        // Verify corrupted checksum is rejected
        let mut corrupted_backup = backup.clone();
        corrupted_backup["checksum_sha256"] = Value::String("0000000000000000000000000000000000000000000000000000000000000000".to_string());
        let err = verify_tier1_checksum(&corrupted_backup).unwrap_err();
        assert!(err.contains("checksum mismatch"));

        // Verify altered content is rejected
        let mut altered_backup = backup.clone();
        altered_backup["app_version"] = Value::String("9.9.9".to_string());
        let err2 = verify_tier1_checksum(&altered_backup).unwrap_err();
        assert!(err2.contains("checksum mismatch"));
    }

    #[test]
    fn test_backup_restore_roundtrip_with_staging_and_recovery() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("active.db");

        // 1. Initialize DB and add test account & voucher
        {
            let conn = initialize_database(&db_path).unwrap();
            conn.execute(
                "INSERT INTO money_accounts (id, account_name, account_type, opening_balance_minor, allow_negative_balance, currency_code, currency_exponent, created_at, updated_at)
                 VALUES ('acc-1', 'Main Cash', 'cash', 500000, 0, 'INR', 2, 1729000000000, 1729000000000);",
                [],
            ).unwrap();

            conn.execute(
                "INSERT INTO cashbook_vouchers (id, voucher_number, idempotency_key, payload_hash, account_id, direction, classification, payment_method, amount_minor, business_date, status, created_at, posted_at)
                 VALUES ('v-1', 'RCP-202610-00001', 'key-1', 'hash-1', 'acc-1', 'inflow', 'operating_income', 'cash', 100000, '2026-10-19', 'posted', 1729000000000, 1729000000000);",
                [],
            ).unwrap();

            conn.execute(
                "INSERT INTO cashbook_movements (id, voucher_id, account_id, business_date, sequence_number, amount_minor, created_at)
                 VALUES ('m-1', 'v-1', 'acc-1', '2026-10-19', 1, 100000, 1729000000000);",
                [],
            ).unwrap();
        }

        // 2. Export backup
        let backup_val = {
            let conn = initialize_database(&db_path).unwrap();
            create_workspace_backup(&conn).unwrap()
        };

        // 3. Mutate active DB (simulate divergent state by adding another account)
        {
            let conn = initialize_database(&db_path).unwrap();
            conn.execute(
                "INSERT INTO money_accounts (id, account_name, account_type, opening_balance_minor, allow_negative_balance, currency_code, currency_exponent, created_at, updated_at)
                 VALUES ('acc-divergent', 'Temp Divergent Account', 'cash', 100000, 0, 'INR', 2, 1729000000000, 1729000000000);",
                [],
            ).unwrap();
            let acc_count_before_restore: i64 = conn.query_row("SELECT COUNT(*) FROM money_accounts;", [], |r| r.get(0)).unwrap();
            assert_eq!(acc_count_before_restore, 2);
        }

        // 4. Restore workspace backup
        let restore_res = restore_workspace_backup(&db_path, &backup_val).unwrap();
        assert!(restore_res.success);
        assert!(restore_res.recovery_path.is_some());

        let recovery_path = PathBuf::from(restore_res.recovery_path.unwrap());
        assert!(recovery_path.exists(), "Recovery copy must exist on disk");

        // 5. Verify restored DB has exact original records
        let restored_conn = initialize_database(&db_path).unwrap();
        let acc_count: i64 = restored_conn.query_row("SELECT COUNT(*) FROM money_accounts;", [], |r| r.get(0)).unwrap();
        let voucher_count: i64 = restored_conn.query_row("SELECT COUNT(*) FROM cashbook_vouchers;", [], |r| r.get(0)).unwrap();
        let movement_count: i64 = restored_conn.query_row("SELECT COUNT(*) FROM cashbook_movements;", [], |r| r.get(0)).unwrap();

        assert_eq!(acc_count, 1);
        assert_eq!(voucher_count, 1);
        assert_eq!(movement_count, 1);
    }

    #[test]
    fn test_backup_restore_rejects_foreign_key_violation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("active_fk.db");
        let conn = initialize_database(&db_path).unwrap();

        let mut backup_val = create_workspace_backup(&conn).unwrap();

        // Inject product with non-existent category_id into backup
        let mut product = serde_json::Map::new();
        product.insert("id".to_string(), Value::String("prod-broken-fk".to_string()));
        product.insert("name".to_string(), Value::String("Broken Item".to_string()));
        product.insert("sku".to_string(), Value::String("BROKEN-01".to_string()));
        product.insert("unit".to_string(), Value::String("pcs".to_string()));
        product.insert("unit_price_minor".to_string(), Value::Number(serde_json::Number::from(1000)));
        product.insert("cost_price_minor".to_string(), Value::Number(serde_json::Number::from(500)));
        product.insert("tax_rate_bp".to_string(), Value::Number(serde_json::Number::from(0)));
        product.insert("is_stock_tracked".to_string(), Value::Number(serde_json::Number::from(0)));
        product.insert("current_stock_scaled".to_string(), Value::Number(serde_json::Number::from(0)));
        product.insert("min_stock_threshold_scaled".to_string(), Value::Number(serde_json::Number::from(0)));
        product.insert("category_id".to_string(), Value::String("non-existent-cat-id".to_string()));
        product.insert("is_active".to_string(), Value::Number(serde_json::Number::from(1)));
        product.insert("created_at".to_string(), Value::Number(serde_json::Number::from(1729000000000i64)));
        product.insert("updated_at".to_string(), Value::Number(serde_json::Number::from(1729000000000i64)));

        let mut products_arr = backup_val["products"].as_array().cloned().unwrap_or_default();
        products_arr.push(Value::Object(product));
        backup_val["products"] = Value::Array(products_arr);

        // Recompute valid Tier 1 checksum for the injected payload to specifically test Tier 2 rejection
        let mut canonical_map = BTreeMap::new();
        for (k, v) in backup_val.as_object().unwrap() {
            if k != "checksum_sha256" {
                canonical_map.insert(k.clone(), v.clone());
            }
        }
        let recomputed_checksum = compute_canonical_checksum(&canonical_map).unwrap();
        backup_val["checksum_sha256"] = Value::String(recomputed_checksum);

        let res = restore_workspace_backup(&db_path, &backup_val);
        assert!(res.is_err(), "Restore must fail Tier 2 when foreign key violation exists");
        let err_msg = res.unwrap_err();
        eprintln!("ACTUAL ERROR MESSAGE: {}", err_msg);
        assert!(err_msg.contains("Tier 2 Foreign Key check failed"));
    }

    #[test]
    fn test_backup_restore_rejects_financial_invariant_violation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("active_fin.db");
        let conn = initialize_database(&db_path).unwrap();

        let mut backup_val = create_workspace_backup(&conn).unwrap();

        // Inject orphaned movement into backup (movement without parent voucher)
        let mut movement = serde_json::Map::new();
        movement.insert("id".to_string(), Value::String("orphan-m1".to_string()));
        movement.insert("voucher_id".to_string(), Value::String("non-existent-voucher".to_string()));
        movement.insert("account_id".to_string(), Value::String("acc-1".to_string()));
        movement.insert("business_date".to_string(), Value::String("2026-10-19".to_string()));
        movement.insert("sequence_number".to_string(), Value::Number(serde_json::Number::from(1)));
        movement.insert("amount_minor".to_string(), Value::Number(serde_json::Number::from(50000)));
        movement.insert("created_at".to_string(), Value::Number(serde_json::Number::from(1729000000000i64)));

        let mut movements_arr = backup_val["cashbook_movements"].as_array().cloned().unwrap_or_default();
        movements_arr.push(Value::Object(movement));
        backup_val["cashbook_movements"] = Value::Array(movements_arr);

        // Recompute valid Tier 1 checksum for the injected payload
        let mut canonical_map = BTreeMap::new();
        for (k, v) in backup_val.as_object().unwrap() {
            if k != "checksum_sha256" {
                canonical_map.insert(k.clone(), v.clone());
            }
        }
        let recomputed_checksum = compute_canonical_checksum(&canonical_map).unwrap();
        backup_val["checksum_sha256"] = Value::String(recomputed_checksum);

        let res = restore_workspace_backup(&db_path, &backup_val);
        assert!(res.is_err(), "Restore must fail when financial invariant is violated");
    }
}
