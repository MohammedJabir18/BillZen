pub mod worker;

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

    Ok(())
}

pub fn initialize_database(db_path: &Path) -> Result<Connection, DbError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
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
}
