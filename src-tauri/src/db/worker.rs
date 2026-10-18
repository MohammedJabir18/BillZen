use crate::db::initialize_database;
use crate::domain::models::BusinessSettings;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use tokio::sync::{mpsc, oneshot};

pub enum DbRequest {
    GetBusinessSettings {
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    UpdateBusinessSettings {
        settings: BusinessSettings,
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    Ping {
        respond_to: oneshot::Sender<Result<String, String>>,
    },
}

#[derive(Clone)]
pub struct DbWorkerHandle {
    sender: mpsc::Sender<DbRequest>,
}

impl DbWorkerHandle {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let (tx, mut rx) = mpsc::channel::<DbRequest>(100);
        let (init_tx, init_rx) = std::sync::mpsc::channel::<Result<(), String>>();

        std::thread::Builder::new()
            .name("billzen-db-worker".to_string())
            .spawn(move || {
                let mut conn = match initialize_database(&db_path) {
                    Ok(c) => c,
                    Err(e) => {
                        let err_msg = format!("Database initialization failed: {}", e);
                        eprintln!("[BillZen DbWorker] {}", err_msg);
                        let _ = init_tx.send(Err(err_msg));
                        return;
                    }
                };

                // Seed default settings if table is empty
                if let Err(e) = seed_default_settings(&conn) {
                    let err_msg = format!("Failed to seed default settings: {}", e);
                    eprintln!("[BillZen DbWorker] {}", err_msg);
                    let _ = init_tx.send(Err(err_msg));
                    return;
                }

                // Signal successful initialization handshake to caller
                if init_tx.send(Ok(())).is_err() {
                    // The receiver was dropped, caller exited or gave up
                    return;
                }

                while let Some(request) = rx.blocking_recv() {
                    match request {
                        DbRequest::GetBusinessSettings { respond_to } => {
                            let result = fetch_business_settings(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateBusinessSettings { settings, respond_to } => {
                            let result = save_business_settings(&mut conn, settings);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::Ping { respond_to } => {
                            let _ = respond_to.send(Ok("pong".to_string()));
                        }
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn db worker thread: {}", e))?;

        // Await worker initialization handshake cleanly without tokio runtime conflict
        match init_rx.recv() {
            Ok(Ok(())) => Ok(Self { sender: tx }),
            Ok(Err(err)) => Err(err),
            Err(_) => Err("Database worker thread terminated before completing initialization handshake".to_string()),
        }
    }

    pub async fn get_business_settings(&self) -> Result<BusinessSettings, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetBusinessSettings { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn update_business_settings(
        &self,
        settings: BusinessSettings,
    ) -> Result<BusinessSettings, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateBusinessSettings {
                settings,
                respond_to: tx,
            })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn ping(&self) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::Ping { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }
}

fn seed_default_settings(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM business_settings WHERE id = 'default';",
        [],
        |r| r.get(0),
    )?;

    if count == 0 {
        let default_settings = BusinessSettings::default();
        conn.execute(
            "INSERT INTO business_settings (
                id, business_name, legal_name, tax_identifier, phone, email,
                address_line1, address_line2, city, state, postal_code,
                country, currency_code, currency_symbol, currency_exponent, locale,
                timezone, invoice_prefix, terms_and_conditions, created_at, updated_at
            ) VALUES (
                'default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20
            );",
            params![
                default_settings.business_name,
                default_settings.legal_name,
                default_settings.tax_identifier,
                default_settings.phone,
                default_settings.email,
                default_settings.address_line1,
                default_settings.address_line2,
                default_settings.city,
                default_settings.state,
                default_settings.postal_code,
                default_settings.country,
                default_settings.currency_code,
                default_settings.currency_symbol,
                default_settings.currency_exponent,
                default_settings.locale,
                default_settings.timezone,
                default_settings.invoice_prefix,
                default_settings.terms_and_conditions,
                default_settings.created_at,
                default_settings.updated_at,
            ],
        )?;
    }
    Ok(())
}

fn fetch_business_settings(conn: &Connection) -> Result<BusinessSettings, String> {
    conn.query_row(
        "SELECT id, business_name, legal_name, tax_identifier, phone, email,
                address_line1, address_line2, city, state, postal_code,
                country, currency_code, currency_symbol, currency_exponent, locale,
                timezone, invoice_prefix, terms_and_conditions, created_at, updated_at
         FROM business_settings WHERE id = 'default';",
        [],
        |row| {
            Ok(BusinessSettings {
                id: row.get(0)?,
                business_name: row.get(1)?,
                legal_name: row.get(2)?,
                tax_identifier: row.get(3)?,
                phone: row.get(4)?,
                email: row.get(5)?,
                address_line1: row.get(6)?,
                address_line2: row.get(7)?,
                city: row.get(8)?,
                state: row.get(9)?,
                postal_code: row.get(10)?,
                country: row.get(11)?,
                currency_code: row.get(12)?,
                currency_symbol: row.get(13)?,
                currency_exponent: row.get(14)?,
                locale: row.get(15)?,
                timezone: row.get(16)?,
                invoice_prefix: row.get(17)?,
                terms_and_conditions: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read business settings: {}", e))
}

fn save_business_settings(
    conn: &mut Connection,
    mut settings: BusinessSettings,
) -> Result<BusinessSettings, String> {
    // 1. Validate currency code and exponent in Rust domain
    crate::domain::currency::validate_currency(&settings.currency_code, settings.currency_exponent)?;

    // 2. Prevent unsafe base currency changes if existing financial/catalog records exist
    let current = fetch_business_settings(conn)?;
    if current.currency_code != settings.currency_code
        || current.currency_exponent != settings.currency_exponent
    {
        let has_products: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM products LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check products: {}", e))?;

        let has_invoices: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM invoices LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check invoices: {}", e))?;

        let has_payments: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM payments LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check payments: {}", e))?;

        let has_expenses: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM expenses LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check expenses: {}", e))?;

        if has_products || has_invoices || has_payments || has_expenses {
            return Err("Cannot change base currency after catalog products, invoices, payments, or expenses exist in the system. Changing currency would silently corrupt historical ledger values.".to_string());
        }
    }

    settings.updated_at = chrono::Utc::now().timestamp_millis();
    settings.id = "default".to_string();

    conn.execute(
        "UPDATE business_settings SET
            business_name = ?1,
            legal_name = ?2,
            tax_identifier = ?3,
            phone = ?4,
            email = ?5,
            address_line1 = ?6,
            address_line2 = ?7,
            city = ?8,
            state = ?9,
            postal_code = ?10,
            country = ?11,
            currency_code = ?12,
            currency_symbol = ?13,
            currency_exponent = ?14,
            locale = ?15,
            timezone = ?16,
            invoice_prefix = ?17,
            terms_and_conditions = ?18,
            updated_at = ?19
         WHERE id = 'default';",
        params![
            settings.business_name,
            settings.legal_name,
            settings.tax_identifier,
            settings.phone,
            settings.email,
            settings.address_line1,
            settings.address_line2,
            settings.city,
            settings.state,
            settings.postal_code,
            settings.country,
            settings.currency_code,
            settings.currency_symbol,
            settings.currency_exponent,
            settings.locale,
            settings.timezone,
            settings.invoice_prefix,
            settings.terms_and_conditions,
            settings.updated_at,
        ],
    )
    .map_err(|e| format!("Failed to update business settings: {}", e))?;

    fetch_business_settings(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_settings_persistence_across_full_worker_restarts() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("persist_test.db");

        // 1. Initial run: spawn worker 1 and fetch default seeded profile
        let worker1 = DbWorkerHandle::new(db_path.clone()).expect("worker 1 should start");
        let mut settings = rt
            .block_on(worker1.get_business_settings())
            .expect("should read initial settings");
        assert_eq!(settings.business_name, "My Retail Store");

        // 2. Mutate settings with distinctive values
        settings.business_name = "Distinctive Verified Store 2026".to_string();
        settings.phone = "+91 9999988888".to_string();
        settings.city = "Aluva".to_string();
        settings.tax_identifier = Some("32DISTINCT1234".to_string());

        let saved = rt
            .block_on(worker1.update_business_settings(settings))
            .expect("should save settings");
        assert_eq!(saved.business_name, "Distinctive Verified Store 2026");

        // 3. Fully terminate worker 1 (drop handle and wait briefly for thread to exit)
        drop(worker1);
        std::thread::sleep(std::time::Duration::from_millis(50));

        // 4. Relaunch: spawn worker 2 pointing to the same database file
        let worker2 = DbWorkerHandle::new(db_path.clone()).expect("worker 2 should restart");
        let restored = rt
            .block_on(worker2.get_business_settings())
            .expect("worker 2 should read persisted settings");

        // 5. Assert that distinctive settings survived full restart
        assert_eq!(restored.business_name, "Distinctive Verified Store 2026");
        assert_eq!(restored.phone, "+91 9999988888");
        assert_eq!(restored.city, "Aluva");
        assert_eq!(restored.tax_identifier.as_deref(), Some("32DISTINCT1234"));
    }

    #[test]
    fn test_invalid_currency_code_or_exponent_rejected_on_save() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("currency_validation_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        let mut settings = rt
            .block_on(worker.get_business_settings())
            .expect("should read initial settings");

        // Attempt 1: Invalid exponent for INR (3 instead of 2)
        settings.currency_exponent = 3;
        let err1 = rt
            .block_on(worker.update_business_settings(settings.clone()))
            .expect_err("Invalid exponent for INR must be rejected");
        assert!(err1.contains("Invalid exponent 3 for currency 'INR'"));

        // Attempt 2: Unsupported currency code
        settings.currency_code = "UNKNOWN".to_string();
        settings.currency_exponent = 2;
        let err2 = rt
            .block_on(worker.update_business_settings(settings))
            .expect_err("Unsupported currency code must be rejected");
        assert!(err2.contains("Unsupported currency code"));
    }

    #[test]
    fn test_currency_change_prevented_when_products_or_invoices_exist() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("currency_change_prevention_test.db");

        // 1. Setup a product directly in the database
        {
            let mut conn = Connection::open(&db_path).unwrap();
            crate::db::run_migrations(&mut conn).unwrap();
            let now = chrono::Utc::now().timestamp_millis();
            conn.execute(
                "INSERT INTO products (id, sku, name, unit_price_minor, current_stock_scaled, is_stock_tracked, created_at, updated_at)
                 VALUES ('p1', 'SKU-EXISTING', 'Sample Existing Product', 5000, 1000, 1, ?1, ?1)",
                params![now],
            ).unwrap();
        }

        let worker = DbWorkerHandle::new(db_path).expect("worker should start");
        let mut settings = rt
            .block_on(worker.get_business_settings())
            .expect("should read initial settings");

        // Attempt to switch currency from INR to KWD when products already exist
        settings.currency_code = "KWD".to_string();
        settings.currency_symbol = "KWD".to_string();
        settings.currency_exponent = 3;
        settings.locale = "en-KW".to_string();

        let err = rt
            .block_on(worker.update_business_settings(settings))
            .expect_err("Currency change must be rejected when catalog products exist");
        assert!(
            err.contains("Cannot change base currency after catalog products, invoices, payments, or expenses exist"),
            "Error message must explain currency change block: {}",
            err
        );
    }
}
