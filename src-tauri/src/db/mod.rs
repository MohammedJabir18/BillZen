pub mod worker;
pub mod backup;
pub mod recovery;

use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Database migration checksum mismatch for version {version}: expected {expected}, found {found}")]
    ChecksumMismatch {
        version: i64,
        expected: String,
        found: String,
    },
    #[error("Database integrity check failed: {0}")]
    IntegrityCheckFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub const V1_MIGRATION_SQL: &str = include_str!("migrations/v1_init.sql");
pub const V2_MIGRATION_SQL: &str = include_str!("migrations/v2_regional_foundation.sql");
pub const V3_MIGRATION_SQL: &str = include_str!("migrations/v3_protect_currency_exponent.sql");
pub const V4_MIGRATION_SQL: &str = include_str!("migrations/v4_catalog.sql");
pub const V5_MIGRATION_SQL: &str = include_str!("migrations/v5_category_nocase.sql");
pub const V6_MIGRATION_SQL: &str = include_str!("migrations/v6_setup_and_onboarding.sql");
pub const V7_MIGRATION_SQL: &str = include_str!("migrations/v7_cashbook_foundation.sql");
pub const V8_MIGRATION_SQL: &str = include_str!("migrations/v8_cashbook_integrity_hardening.sql");
pub const INITIAL_V5_CHECKSUM: &str = "04d82447f839b02a0cc09c20534fa5f6d5688a1a79fb96e17b6a4bbe4d544a46";
pub const INTERMEDIATE_V5_CHECKSUM: &str = "0d748aafb38054e1e01f260dd3bbc486e6e378a7bd97db6545d4ab4f9e166d36";
pub const INITIAL_V6_CHECKSUM: &str = "c454f1673814b4ad7cd05f766f71f1bea165b3924fbb1d62c1fdf1292f34b944";


pub fn configure_connection(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = FULL;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(())
}

pub fn run_integrity_check(conn: &Connection) -> Result<(), DbError> {
    let mut stmt = conn.prepare("PRAGMA integrity_check;")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let result: String = row.get(0)?;
        if result != "ok" {
            return Err(DbError::IntegrityCheckFailed(result));
        }
    }
    Ok(())
}

pub fn run_migrations(conn: &mut Connection) -> Result<(), DbError> {
    configure_connection(conn)?;
    run_integrity_check(conn)?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            checksum TEXT NOT NULL
        );",
    )?;

    // Migration 1: Initial Schema
    let mut hasher = Sha256::new();
    hasher.update(V1_MIGRATION_SQL.as_bytes());
    let current_checksum = format!("{:x}", hasher.finalize());

    let existing_checksum: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 1;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum {
                return Err(DbError::ChecksumMismatch {
                    version: 1,
                    expected: stored_checksum,
                    found: current_checksum,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V1_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![1, "v1_init", now, current_checksum],
            )?;
            tx.commit()?;
        }
    }

    // Migration 2: Regional Foundation (India & GCC)
    let mut hasher2 = Sha256::new();
    hasher2.update(V2_MIGRATION_SQL.as_bytes());
    let current_checksum2 = format!("{:x}", hasher2.finalize());

    let existing_checksum2: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 2;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum2 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum2 {
                return Err(DbError::ChecksumMismatch {
                    version: 2,
                    expected: stored_checksum,
                    found: current_checksum2,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V2_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![2, "v2_regional_foundation", now, current_checksum2],
            )?;
            tx.commit()?;
        }
    }

    // Migration 3: Protect Currency Exponent on Finalized Invoices
    let mut hasher3 = Sha256::new();
    hasher3.update(V3_MIGRATION_SQL.as_bytes());
    let current_checksum3 = format!("{:x}", hasher3.finalize());

    let existing_checksum3: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 3;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum3 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum3 {
                return Err(DbError::ChecksumMismatch {
                    version: 3,
                    expected: stored_checksum,
                    found: current_checksum3,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V3_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![3, "v3_protect_currency_exponent", now, current_checksum3],
            )?;
            tx.commit()?;
        }
    }

    // Migration 4: Catalog Enhancements (Categories, Min Stock, Customer Details)
    let mut hasher4 = Sha256::new();
    hasher4.update(V4_MIGRATION_SQL.as_bytes());
    let current_checksum4 = format!("{:x}", hasher4.finalize());

    let existing_checksum4: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 4;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum4 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum4 {
                return Err(DbError::ChecksumMismatch {
                    version: 4,
                    expected: stored_checksum,
                    found: current_checksum4,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V4_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![4, "v4_catalog", now, current_checksum4],
            )?;
            tx.commit()?;
        }
    }

    // Migration 5: Category Name Case-Insensitive Uniqueness
    let mut hasher5 = Sha256::new();
    hasher5.update(V5_MIGRATION_SQL.as_bytes());
    let current_checksum5 = format!("{:x}", hasher5.finalize());

    let existing_checksum5: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 5;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum5 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum5 && stored_checksum != INITIAL_V5_CHECKSUM && stored_checksum != INTERMEDIATE_V5_CHECKSUM {
                return Err(DbError::ChecksumMismatch {
                    version: 5,
                    expected: stored_checksum,
                    found: current_checksum5,
                });
            }
            // Ensure category_merges audit table is present even on databases upgraded with initial V5
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS category_merges (
                    merged_category_id TEXT PRIMARY KEY NOT NULL,
                    canonical_category_id TEXT NOT NULL,
                    merged_name TEXT NOT NULL,
                    merged_description TEXT,
                    merged_at INTEGER NOT NULL
                );",
            )?;
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V5_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![5, "v5_category_nocase", now, current_checksum5],
            )?;
            tx.commit()?;
        }
    }

    // Migration 6: Business Setup State, Appearance Preference, and Getting-Started Guide
    let mut hasher6 = Sha256::new();
    hasher6.update(V6_MIGRATION_SQL.as_bytes());
    let current_checksum6 = format!("{:x}", hasher6.finalize());

    let existing_checksum6: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 6;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum6 {
        Some(stored_checksum) => {
            if stored_checksum == current_checksum6 {
                // Database is already on current V6 migration; preserve all existing settings and guide states.
            } else if stored_checksum == INITIAL_V6_CHECKSUM {
                // One-time upgrade from early initial V6:
                // Repair legacy customized business settings if setup was not marked completed,
                // and advance stored checksum to current_checksum6.
                let tx = conn.transaction()?;
                tx.execute(
                    "UPDATE business_settings
                    SET is_setup_completed = 1,
                        guide_status = 'completed'
                    WHERE is_setup_completed = 0 AND (
                        business_name != 'My Retail Store'
                        OR legal_name IS NOT NULL
                        OR tax_identifier IS NOT NULL
                        OR phone != '+91 9876543210'
                        OR email IS NOT NULL
                        OR address_line1 != '123 Market Road'
                        OR address_line2 IS NOT NULL
                        OR city != 'Kochi'
                        OR state != 'Kerala'
                        OR postal_code != '682001'
                        OR (country != 'IND' AND country != 'India')
                        OR currency_code != 'INR'
                        OR timezone != 'Asia/Kolkata'
                        OR invoice_prefix != 'INV'
                        OR locale != 'en-IN'
                        OR (terms_and_conditions IS NOT NULL AND terms_and_conditions != 'Thank you for your business!')
                        OR EXISTS (SELECT 1 FROM products LIMIT 1)
                        OR EXISTS (SELECT 1 FROM customers LIMIT 1)
                        OR EXISTS (SELECT 1 FROM invoices LIMIT 1)
                        OR EXISTS (SELECT 1 FROM categories LIMIT 1)
                        OR EXISTS (SELECT 1 FROM payments LIMIT 1)
                        OR EXISTS (SELECT 1 FROM expenses LIMIT 1)
                    );",
                    [],
                )?;
                tx.execute(
                    "UPDATE schema_migrations SET checksum = ?1 WHERE version = 6;",
                    params![current_checksum6],
                )?;
                tx.commit()?;
            } else {
                return Err(DbError::ChecksumMismatch {
                    version: 6,
                    expected: stored_checksum,
                    found: current_checksum6,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V6_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![6, "v6_setup_and_onboarding", now, current_checksum6],
            )?;
            tx.commit()?;
        }
    }

    // Migration 7: Offline Company Cashbook Foundation
    let mut hasher7 = Sha256::new();
    hasher7.update(V7_MIGRATION_SQL.as_bytes());
    let current_checksum7 = format!("{:x}", hasher7.finalize());

    let existing_checksum7: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 7;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum7 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum7 {
                return Err(DbError::ChecksumMismatch {
                    version: 7,
                    expected: stored_checksum,
                    found: current_checksum7,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V7_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![7, "v7_cashbook_foundation", now, current_checksum7],
            )?;
            tx.commit()?;
        }
    }

    // Migration 8: Cashbook Integrity Hardening & Authoritative Protection
    let mut hasher8 = Sha256::new();
    hasher8.update(V8_MIGRATION_SQL.as_bytes());
    let current_checksum8 = format!("{:x}", hasher8.finalize());

    let existing_checksum8: Option<String> = conn
        .query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 8;",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing_checksum8 {
        Some(stored_checksum) => {
            if stored_checksum != current_checksum8 {
                return Err(DbError::ChecksumMismatch {
                    version: 8,
                    expected: stored_checksum,
                    found: current_checksum8,
                });
            }
        }
        None => {
            let tx = conn.transaction()?;
            tx.execute_batch(V8_MIGRATION_SQL)?;
            let now = chrono::Utc::now().timestamp_millis();
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4);",
                params![8, "v8_cashbook_integrity_hardening", now, current_checksum8],
            )?;
            tx.commit()?;
        }
    }

    Ok(())
}

pub fn initialize_database(db_path: &Path) -> Result<Connection, DbError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    recovery::before_migrations(db_path)?;
    let mut conn = Connection::open(db_path)?;
    run_migrations(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migrations_and_triggers_against_fresh_db() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        // Verify schema_migrations has version 1 and version 2
        let count1: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations WHERE version = 1", [], |r| r.get(0))
            .expect("Query failed");
        assert_eq!(count1, 1);

        let count2: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations WHERE version = 2", [], |r| r.get(0))
            .expect("Query failed");
        assert_eq!(count2, 1);

        // Verify singleton business_settings
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO business_settings (id, business_name, phone, address_line1, city, state, postal_code, currency_exponent, locale, created_at, updated_at)
             VALUES ('default', 'Test Store', '9999999999', 'Road 1', 'City', 'State', '123456', 2, 'en-IN', ?1, ?1)",
            params![now],
        ).expect("Insert settings failed");

        // Inserting second row with id != 'default' must fail CHECK constraint
        let second_insert = conn.execute(
            "INSERT INTO business_settings (id, business_name, phone, address_line1, city, state, postal_code, currency_exponent, locale, created_at, updated_at)
             VALUES ('other', 'Second Store', '9999999999', 'Road 2', 'City', 'State', '123456', 2, 'en-IN', ?1, ?1)",
            params![now],
        );
        assert!(second_insert.is_err());
    }

    #[test]
    fn test_currency_change_prevented_when_finalized_invoices_exist() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO business_settings (id, business_name, phone, address_line1, city, state, postal_code, currency_code, currency_exponent, created_at, updated_at)
             VALUES ('default', 'Test Store', '9999999999', 'Road 1', 'City', 'State', '123456', 'INR', 2, ?1, ?1)",
            params![now],
        ).expect("Insert settings failed");

        // 1. When NO finalized invoice exists, changing currency succeeds
        let change1 = conn.execute(
            "UPDATE business_settings SET currency_code = 'KWD', currency_exponent = 3 WHERE id = 'default';",
            [],
        );
        assert!(change1.is_ok(), "Currency change should succeed before any finalized invoice exists");

        // 2. Insert customer and finalized invoice
        conn.execute(
            "INSERT INTO customers (id, name, created_at, updated_at) VALUES ('c1', 'Alice', ?1, ?1)",
            params![now],
        ).expect("Insert customer failed");

        conn.execute(
            "INSERT INTO invoices (
                id, invoice_number, status, settlement_status, business_date,
                customer_id, customer_name_snap, business_name_snap,
                subtotal_minor, grand_total_minor, paid_amount_minor, balance_due_minor,
                snapshot_currency_exponent, created_at, updated_at, finalized_at
            ) VALUES (
                'inv1', 'INV-2026-0001', 'finalized', 'unpaid', '2026-10-18',
                'c1', 'Alice', 'Test Store',
                10000, 10000, 0, 10000,
                3, ?1, ?1, ?1
            )",
            params![now],
        ).expect("Insert finalized invoice failed");

        // 3. Attempt to change currency code or exponent now MUST be rejected by trigger
        let change_attempt = conn.execute(
            "UPDATE business_settings SET currency_code = 'OMR' WHERE id = 'default';",
            [],
        );
        assert!(
            change_attempt.is_err(),
            "Currency change must be rejected when finalized invoice exists"
        );
        let err_str = change_attempt.unwrap_err().to_string();
        assert!(err_str.contains("Cannot change business base currency after finalized financial invoices exist"));
    }

    #[test]
    fn test_prohibited_mutations_fail_on_finalized_invoice() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        let now = chrono::Utc::now().timestamp_millis();

        // 1. Setup Customer and Invoice as DRAFT initially
        conn.execute(
            "INSERT INTO customers (id, name, created_at, updated_at) VALUES ('c1', 'Alice', ?1, ?1)",
            params![now],
        ).expect("Insert customer failed");

        conn.execute(
            "INSERT INTO invoices (
                id, invoice_number, status, settlement_status, business_date,
                customer_id, customer_name_snap, business_name_snap,
                subtotal_minor, grand_total_minor, paid_amount_minor, balance_due_minor,
                created_at, updated_at, finalized_at
            ) VALUES (
                'inv1', 'INV-2026-0001', 'draft', 'unpaid', '2026-10-18',
                'c1', 'Alice', 'Test Store',
                10000, 10000, 0, 10000,
                ?1, ?1, ?1
            )",
            params![now],
        ).expect("Insert draft invoice failed");

        // 2. Line Item for draft invoice (succeeds)
        conn.execute(
            "INSERT INTO invoice_items (
                id, invoice_id, line_number, product_name_snap, product_sku_snap, unit_snap,
                quantity_scaled, unit_price_minor, discount_minor, taxable_minor,
                tax_rate_bp, tax_minor, line_total_minor, created_at
            ) VALUES (
                'item1', 'inv1', 1, 'Product A', 'SKU-A', 'unit',
                1000, 10000, 0, 10000,
                0, 0, 10000, ?1
            )",
            params![now],
        ).expect("Insert line item failed");

        // 3. Finalize the invoice
        conn.execute(
            "UPDATE invoices SET status = 'finalized' WHERE id = 'inv1'",
            [],
        ).expect("Finalizing invoice failed");

        // TEST 1: Modifying commercial grand_total_minor on finalized invoice MUST fail trigger
        let update_commercial = conn.execute(
            "UPDATE invoices SET grand_total_minor = 12000 WHERE id = 'inv1'",
            [],
        );
        assert!(update_commercial.is_err(), "Commercial total update on finalized invoice must fail");

        // TEST 2: Modifying customer_name_snap on finalized invoice MUST fail trigger
        let update_snap = conn.execute(
            "UPDATE invoices SET customer_name_snap = 'Bob' WHERE id = 'inv1'",
            [],
        );
        assert!(update_snap.is_err(), "Customer snapshot update on finalized invoice must fail");

        // TEST 3: Deleting finalized invoice MUST fail trigger
        let delete_inv = conn.execute("DELETE FROM invoices WHERE id = 'inv1'", []);
        assert!(delete_inv.is_err(), "Deleting finalized invoice must fail");

        // TEST 4: Adding new line item to finalized invoice MUST fail trigger
        let insert_item = conn.execute(
            "INSERT INTO invoice_items (
                id, invoice_id, line_number, product_name_snap, product_sku_snap, unit_snap,
                quantity_scaled, unit_price_minor, discount_minor, taxable_minor,
                tax_rate_bp, tax_minor, line_total_minor, created_at
            ) VALUES (
                'item2', 'inv1', 2, 'Product B', 'SKU-B', 'unit',
                1000, 2000, 0, 2000, 0, 0, 2000, ?1
            )",
            params![now],
        );
        assert!(insert_item.is_err(), "Inserting line items into finalized invoice must fail");

        // TEST 5: Deleting line item from finalized invoice MUST fail trigger
        let delete_item = conn.execute("DELETE FROM invoice_items WHERE id = 'item1'", []);
        assert!(delete_item.is_err(), "Deleting line items from finalized invoice must fail");

        // TEST 6: Modifying snapshot_currency_exponent on finalized invoice MUST fail trigger
        let update_exp = conn.execute(
            "UPDATE invoices SET snapshot_currency_exponent = 3 WHERE id = 'inv1'",
            [],
        );
        assert!(update_exp.is_err(), "Snapshot currency exponent update on finalized invoice must fail");

        // TEST 6: LEGITIMATE settlement update MUST succeed!
        // Invoice paid in full: paid_amount_minor = 10000, balance_due_minor = 0, settlement_status = 'fully_paid'
        let legitimate_settlement_update = conn.execute(
            "UPDATE invoices SET 
                paid_amount_minor = 10000,
                balance_due_minor = 0,
                settlement_status = 'fully_paid',
                updated_at = ?1
             WHERE id = 'inv1'",
            params![now + 1000],
        );
        assert!(
            legitimate_settlement_update.is_ok(),
            "Legitimate settlement update must succeed"
        );
    }

    #[test]
    fn test_rollback_mid_transaction_after_real_writes_preserves_opening_movements() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        let now = chrono::Utc::now().timestamp_millis();

        // 1. Setup Products with Opening Stock
        conn.execute(
            "INSERT INTO products (id, sku, name, unit_price_minor, current_stock_scaled, is_stock_tracked, created_at, updated_at)
             VALUES ('p1', 'SKU-1', 'Product 1', 10000, 10000, 1, ?1, ?1)",
            params![now],
        ).expect("Product 1 setup failed");

        conn.execute(
            "INSERT INTO stock_movements (id, product_id, reference_type, quantity_delta_scaled, resulting_stock_scaled, created_at)
             VALUES ('sm_op_1', 'p1', 'opening', 10000, 10000, ?1)",
            params![now],
        ).expect("Opening movement 1 failed");

        conn.execute(
            "INSERT INTO products (id, sku, name, unit_price_minor, current_stock_scaled, is_stock_tracked, created_at, updated_at)
             VALUES ('p2', 'SKU-2', 'Product 2', 20000, 10000, 1, ?1, ?1)",
            params![now],
        ).expect("Product 2 setup failed");

        conn.execute(
            "INSERT INTO stock_movements (id, product_id, reference_type, quantity_delta_scaled, resulting_stock_scaled, created_at)
             VALUES ('sm_op_2', 'p2', 'opening', 10000, 10000, ?1)",
            params![now],
        ).expect("Opening movement 2 failed");

        // Verify exactly 2 pre-existing opening movements exist
        let initial_sm_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM stock_movements", [], |r| r.get(0))
            .expect("Count query failed");
        assert_eq!(initial_sm_count, 2);

        // 2. Draft Invoice (grand total 0, settlement_status 'fully_paid')
        conn.execute(
            "INSERT INTO invoices (id, status, settlement_status, business_date, created_at, updated_at)
             VALUES ('draft1', 'draft', 'fully_paid', '2026-10-18', ?1, ?1)",
            params![now],
        ).expect("Draft setup failed");

        // 3. Begin Transaction with Real Writes and Injected Failure
        let tx_result = (|| -> Result<(), rusqlite::Error> {
            let tx = conn.transaction()?;

            // Real Write 1: Decrement Product 1 stock to 7000 (-3000)
            tx.execute(
                "UPDATE products SET current_stock_scaled = 7000 WHERE id = 'p1'",
                [],
            )?;
            tx.execute(
                "INSERT INTO stock_movements (id, product_id, reference_type, reference_id, quantity_delta_scaled, resulting_stock_scaled, created_at)
                 VALUES ('sm_sale_1', 'p1', 'sale', 'draft1', -3000, 7000, ?1)",
                params![now],
            )?;

            // Real Write 2: Decrement Product 2 stock to 8000 (-2000)
            tx.execute(
                "UPDATE products SET current_stock_scaled = 8000 WHERE id = 'p2'",
                [],
            )?;
            tx.execute(
                "INSERT INTO stock_movements (id, product_id, reference_type, reference_id, quantity_delta_scaled, resulting_stock_scaled, created_at)
                 VALUES ('sm_sale_2', 'p2', 'sale', 'draft1', -2000, 8000, ?1)",
                params![now],
            )?;

            // INJECTED FAILURE: Violate CHECK constraint on invoices (paid > grand_total)
            tx.execute(
                "UPDATE invoices SET grand_total_minor = 10000, paid_amount_minor = 15000 WHERE id = 'draft1'",
                [],
            )?;

            tx.commit()?;
            Ok(())
        })();

        assert!(tx_result.is_err(), "Transaction must fail and roll back");

        // 4. VERIFY: Opening stock and movements remain strictly identical
        let p1_stock: i64 = conn
            .query_row("SELECT current_stock_scaled FROM products WHERE id = 'p1'", [], |r| r.get(0))
            .expect("Query p1 stock failed");
        assert_eq!(p1_stock, 10000, "Product 1 stock must be 10000 after rollback");

        let p2_stock: i64 = conn
            .query_row("SELECT current_stock_scaled FROM products WHERE id = 'p2'", [], |r| r.get(0))
            .expect("Query p2 stock failed");
        assert_eq!(p2_stock, 10000, "Product 2 stock must be 10000 after rollback");

        let final_sm_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM stock_movements", [], |r| r.get(0))
            .expect("Count query failed");
        assert_eq!(final_sm_count, 2, "Stock movements must strictly remain at the 2 pre-existing opening movements");

        let draft_status: String = conn
            .query_row("SELECT status FROM invoices WHERE id = 'draft1'", [], |r| r.get(0))
            .expect("Query draft status failed");
        assert_eq!(draft_status, "draft", "Invoice status must still be 'draft'");
    }

    #[test]
    fn test_customer_receivables_derivation_and_matching() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        let now = chrono::Utc::now().timestamp_millis();

        // 1. Setup Customers Alice and Bob
        conn.execute("INSERT INTO customers (id, name, created_at, updated_at) VALUES ('c_alice', 'Alice', ?1, ?1)", params![now]).unwrap();
        conn.execute("INSERT INTO customers (id, name, created_at, updated_at) VALUES ('c_bob', 'Bob', ?1, ?1)", params![now]).unwrap();

        // 2. Invoice 1 for Alice: Grand total ₹100.00 (10000 minor), partially paid ₹40.00 (4000 minor)
        conn.execute(
            "INSERT INTO invoices (
                id, invoice_number, status, settlement_status, business_date,
                customer_id, customer_name_snap, business_name_snap,
                subtotal_minor, grand_total_minor, paid_amount_minor, balance_due_minor,
                created_at, updated_at, finalized_at
            ) VALUES (
                'inv_alice_1', 'INV-2026-0001', 'finalized', 'partially_paid', '2026-10-18',
                'c_alice', 'Alice', 'Test Store',
                10000, 10000, 4000, 6000,
                ?1, ?1, ?1
            )",
            params![now],
        ).unwrap();

        // Payment 1 for Alice: ₹40.00 allocated to Invoice 1
        conn.execute(
            "INSERT INTO payments (id, payment_number, customer_id, amount_minor, payment_mode, payment_date, created_at)
             VALUES ('pay_1', 'PAY-001', 'c_alice', 4000, 'cash', '2026-10-18', ?1)",
            params![now],
        ).unwrap();
        conn.execute(
            "INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_minor, created_at)
             VALUES ('alloc_1', 'pay_1', 'inv_alice_1', 4000, ?1)",
            params![now],
        ).unwrap();

        // 3. Invoice 2 for Alice: Grand total ₹50.00 (5000 minor), unpaid
        conn.execute(
            "INSERT INTO invoices (
                id, invoice_number, status, settlement_status, business_date,
                customer_id, customer_name_snap, business_name_snap,
                subtotal_minor, grand_total_minor, paid_amount_minor, balance_due_minor,
                created_at, updated_at, finalized_at
            ) VALUES (
                'inv_alice_2', 'INV-2026-0002', 'finalized', 'unpaid', '2026-10-18',
                'c_alice', 'Alice', 'Test Store',
                5000, 5000, 0, 5000,
                ?1, ?1, ?1
            )",
            params![now],
        ).unwrap();

        // Query derived receivables for Alice directly from commercial totals minus valid allocations:
        let alice_derived_receivables: i64 = conn.query_row(
            "SELECT COALESCE(SUM(i.grand_total_minor - COALESCE(pa.total_allocated, 0)), 0)
             FROM invoices i
             LEFT JOIN (
                 SELECT invoice_id, SUM(allocated_minor) AS total_allocated
                 FROM payment_allocations
                 GROUP BY invoice_id
             ) pa ON pa.invoice_id = i.id
             WHERE i.customer_id = 'c_alice' AND i.status = 'finalized';",
            [],
            |r| r.get(0),
        ).unwrap();

        // Expected: (10000 - 4000) + 5000 = 11000 minor (₹110.00)
        assert_eq!(alice_derived_receivables, 11000);

        // 4. Settle remaining balance of Invoice 1 (₹60.00)
        conn.execute(
            "INSERT INTO payments (id, payment_number, customer_id, amount_minor, payment_mode, payment_date, created_at)
             VALUES ('pay_2', 'PAY-002', 'c_alice', 6000, 'upi', '2026-10-18', ?1)",
            params![now],
        ).unwrap();
        conn.execute(
            "INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_minor, created_at)
             VALUES ('alloc_2', 'pay_2', 'inv_alice_1', 6000, ?1)",
            params![now],
        ).unwrap();

        // Update settlement status of Invoice 1
        conn.execute(
            "UPDATE invoices SET paid_amount_minor = 10000, balance_due_minor = 0, settlement_status = 'fully_paid' WHERE id = 'inv_alice_1'",
            [],
        ).unwrap();

        // Re-query derived receivables for Alice
        let alice_receivables_after: i64 = conn.query_row(
            "SELECT COALESCE(SUM(i.grand_total_minor - COALESCE(pa.total_allocated, 0)), 0)
             FROM invoices i
             LEFT JOIN (
                 SELECT invoice_id, SUM(allocated_minor) AS total_allocated
                 FROM payment_allocations
                 GROUP BY invoice_id
             ) pa ON pa.invoice_id = i.id
             WHERE i.customer_id = 'c_alice' AND i.status = 'finalized';",
            [],
            |r| r.get(0),
        ).unwrap();

        // Expected: 0 + 5000 = 5000 minor (₹50.00)
        assert_eq!(alice_receivables_after, 5000);
    }

    #[test]
    fn test_upgrade_populated_v2_database_to_v3() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        configure_connection(&conn).unwrap();

        // 1. Manually apply v1 schema
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();

        let mut h1 = Sha256::new();
        h1.update(V1_MIGRATION_SQL.as_bytes());
        let c1 = format!("{:x}", h1.finalize());
        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (1, 'v1_init', 100, ?1);",
            params![c1],
        ).unwrap();

        // 2. Apply v2 schema
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        let mut h2 = Sha256::new();
        h2.update(V2_MIGRATION_SQL.as_bytes());
        let c2 = format!("{:x}", h2.finalize());
        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (2, 'v2_regional_foundation', 200, ?1);",
            params![c2],
        ).unwrap();

        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO customers (id, name, phone, created_at, updated_at) VALUES ('c_test', 'Test Customer', '+91 9999900000', ?1, ?1);",
            params![now],
        ).unwrap();

        // 3. Populate with a finalized invoice under v2
        conn.execute(
            "INSERT INTO invoices (
                id, invoice_number, status, settlement_status, business_date,
                customer_id, customer_name_snap, business_name_snap,
                subtotal_minor, grand_total_minor, paid_amount_minor, balance_due_minor,
                snapshot_currency_exponent,
                created_at, updated_at, finalized_at
            ) VALUES (
                'inv_v2', 'INV-V2-001', 'finalized', 'unpaid', '2026-10-18',
                'c_test', 'Test Customer', 'Test Store',
                10000, 10000, 0, 10000,
                2,
                ?1, ?1, ?1
            )",
            params![now],
        ).unwrap();

        // In v2, updating snapshot_currency_exponent was permitted due to the missing trigger check
        conn.execute(
            "UPDATE invoices SET snapshot_currency_exponent = 3 WHERE id = 'inv_v2'",
            [],
        ).expect("In v2 before upgrade, exponent update was not yet protected");

        // Revert back before running migration upgrade
        conn.execute(
            "UPDATE invoices SET snapshot_currency_exponent = 2 WHERE id = 'inv_v2'",
            [],
        ).unwrap();

        // 4. Run migration upgrade (runs v3)
        run_migrations(&mut conn).expect("Upgrade to v3 must succeed");

        // Verify v3 is recorded in schema_migrations
        let v3_applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 3);",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(v3_applied, "Migration 3 must be recorded in schema_migrations");

        // 5. TEST: In v3, attempting to mutate snapshot_currency_exponent MUST FAIL!
        let illegal_update = conn.execute(
            "UPDATE invoices SET snapshot_currency_exponent = 3 WHERE id = 'inv_v2'",
            [],
        );
        assert!(illegal_update.is_err(), "Mutating snapshot_currency_exponent after v3 upgrade must be rejected by trigger");

        // 6. TEST: Legitimate settlement updates continue to SUCCEED
        let legitimate_settlement = conn.execute(
            "UPDATE invoices SET paid_amount_minor = 10000, balance_due_minor = 0, settlement_status = 'fully_paid', updated_at = ?1 WHERE id = 'inv_v2'",
            params![now + 1000],
        );
        assert!(legitimate_settlement.is_ok(), "Legitimate payment settlement must succeed after v3 upgrade");
    }

    #[test]
    fn test_upgrade_populated_v3_database_to_v4() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        configure_connection(&conn).unwrap();

        // 1. Apply v1, v2, v3
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();

        let mut h1 = Sha256::new(); h1.update(V1_MIGRATION_SQL.as_bytes());
        let mut h2 = Sha256::new(); h2.update(V2_MIGRATION_SQL.as_bytes());
        let mut h3 = Sha256::new(); h3.update(V3_MIGRATION_SQL.as_bytes());
        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1_init', 100, ?1);", params![format!("{:x}", h1.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2_regional_foundation', 200, ?1);", params![format!("{:x}", h2.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3_protect_currency_exponent', 300, ?1);", params![format!("{:x}", h3.finalize())]).unwrap();

        let now = chrono::Utc::now().timestamp_millis();

        // 2. Populate existing product and customer under v3
        conn.execute(
            "INSERT INTO products (
                id, sku, barcode, name, description, unit, unit_price_minor, cost_price_minor,
                tax_rate_bp, is_stock_tracked, current_stock_scaled, is_active, created_at, updated_at
            ) VALUES (
                'p_existing', 'SKU-EXIST-01', '8901234567890', 'Existing Tea 500g', 'Fine tea',
                'kg', 12000, 8000, 500, 1, 25000, 1, ?1, ?1
            )",
            params![now],
        ).unwrap();

        conn.execute(
            "INSERT INTO customers (
                id, name, phone, email, address_line1, city, state, postal_code, tax_identifier,
                current_balance_minor, is_active, created_at, updated_at
            ) VALUES (
                'c_existing', 'Existing Customer', '+91 9876543210', 'existing@example.com',
                'MG Road', 'Kochi', 'Kerala', '682001', '32AAAAA0000A1Z5', 0, 1, ?1, ?1
            )",
            params![now],
        ).unwrap();

        // 3. Run migration upgrade to v4
        run_migrations(&mut conn).expect("Upgrade to v4 must succeed");

        // Verify v4 is recorded in schema_migrations
        let v4_applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 4);",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(v4_applied, "Migration 4 must be recorded in schema_migrations");

        // Verify existing product was preserved and new column default applied
        let (name, min_stock): (String, i64) = conn.query_row(
            "SELECT name, min_stock_threshold_scaled FROM products WHERE id = 'p_existing';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(name, "Existing Tea 500g");
        assert_eq!(min_stock, 0);

        // Verify existing customer was preserved and country default applied
        let (cust_name, country): (String, String) = conn.query_row(
            "SELECT name, country FROM customers WHERE id = 'c_existing';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(cust_name, "Existing Customer");
        assert_eq!(country, "IND");

        // Verify categories table is functional
        conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES ('cat_1', 'Beverages', 'Hot and cold beverages', ?1, ?1);",
            params![now],
        ).unwrap();

        // Link product to category
        conn.execute(
            "UPDATE products SET category_id = 'cat_1', min_stock_threshold_scaled = 5000 WHERE id = 'p_existing';",
            [],
        ).unwrap();

        let cat_id: Option<String> = conn.query_row(
            "SELECT category_id FROM products WHERE id = 'p_existing';",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(cat_id, Some("cat_1".to_string()));
    }

    #[test]
    fn test_upgrade_populated_v4_database_to_v5() {
        let mut conn = Connection::open_in_memory().unwrap();
        configure_connection(&conn).unwrap();

        // Apply migrations 1, 2, 3, 4 manually
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        let mut h1 = Sha256::new();
        h1.update(V1_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (1, 'v1_init', ?1, ?2);",
            params![now, format!("{:x}", h1.finalize())],
        ).unwrap();

        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        let mut h2 = Sha256::new();
        h2.update(V2_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (2, 'v2_regional_foundation', ?1, ?2);",
            params![now, format!("{:x}", h2.finalize())],
        ).unwrap();

        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        let mut h3 = Sha256::new();
        h3.update(V3_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (3, 'v3_protect_currency_exponent', ?1, ?2);",
            params![now, format!("{:x}", h3.finalize())],
        ).unwrap();

        conn.execute_batch(V4_MIGRATION_SQL).unwrap();
        let mut h4 = Sha256::new();
        h4.update(V4_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (4, 'v4_catalog', ?1, ?2);",
            params![now, format!("{:x}", h4.finalize())],
        ).unwrap();

        // Populate a category in V4
        conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES ('c_groceries', 'Groceries', 'Daily items', ?1, ?1);",
            params![now],
        ).unwrap();

        // Run full migrations (should detect v1..v4 applied and apply v5)
        run_migrations(&mut conn).unwrap();

        let v5_applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 5);",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(v5_applied, "Migration 5 must be recorded in schema_migrations");

        // Verify that inserting case-insensitive duplicate "groceries" or "GROCERIES" fails at DB level
        let dup_err = conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES ('c_groceries_dup', 'groceries', 'Lowercase dup', ?1, ?1);",
            params![now],
        );
        assert!(dup_err.is_err(), "Inserting case-insensitive duplicate category must fail at SQLite index level");
    }

    #[test]
    fn test_upgrade_v4_with_duplicate_categories_and_products_reconciliation() {
        let mut conn = Connection::open_in_memory().unwrap();
        configure_connection(&conn).unwrap();

        // Apply migrations 1, 2, 3, 4 manually
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        let mut h1 = Sha256::new();
        h1.update(V1_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (1, 'v1_init', ?1, ?2);",
            params![now, format!("{:x}", h1.finalize())],
        ).unwrap();

        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        let mut h2 = Sha256::new();
        h2.update(V2_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (2, 'v2_regional_foundation', ?1, ?2);",
            params![now, format!("{:x}", h2.finalize())],
        ).unwrap();

        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        let mut h3 = Sha256::new();
        h3.update(V3_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (3, 'v3_protect_currency_exponent', ?1, ?2);",
            params![now, format!("{:x}", h3.finalize())],
        ).unwrap();

        conn.execute_batch(V4_MIGRATION_SQL).unwrap();
        let mut h4 = Sha256::new();
        h4.update(V4_MIGRATION_SQL.as_bytes());
        conn.execute(
            "INSERT INTO schema_migrations VALUES (4, 'v4_catalog', ?1, ?2);",
            params![now, format!("{:x}", h4.finalize())],
        ).unwrap();

        // Insert colliding categories in V4 (Groceries at t=100, groceries at t=200)
        conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES ('cat_legacy_a', 'Groceries', 'Original Groceries', 100, 100);",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES ('cat_legacy_b', 'groceries', 'Duplicate groceries lowercase', 200, 200);",
            [],
        ).unwrap();

        // Assign product 1 to cat_legacy_a and product 2 to cat_legacy_b
        conn.execute(
            "INSERT INTO products (
                id, sku, barcode, name, description, category_id, unit, unit_price_minor,
                cost_price_minor, tax_rate_bp, is_stock_tracked, current_stock_scaled,
                min_stock_threshold_scaled, is_active, created_at, updated_at
            ) VALUES (
                'prod_1', 'SKU-001', NULL, 'Product One', NULL, 'cat_legacy_a', 'pcs', 1000,
                800, 500, 1, 10000, 0, 1, 100, 100
            );",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO products (
                id, sku, barcode, name, description, category_id, unit, unit_price_minor,
                cost_price_minor, tax_rate_bp, is_stock_tracked, current_stock_scaled,
                min_stock_threshold_scaled, is_active, created_at, updated_at
            ) VALUES (
                'prod_2', 'SKU-002', NULL, 'Product Two', NULL, 'cat_legacy_b', 'pcs', 2000,
                1500, 500, 1, 5000, 0, 1, 200, 200
            );",
            [],
        ).unwrap();

        // Now run migrations - this MUST reconcile duplicates and succeed!
        run_migrations(&mut conn).expect("Migration must reconcile legacy duplicate categories without failing");

        // 1. Exactly 1 category remains
        let cat_count: i64 = conn.query_row("SELECT COUNT(*) FROM categories;", [], |r| r.get(0)).unwrap();
        assert_eq!(cat_count, 1, "Only the canonical category should remain");

        // 2. The canonical category is cat_legacy_a ('Groceries')
        let (surviving_id, surviving_name, surviving_desc): (String, String, Option<String>) = conn.query_row(
            "SELECT id, name, description FROM categories;",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();
        assert_eq!(surviving_id, "cat_legacy_a");
        assert_eq!(surviving_name, "Groceries");
        assert_eq!(surviving_desc.as_deref(), Some("Original Groceries"));

        // 3. Both products are repointed to the canonical category
        let p1_cat: Option<String> = conn.query_row("SELECT category_id FROM products WHERE id = 'prod_1';", [], |r| r.get(0)).unwrap();
        let p2_cat: Option<String> = conn.query_row("SELECT category_id FROM products WHERE id = 'prod_2';", [], |r| r.get(0)).unwrap();
        assert_eq!(p1_cat.as_deref(), Some("cat_legacy_a"));
        assert_eq!(p2_cat.as_deref(), Some("cat_legacy_a"), "Product 2 must be repointed to canonical category");

        // 4. Audit record exists in category_merges
        let (merged_id, canonical_id, merged_name): (String, String, String) = conn.query_row(
            "SELECT merged_category_id, canonical_category_id, merged_name FROM category_merges;",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();
        assert_eq!(merged_id, "cat_legacy_b");
        assert_eq!(canonical_id, "cat_legacy_a");
        assert_eq!(merged_name, "groceries");

        // 5. Zero foreign key violations
        {
            let mut fk_stmt = conn.prepare("PRAGMA foreign_key_check;").unwrap();
            let fk_violations = fk_stmt.query_map([], |_| Ok(())).unwrap().count();
            assert_eq!(fk_violations, 0, "No foreign key violations permitted after reconciliation");
        }

        // 6. Case-insensitive duplicate insertion is strictly rejected
        let dup_insert = conn.execute(
            "INSERT INTO categories VALUES ('cat_new', 'groceries', NULL, 300, 300);",
            [],
        );
        assert!(dup_insert.is_err(), "Duplicate category insertion must be rejected by unique index");

        // 7. Repeated run_migrations execution is fully idempotent
        run_migrations(&mut conn).expect("Repeated migration run must succeed idempotently");
        let cat_count_after: i64 = conn.query_row("SELECT COUNT(*) FROM categories;", [], |r| r.get(0)).unwrap();
        assert_eq!(cat_count_after, 1);
    }

    #[test]
    fn test_upgrade_existing_v5_database_checksum_compatibility() {
        let mut conn = Connection::open_in_memory().unwrap();
        configure_connection(&conn).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();

        // Apply migrations 1..4
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn.execute_batch(V4_MIGRATION_SQL).unwrap();

        let mut h1 = Sha256::new(); h1.update(V1_MIGRATION_SQL.as_bytes());
        let mut h2 = Sha256::new(); h2.update(V2_MIGRATION_SQL.as_bytes());
        let mut h3 = Sha256::new(); h3.update(V3_MIGRATION_SQL.as_bytes());
        let mut h4 = Sha256::new(); h4.update(V4_MIGRATION_SQL.as_bytes());

        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1_init', ?1, ?2);", params![now, format!("{:x}", h1.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2_regional_foundation', ?1, ?2);", params![now, format!("{:x}", h2.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3_protect_currency_exponent', ?1, ?2);", params![now, format!("{:x}", h3.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4_catalog', ?1, ?2);", params![now, format!("{:x}", h4.finalize())]).unwrap();

        // Simulate an already-applied V5 database with INITIAL_V5_CHECKSUM
        conn.execute("INSERT INTO schema_migrations VALUES (5, 'v5_category_nocase', ?1, ?2);", params![now, INITIAL_V5_CHECKSUM]).unwrap();
        conn.execute_batch("DROP INDEX IF EXISTS idx_categories_name; CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_nocase ON categories(name COLLATE NOCASE);").unwrap();

        // Run migrations on already-applied V5 database
        run_migrations(&mut conn).expect("run_migrations must accept INITIAL_V5_CHECKSUM without ChecksumMismatch");

        // Verify category_merges table is present
        let merges_table_exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_merges');",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(merges_table_exists, "category_merges table must exist even on existing V5 databases");
    }

    #[test]
    fn test_v5_migration_acceptance_edge_cases_and_unknown_checksum() {
        let mut conn = Connection::open_in_memory().unwrap();
        configure_connection(&conn).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();

        // 1. Seed migrations 1..4 (V4 catalog database state)
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn.execute_batch(V4_MIGRATION_SQL).unwrap();

        let mut h1 = Sha256::new(); h1.update(V1_MIGRATION_SQL.as_bytes());
        let mut h2 = Sha256::new(); h2.update(V2_MIGRATION_SQL.as_bytes());
        let mut h3 = Sha256::new(); h3.update(V3_MIGRATION_SQL.as_bytes());
        let mut h4 = Sha256::new(); h4.update(V4_MIGRATION_SQL.as_bytes());

        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1_init', ?1, ?2);", params![now, format!("{:x}", h1.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2_regional_foundation', ?1, ?2);", params![now, format!("{:x}", h2.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3_protect_currency_exponent', ?1, ?2);", params![now, format!("{:x}", h3.finalize())]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4_catalog', ?1, ?2);", params![now, format!("{:x}", h4.finalize())]).unwrap();

        // 2. Insert Edge Cases in V4:
        // Group A: Creation-time ties with blank canonical description and multiple duplicates:
        // - cat_a_2: name='Bakery', created_at=100, desc=NULL
        // - cat_a_1: name='bakery', created_at=100 (same timestamp, tie broken by id: 'cat_a_1' < 'cat_a_2')
        // - cat_a_3: name='BAKERY', created_at=200, desc='Fresh artisanal baked goods'
        // - cat_a_4: name='BaKeRy', created_at=300, desc='Alternative bakery description'
        conn.execute("INSERT INTO categories VALUES ('cat_a_2', 'Bakery', NULL, 100, 100);", []).unwrap();
        conn.execute("INSERT INTO categories VALUES ('cat_a_1', 'bakery', '', 100, 100);", []).unwrap();
        conn.execute("INSERT INTO categories VALUES ('cat_a_3', 'BAKERY', 'Fresh artisanal baked goods', 200, 200);", []).unwrap();
        conn.execute("INSERT INTO categories VALUES ('cat_a_4', 'BaKeRy', 'Alternative bakery description', 300, 300);", []).unwrap();

        // Group B: Non-blank canonical description must NOT be overwritten by duplicates:
        // - cat_b_1: name='Beverages', created_at=50, desc='Original Beverages'
        // - cat_b_2: name='beverages', created_at=150, desc='New beverage description'
        conn.execute("INSERT INTO categories VALUES ('cat_b_1', 'Beverages', 'Original Beverages', 50, 50);", []).unwrap();
        conn.execute("INSERT INTO categories VALUES ('cat_b_2', 'beverages', 'New beverage description', 150, 150);", []).unwrap();

        // Insert products pointing to duplicates across Group A and Group B
        conn.execute(
            "INSERT INTO products (
                id, sku, barcode, name, description, category_id, unit, unit_price_minor,
                cost_price_minor, tax_rate_bp, is_stock_tracked, current_stock_scaled,
                min_stock_threshold_scaled, is_active, created_at, updated_at
            ) VALUES 
            ('p_a1', 'SKU-A1', '001', 'Bread A1', NULL, 'cat_a_1', 'pcs', 100, 50, 0, 1, 5000, 1000, 1, 100, 100),
            ('p_a2', 'SKU-A2', '002', 'Bread A2', NULL, 'cat_a_2', 'pcs', 200, 80, 0, 1, 6000, 1000, 1, 100, 100),
            ('p_a3', 'SKU-A3', '003', 'Bread A3', NULL, 'cat_a_3', 'pcs', 300, 90, 0, 1, 7000, 1000, 1, 200, 200),
            ('p_a4', 'SKU-A4', '004', 'Bread A4', NULL, 'cat_a_4', 'pcs', 400, 100, 0, 1, 8000, 1000, 1, 300, 300),
            ('p_b1', 'SKU-B1', '005', 'Juice B1', NULL, 'cat_b_1', 'btl', 500, 200, 500, 0, 0, 0, 1, 50, 50),
            ('p_b2', 'SKU-B2', '006', 'Juice B2', NULL, 'cat_b_2', 'btl', 600, 250, 500, 0, 0, 0, 1, 150, 150);",
            [],
        ).unwrap();

        // Stock movement ledger entry for p_a1
        conn.execute(
            "INSERT INTO stock_movements (id, product_id, reference_type, reference_id, quantity_delta_scaled, resulting_stock_scaled, notes, created_at)
             VALUES ('sm_1', 'p_a1', 'opening', NULL, 5000, 5000, NULL, 100);",
            [],
        ).unwrap();

        // Run migrations
        run_migrations(&mut conn).expect("V5 migration must succeed across all edge cases");

        // Verification 1: Group A canonical category
        // - cat_a_1 won the tie-break (both cat_a_1 and cat_a_2 had created_at=100, 'cat_a_1' < 'cat_a_2')
        let (surviving_a_id, surviving_a_name, surviving_a_desc): (String, String, Option<String>) = conn.query_row(
            "SELECT id, name, description FROM categories WHERE id LIKE 'cat_a_%';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();
        assert_eq!(surviving_a_id, "cat_a_1", "Tie-break on equal created_at must pick lowest lexicographical ID");
        assert_eq!(surviving_a_name, "bakery");
        // Blank canonical description was populated deterministically from duplicate (cat_a_3, lowest merged id)
        assert_eq!(surviving_a_desc.as_deref(), Some("Fresh artisanal baked goods"));

        // Verification 2: Group B canonical category
        // - cat_b_1 had earlier created_at=50, had existing description 'Original Beverages', must be preserved
        let (surviving_b_id, surviving_b_name, surviving_b_desc): (String, String, Option<String>) = conn.query_row(
            "SELECT id, name, description FROM categories WHERE id LIKE 'cat_b_%';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();
        assert_eq!(surviving_b_id, "cat_b_1");
        assert_eq!(surviving_b_name, "Beverages");
        assert_eq!(surviving_b_desc.as_deref(), Some("Original Beverages"), "Existing non-blank description must NOT be overwritten");

        // Verification 3: Total category count is exactly 2
        let total_cats: i64 = conn.query_row("SELECT COUNT(*) FROM categories;", [], |r| r.get(0)).unwrap();
        assert_eq!(total_cats, 2);

        // Verification 4: All 4 Group A products are repointed to cat_a_1
        let a_products: Vec<String> = {
            let mut stmt = conn.prepare("SELECT category_id FROM products WHERE id IN ('p_a1', 'p_a2', 'p_a3', 'p_a4');").unwrap();
            stmt.query_map([], |r| r.get(0)).unwrap().map(|r| r.unwrap()).collect()
        };
        assert_eq!(a_products, vec!["cat_a_1", "cat_a_1", "cat_a_1", "cat_a_1"]);

        // Verification 5: Both Group B products are repointed to cat_b_1
        let b_products: Vec<String> = {
            let mut stmt = conn.prepare("SELECT category_id FROM products WHERE id IN ('p_b1', 'p_b2');").unwrap();
            stmt.query_map([], |r| r.get(0)).unwrap().map(|r| r.unwrap()).collect()
        };
        assert_eq!(b_products, vec!["cat_b_1", "cat_b_1"]);

        // Verification 6: Audit log category_merges contains exactly 4 merged entries
        let merge_count: i64 = conn.query_row("SELECT COUNT(*) FROM category_merges;", [], |r| r.get(0)).unwrap();
        assert_eq!(merge_count, 4, "4 merged duplicates must be recorded in category_merges");

        // Verification 7: Zero foreign key violations
        {
            let mut fk_stmt = conn.prepare("PRAGMA foreign_key_check;").unwrap();
            let fk_violations = fk_stmt.query_map([], |_| Ok(())).unwrap().count();
            assert_eq!(fk_violations, 0, "No foreign key violations allowed");
        }

        // Verification 8: Unrelated stock movement ledger is intact
        let sm_delta: i64 = conn.query_row("SELECT quantity_delta_scaled FROM stock_movements WHERE id = 'sm_1';", [], |r| r.get(0)).unwrap();
        assert_eq!(sm_delta, 5000);

        // Verification 9: Repeat startup / idempotency
        run_migrations(&mut conn).expect("Repeat run_migrations must be completely idempotent");
        let total_cats_after: i64 = conn.query_row("SELECT COUNT(*) FROM categories;", [], |r| r.get(0)).unwrap();
        assert_eq!(total_cats_after, 2);

        // Verification 10: Unknown checksum rejection
        // Corrupt V5 checksum in schema_migrations
        conn.execute("UPDATE schema_migrations SET checksum = 'deadbeef_corrupted_checksum' WHERE version = 5;", []).unwrap();
        let err = run_migrations(&mut conn).expect_err("Corrupted/unknown checksum must be rejected");
        match err {
            DbError::ChecksumMismatch { version, .. } => assert_eq!(version, 5),
            other => panic!("Expected ChecksumMismatch error, got: {:?}", other),
        }
    }

    fn test_checksum(sql: &str) -> String {
        let mut h = Sha256::new();
        h.update(sql.as_bytes());
        format!("{:x}", h.finalize())
    }

    #[test]
    fn test_upgrade_v5_database_to_v6_fresh_and_populated() {
        let now = chrono::Utc::now().timestamp_millis();
        let chk1 = test_checksum(V1_MIGRATION_SQL);
        let chk2 = test_checksum(V2_MIGRATION_SQL);
        let chk3 = test_checksum(V3_MIGRATION_SQL);
        let chk4 = test_checksum(V4_MIGRATION_SQL);
        let chk5 = test_checksum(V5_MIGRATION_SQL);

        // --- Sub-test A: Populated V5 database upgrades with conservative setup=completed ---
        let mut conn_populated = Connection::open_in_memory().unwrap();
        conn_populated.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );"
        ).unwrap();
        conn_populated.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn_populated.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn_populated.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn_populated.execute_batch(V4_MIGRATION_SQL).unwrap();
        conn_populated.execute_batch(V5_MIGRATION_SQL).unwrap();

        // Record migrations 1-5
        conn_populated.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, chk1]).unwrap();
        conn_populated.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, chk2]).unwrap();
        conn_populated.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, chk3]).unwrap();
        conn_populated.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, chk4]).unwrap();
        conn_populated.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, chk5]).unwrap();

        // Seed customized business settings and a product
        conn_populated.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code, country,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                created_at, updated_at
            ) VALUES (
                'default', 'Jabir Electronics LLC', '+971 50 1234567', 'Al Fahidi St', 'Dubai', 'Dubai', '00000', 'ARE',
                'AED', 'AED', 2, 'en-AE', 'Asia/Dubai', 'INV',
                1000, 1000
            );",
            [],
        ).unwrap();

        // Run V6 upgrade
        run_migrations(&mut conn_populated).expect("Upgrade populated V5 to V6 must succeed");

        // Verify conservative policy: is_setup_completed = 1, guide_status = 'completed'
        let (setup_done, app_pref, guide_stat, guide_ver): (i32, String, String, i32) = conn_populated.query_row(
            "SELECT is_setup_completed, appearance_preference, guide_status, guide_version FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).unwrap();
        assert_eq!(setup_done, 1, "Populated/customized database must be marked setup completed on V6 upgrade");
        assert_eq!(app_pref, "system", "Default appearance must be system");
        assert_eq!(guide_stat, "completed", "Existing user guide status must be completed");
        assert_eq!(guide_ver, 1);

        // --- Sub-test B: Fresh default V5 database upgrades with setup=0 and guide=unseen ---
        let mut conn_fresh = Connection::open_in_memory().unwrap();
        conn_fresh.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );"
        ).unwrap();
        conn_fresh.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn_fresh.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn_fresh.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn_fresh.execute_batch(V4_MIGRATION_SQL).unwrap();
        conn_fresh.execute_batch(V5_MIGRATION_SQL).unwrap();

        conn_fresh.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, chk1]).unwrap();
        conn_fresh.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, chk2]).unwrap();
        conn_fresh.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, chk3]).unwrap();
        conn_fresh.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, chk4]).unwrap();
        conn_fresh.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, chk5]).unwrap();

        // Seed un-customized default business settings (same as default seed)
        conn_fresh.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code, country,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                created_at, updated_at
            ) VALUES (
                'default', 'My Retail Store', '+91 9876543210', '123 Market Road', 'Kochi', 'Kerala', '682001', 'IND',
                'INR', '₹', 2, 'en-IN', 'Asia/Kolkata', 'INV',
                1000, 1000
            );",
            [],
        ).unwrap();

        // Run V6 upgrade on fresh DB
        run_migrations(&mut conn_fresh).expect("Upgrade fresh V5 to V6 must succeed");

        let (fresh_setup_done, fresh_guide_stat): (i32, String) = conn_fresh.query_row(
            "SELECT is_setup_completed, guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(fresh_setup_done, 0, "Fresh un-customized database must keep setup=0");
        assert_eq!(fresh_guide_stat, "unseen", "Fresh database must keep guide=unseen");

        // Idempotency
        run_migrations(&mut conn_fresh).expect("Repeat migration must be idempotent");
    }

    #[test]
    fn test_upgrade_legacy_database_with_default_name_but_custom_regional_settings() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );"
        ).unwrap();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn.execute_batch(V4_MIGRATION_SQL).unwrap();
        conn.execute_batch(V5_MIGRATION_SQL).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        let chk1 = test_checksum(V1_MIGRATION_SQL);
        let chk2 = test_checksum(V2_MIGRATION_SQL);
        let chk3 = test_checksum(V3_MIGRATION_SQL);
        let chk4 = test_checksum(V4_MIGRATION_SQL);
        let chk5 = test_checksum(V5_MIGRATION_SQL);
        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, chk1]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, chk2]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, chk3]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, chk4]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, chk5]).unwrap();

        // Seed with DEFAULT business_name ("My Retail Store") BUT customized UAE phone, address, currency, timezone
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code, country,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                created_at, updated_at
            ) VALUES (
                'default', 'My Retail Store', '+971 50 123 4567', 'Al Wasl Road', 'Dubai', 'Dubai', '', 'United Arab Emirates',
                'AED', 'AED', 2, 'en-AE', 'Asia/Dubai', 'DXB',
                1000, 1000
            );",
            [],
        ).unwrap();

        // Run V6 migration
        run_migrations(&mut conn).expect("Upgrade must succeed");

        let (setup_done, guide_stat): (i32, String) = conn.query_row(
            "SELECT is_setup_completed, guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();

        assert_eq!(
            setup_done, 1,
            "A business with default name but custom UAE phone/address/AED/timezone must be marked setup completed"
        );
        assert_eq!(
            guide_stat, "completed",
            "An existing customized business must not be interrupted with guide on upgrade"
        );
    }

    #[test]
    fn test_v6_dual_checksum_compatibility_and_repair() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );"
        ).unwrap();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn.execute_batch(V4_MIGRATION_SQL).unwrap();
        conn.execute_batch(V5_MIGRATION_SQL).unwrap();
        conn.execute_batch(V6_MIGRATION_SQL).unwrap();

        let now = chrono::Utc::now().timestamp_millis();
        let chk1 = test_checksum(V1_MIGRATION_SQL);
        let chk2 = test_checksum(V2_MIGRATION_SQL);
        let chk3 = test_checksum(V3_MIGRATION_SQL);
        let chk4 = test_checksum(V4_MIGRATION_SQL);
        let chk5 = test_checksum(V5_MIGRATION_SQL);
        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, chk1]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, chk2]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, chk3]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, chk4]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, chk5]).unwrap();
        // Insert with INITIAL_V6_CHECKSUM
        conn.execute("INSERT INTO schema_migrations VALUES (6, 'v6', ?1, ?2);", params![now, INITIAL_V6_CHECKSUM]).unwrap();

        // Seed with customized business settings that initial V6 missed (is_setup_completed = 0)
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code, country,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
            ) VALUES (
                'default', 'My Retail Store', '+971 50 123 4567', 'Business Bay', 'Dubai', 'Dubai', '', 'United Arab Emirates',
                'AED', 'AED', 2, 'en-AE', 'Asia/Dubai', 'INV',
                0, 'dark', 'unseen', 1,
                1000, 1000
            );",
            [],
        ).unwrap();

        // Running migrations must succeed with INITIAL_V6_CHECKSUM and repair is_setup_completed = 1
        run_migrations(&mut conn).expect("Dual-checksum upgrade must succeed");

        let (setup_done, app_pref): (i32, String) = conn.query_row(
            "SELECT is_setup_completed, appearance_preference FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();

        assert_eq!(setup_done, 1, "Conservative repair must mark setup completed for customized business");
        assert_eq!(app_pref, "dark", "User's dark appearance must be preserved");

        // Verify checksum advanced to current_checksum6
        let mut hasher6 = Sha256::new();
        hasher6.update(V6_MIGRATION_SQL.as_bytes());
        let current_chk6 = format!("{:x}", hasher6.finalize());
        let stored_chk: String = conn.query_row(
            "SELECT checksum FROM schema_migrations WHERE version = 6;",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(stored_chk, current_chk6, "Migration checksum must advance to current V6 checksum");

        // Second run must be idempotent and preserve state
        run_migrations(&mut conn).expect("Second run of migrations must succeed");
        let (setup_done2, guide_st): (i32, String) = conn.query_row(
            "SELECT is_setup_completed, guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(setup_done2, 1);
        assert_eq!(guide_st, "completed");
    }

    #[test]
    fn test_fresh_setup_preserves_unseen_guide_status_across_restarts() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Initial migration must succeed");

        let now = chrono::Utc::now().timestamp_millis();
        // Simulate user completing onboarding wizard with custom business details, but guide is still unseen
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, legal_name, phone, address_line1, city, state, postal_code, country,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
            ) VALUES (
                'default', 'Zen Fresh Mart', 'Zen Fresh Retail LLC', '+971 50 999 8888', 'Al Wasl Road', 'Abu Dhabi', 'Abu Dhabi', '00000', 'United Arab Emirates',
                'AED', 'AED', 2, 'en-AE', 'Asia/Dubai', 'INV',
                1, 'system', 'unseen', 1,
                ?1, ?1
            );",
            params![now],
        ).unwrap();

        // Verify state prior to restart
        let guide_status_before: String = conn.query_row(
            "SELECT guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(guide_status_before, "unseen");

        // Simulate app restart by running migrations again on existing database
        run_migrations(&mut conn).expect("Restart migration check must succeed");

        // Crucial regression check: guide_status MUST remain 'unseen' so first-launch auto-prompt works!
        let (is_completed, guide_status_after): (i32, String) = conn.query_row(
            "SELECT is_setup_completed, guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(is_completed, 1, "Setup completed flag must be preserved");
        assert_eq!(
            guide_status_after, "unseen",
            "guide_status MUST NOT be forcefully changed to 'completed' on subsequent restarts!"
        );
    }

    #[test]
    fn test_skipped_and_completed_guide_states_preserved_across_repeated_restarts() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Initial migration must succeed");

        let now = chrono::Utc::now().timestamp_millis();
        // 1. Test skipped state preservation across restarts
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
            ) VALUES (
                'default', 'Skipped Guide Store', '+91 9876543210', '123 Market Road', 'Kochi', 'Kerala', '682001',
                'INR', '₹', 2, 'en-IN', 'Asia/Kolkata', 'INV',
                1, 'system', 'skipped', 1,
                ?1, ?1
            );",
            params![now],
        ).unwrap();

        for _ in 0..3 {
            run_migrations(&mut conn).expect("Restart must succeed");
            let st: String = conn.query_row(
                "SELECT guide_status FROM business_settings WHERE id = 'default';",
                [],
                |r| r.get(0),
            ).unwrap();
            assert_eq!(st, "skipped", "Skipped guide status must survive restarts");
        }

        // 2. Test completed state preservation across restarts
        conn.execute(
            "UPDATE business_settings SET guide_status = 'completed' WHERE id = 'default';",
            [],
        ).unwrap();

        for _ in 0..3 {
            run_migrations(&mut conn).expect("Restart must succeed");
            let st: String = conn.query_row(
                "SELECT guide_status FROM business_settings WHERE id = 'default';",
                [],
                |r| r.get(0),
            ).unwrap();
            assert_eq!(st, "completed", "Completed guide status must survive restarts");
        }
    }

    #[test]
    fn test_repeat_migration_execution_without_unintended_state_changes() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Initial migration must succeed");

        let now = chrono::Utc::now().timestamp_millis();
        // Customize settings
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, phone, address_line1, city, state, postal_code,
                currency_code, currency_symbol, currency_exponent, locale, timezone, invoice_prefix,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
            ) VALUES (
                'default', 'Immutable Test Enterprise', '+91 9876543210', '123 Market Road', 'Kochi', 'Kerala', '682001',
                'INR', '₹', 2, 'en-IN', 'Asia/Kolkata', 'INV',
                1, 'dark', 'unseen', 1,
                ?1, ?1
            );",
            params![now],
        ).unwrap();

        // Run migrations 5 times in a loop
        for _ in 0..5 {
            run_migrations(&mut conn).expect("Repeat migration execution must succeed");
        }

        let (name, appearance, guide): (String, String, String) = conn.query_row(
            "SELECT business_name, appearance_preference, guide_status FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        ).unwrap();

        assert_eq!(name, "Immutable Test Enterprise");
        assert_eq!(appearance, "dark");
        assert_eq!(guide, "unseen");
    }

    #[test]
    fn test_unknown_v6_checksum_rejected() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        let now = chrono::Utc::now().timestamp_millis();
        let chk1 = test_checksum(V1_MIGRATION_SQL);
        let chk2 = test_checksum(V2_MIGRATION_SQL);
        let chk3 = test_checksum(V3_MIGRATION_SQL);
        let chk4 = test_checksum(V4_MIGRATION_SQL);
        let chk5 = test_checksum(V5_MIGRATION_SQL);
        conn.execute("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, checksum TEXT NOT NULL);", []).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, chk1]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, chk2]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, chk3]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, chk4]).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, chk5]).unwrap();
        // Insert with unknown / corrupt checksum
        conn.execute("INSERT INTO schema_migrations VALUES (6, 'v6', ?1, 'corrupted_or_tampered_v6_hash');", params![now]).unwrap();

        let result = run_migrations(&mut conn);
        match result {
            Err(DbError::ChecksumMismatch { version, expected, .. }) => {
                assert_eq!(version, 6);
                assert_eq!(expected, "corrupted_or_tampered_v6_hash");
            }
            other => panic!("Expected ChecksumMismatch for version 6, got {:?}", other),
        }
    }

    #[test]
    fn test_upgrade_v6_database_to_v7_cashbook_and_triggers() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        run_migrations(&mut conn).expect("Migrations failed");

        // Verify version 7 is recorded
        let v7_applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 7);",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(v7_applied, "Migration 7 must be marked applied");

        // Verify default categories seeded
        let cat_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM cashbook_categories;",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(cat_count, 9, "9 default categories must be seeded");

        // Insert business settings row
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO business_settings (id, business_name, phone, address_line1, city, state, postal_code, currency_code, currency_exponent, created_at, updated_at)
             VALUES ('default', 'Test Store', '9999999999', 'Road 1', 'City', 'State', '123456', 'INR', 2, ?1, ?1);",
            params![now],
        ).unwrap();

        // Create an account
        conn.execute(
            "INSERT INTO money_accounts (id, account_name, account_type, opening_balance_minor, allow_negative_balance, currency_code, currency_exponent, created_at, updated_at)
             VALUES ('acc-cash-1', 'Main Cash Drawer', 'cash', 500000, 0, 'INR', 2, 1000, 1000);",
            [],
        ).unwrap();

        // Base currency change should be rejected because opening_balance_minor != 0
        let cur_change = conn.execute(
            "UPDATE business_settings SET currency_code = 'AED' WHERE id = 'default';",
            [],
        );
        assert!(cur_change.is_err(), "Currency change must be rejected when non-zero account exists");

        // Post a voucher
        conn.execute(
            "INSERT INTO cashbook_vouchers (
                id, voucher_number, idempotency_key, payload_hash, account_id, direction,
                classification, payment_method, amount_minor, business_date, status,
                created_at, posted_at
            ) VALUES (
                'vch-1', 'RCP-202610-00001', 'key-1', 'hash-1', 'acc-cash-1', 'inflow',
                'operating_income', 'cash', 100000, '2026-10-19', 'posted', 1000, 1000
            );",
            [],
        ).unwrap();

        // Create movement
        conn.execute(
            "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
             VALUES ('mov-1', 'vch-1', 'acc-cash-1', 100000, '2026-10-19', 1, 1000);",
            [],
        ).unwrap();

        // Attempting to update opening balance now must be rejected
        let update_opening = conn.execute(
            "UPDATE money_accounts SET opening_balance_minor = 600000 WHERE id = 'acc-cash-1';",
            [],
        );
        assert!(update_opening.is_err(), "Updating opening balance when movements exist must fail");

        // Attempting to delete posted voucher must be rejected
        let delete_voucher = conn.execute("DELETE FROM cashbook_vouchers WHERE id = 'vch-1';", []);
        assert!(delete_voucher.is_err(), "Deleting posted voucher must fail");

        // Attempting to update movement must be rejected
        let update_movement = conn.execute("UPDATE cashbook_movements SET amount_minor = 200000 WHERE id = 'mov-1';", []);
        assert!(update_movement.is_err(), "Updating movement must fail");

        // Attempting to delete movement must be rejected
        let delete_movement = conn.execute("DELETE FROM cashbook_movements WHERE id = 'mov-1';", []);
        assert!(delete_movement.is_err(), "Deleting movement must fail");

        // Attempting to alter financial fields of posted voucher must be rejected
        let update_amount = conn.execute("UPDATE cashbook_vouchers SET amount_minor = 999 WHERE id = 'vch-1';", []);
        assert!(update_amount.is_err(), "Altering financial fields of posted voucher must fail");
    }

    #[test]
    fn test_upgrade_v7_database_to_v8_cashbook_integrity_hardening() {
        let mut conn = Connection::open_in_memory().expect("In-memory db failed");
        configure_connection(&conn).expect("Config failed");

        // Set up schema migrations table and apply V1 to V7 manually
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT NOT NULL
            );",
        ).unwrap();

        let sha256_of = |sql: &str| -> String {
            let mut h = Sha256::new();
            h.update(sql.as_bytes());
            format!("{:x}", h.finalize())
        };

        let now = chrono::Utc::now().timestamp_millis();
        conn.execute_batch(V1_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (1, 'v1', ?1, ?2);", params![now, sha256_of(V1_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V2_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (2, 'v2', ?1, ?2);", params![now, sha256_of(V2_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V3_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (3, 'v3', ?1, ?2);", params![now, sha256_of(V3_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V4_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (4, 'v4', ?1, ?2);", params![now, sha256_of(V4_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V5_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (5, 'v5', ?1, ?2);", params![now, sha256_of(V5_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V6_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (6, 'v6', ?1, ?2);", params![now, sha256_of(V6_MIGRATION_SQL)]).unwrap();
        conn.execute_batch(V7_MIGRATION_SQL).unwrap();
        conn.execute("INSERT INTO schema_migrations VALUES (7, 'v7_cashbook_foundation', ?1, ?2);", params![now, sha256_of(V7_MIGRATION_SQL)]).unwrap();

        // Populate business settings and cashbook account in V7
        conn.execute(
            "INSERT INTO business_settings (id, business_name, phone, address_line1, city, state, postal_code, currency_code, currency_exponent, created_at, updated_at)
             VALUES ('default', 'Test Store', '9999999999', 'Road 1', 'City', 'State', '123456', 'INR', 2, ?1, ?1);",
            params![now],
        ).unwrap();

        conn.execute(
            "INSERT INTO money_accounts (id, account_name, account_type, opening_balance_minor, allow_negative_balance, currency_code, currency_exponent, created_at, updated_at)
             VALUES ('acc-1', 'Main Cash Drawer', 'cash', 500000, 0, 'INR', 2, 1000, 1000);",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO cashbook_vouchers (
                id, voucher_number, idempotency_key, payload_hash, account_id, direction,
                classification, payment_method, amount_minor, business_date, status,
                created_at, posted_at
            ) VALUES (
                'vch-1', 'RCP-202610-00001', 'key-1', 'hash-1', 'acc-1', 'inflow',
                'operating_income', 'cash', 100000, '2026-10-19', 'posted', 1000, 1000
            );",
            [],
        ).unwrap();

        conn.execute(
            "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
             VALUES ('mov-1', 'vch-1', 'acc-1', 100000, '2026-10-19', 1, 1000);",
            [],
        ).unwrap();

        // In V7 without V8, a status downgrade to draft would succeed.
        // Now run migration runner which will forward-migrate to V8!
        run_migrations(&mut conn).expect("Forward migration to V8 must succeed");

        // Verify V8 recorded in schema_migrations
        let v8_applied: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 8);",
            [],
            |r| r.get(0),
        ).unwrap();
        assert!(v8_applied, "Migration 8 must be applied");

        // 1. Verify status downgrade to draft is blocked by hardened trigger
        let downgrade_res = conn.execute("UPDATE cashbook_vouchers SET status = 'draft' WHERE id = 'vch-1';", []);
        assert!(downgrade_res.is_err(), "Downgrading posted voucher to draft must be rejected");
        assert!(downgrade_res.unwrap_err().to_string().contains("Cannot change status of a posted voucher"));

        // 2. Verify second movement insertion for C1 voucher is blocked
        let second_mov_res = conn.execute(
            "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
             VALUES ('mov-2', 'vch-1', 'acc-1', 100000, '2026-10-19', 2, 1000);",
            [],
        );
        assert!(second_mov_res.is_err(), "Multiple movements for C1 voucher must be rejected");
        assert!(second_mov_res.unwrap_err().to_string().contains("Multiple movements for a single C1 voucher are prohibited"));

        // 3. Verify movement agreement (sign mismatch) is blocked
        conn.execute(
            "INSERT INTO cashbook_vouchers (
                id, voucher_number, idempotency_key, payload_hash, account_id, direction,
                classification, payment_method, amount_minor, business_date, status,
                created_at, posted_at
            ) VALUES (
                'vch-2', 'RCP-202610-00002', 'key-2', 'hash-2', 'acc-1', 'inflow',
                'operating_income', 'cash', 50000, '2026-10-19', 'posted', 1000, 1000
            );",
            [],
        ).unwrap();

        let disagree_mov_res = conn.execute(
            "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
             VALUES ('mov-agree-err', 'vch-2', 'acc-1', -50000, '2026-10-19', 2, 1000);",
            [],
        );
        assert!(disagree_mov_res.is_err(), "Mismatched movement sign must be rejected");
        assert!(disagree_mov_res.unwrap_err().to_string().contains("Movement details (account, date, amount, sign) must agree with voucher"));

        // 4. Verify audit event immutability
        conn.execute(
            "INSERT INTO cashbook_audit_events (id, voucher_id, event_type, details_json, created_at)
             VALUES ('aud-1', 'vch-1', 'voucher_posted', '{}', 1000);",
            [],
        ).unwrap();

        let update_audit = conn.execute("UPDATE cashbook_audit_events SET event_type = 'hacked' WHERE id = 'aud-1';", []);
        assert!(update_audit.is_err(), "Updating audit events must be rejected");
        assert!(update_audit.unwrap_err().to_string().contains("Cannot update cashbook audit events"));

        let delete_audit = conn.execute("DELETE FROM cashbook_audit_events WHERE id = 'aud-1';", []);
        assert!(delete_audit.is_err(), "Deleting audit events must be rejected");
        assert!(delete_audit.unwrap_err().to_string().contains("Cannot delete cashbook audit events"));
    }
}

