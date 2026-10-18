use crate::db::initialize_database;
use crate::domain::catalog::{
    Category, CreateCategoryDto, CreateCustomerDto, CreateProductDto, Customer, CustomerFilter,
    Product, ProductFilter, UpdateCustomerDto, UpdateProductDto,
};
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
    // Products
    GetProducts {
        filter: ProductFilter,
        respond_to: oneshot::Sender<Result<Vec<Product>, String>>,
    },
    CreateProduct {
        dto: CreateProductDto,
        respond_to: oneshot::Sender<Result<Product, String>>,
    },
    UpdateProduct {
        dto: UpdateProductDto,
        respond_to: oneshot::Sender<Result<Product, String>>,
    },
    ArchiveProduct {
        id: String,
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    RestoreProduct {
        id: String,
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    // Customers
    GetCustomers {
        filter: CustomerFilter,
        respond_to: oneshot::Sender<Result<Vec<Customer>, String>>,
    },
    CreateCustomer {
        dto: CreateCustomerDto,
        respond_to: oneshot::Sender<Result<Customer, String>>,
    },
    UpdateCustomer {
        dto: UpdateCustomerDto,
        respond_to: oneshot::Sender<Result<Customer, String>>,
    },
    ArchiveCustomer {
        id: String,
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    RestoreCustomer {
        id: String,
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    // Categories
    GetCategories {
        respond_to: oneshot::Sender<Result<Vec<Category>, String>>,
    },
    CreateCategory {
        dto: CreateCategoryDto,
        respond_to: oneshot::Sender<Result<Category, String>>,
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
                        // Products
                        DbRequest::GetProducts { filter, respond_to } => {
                            let result = fetch_products(&conn, filter);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CreateProduct { dto, respond_to } => {
                            let result = create_product(&mut conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateProduct { dto, respond_to } => {
                            let result = update_product(&mut conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::ArchiveProduct { id, respond_to } => {
                            let result = archive_product(&conn, &id);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::RestoreProduct { id, respond_to } => {
                            let result = restore_product(&conn, &id);
                            let _ = respond_to.send(result);
                        }
                        // Customers
                        DbRequest::GetCustomers { filter, respond_to } => {
                            let result = fetch_customers(&conn, filter);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CreateCustomer { dto, respond_to } => {
                            let result = create_customer(&mut conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateCustomer { dto, respond_to } => {
                            let result = update_customer(&mut conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::ArchiveCustomer { id, respond_to } => {
                            let result = archive_customer(&conn, &id);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::RestoreCustomer { id, respond_to } => {
                            let result = restore_customer(&conn, &id);
                            let _ = respond_to.send(result);
                        }
                        // Categories
                        DbRequest::GetCategories { respond_to } => {
                            let result = fetch_categories(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CreateCategory { dto, respond_to } => {
                            let result = create_category(&conn, dto);
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

    // Products
    pub async fn get_products(&self, filter: ProductFilter) -> Result<Vec<Product>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetProducts { filter, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_product(&self, dto: CreateProductDto) -> Result<Product, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateProduct { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn update_product(&self, dto: UpdateProductDto) -> Result<Product, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateProduct { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn archive_product(&self, id: String) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::ArchiveProduct { id, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn restore_product(&self, id: String) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::RestoreProduct { id, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    // Customers
    pub async fn get_customers(&self, filter: CustomerFilter) -> Result<Vec<Customer>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetCustomers { filter, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_customer(&self, dto: CreateCustomerDto) -> Result<Customer, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateCustomer { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn update_customer(&self, dto: UpdateCustomerDto) -> Result<Customer, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateCustomer { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn archive_customer(&self, id: String) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::ArchiveCustomer { id, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn restore_customer(&self, id: String) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::RestoreCustomer { id, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    // Categories
    pub async fn get_categories(&self) -> Result<Vec<Category>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetCategories { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_category(&self, dto: CreateCategoryDto) -> Result<Category, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateCategory { dto, respond_to: tx })
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

// ---------------------------------------------------------------------------
// Product Catalog Operations
// ---------------------------------------------------------------------------

fn fetch_products(conn: &Connection, filter: ProductFilter) -> Result<Vec<Product>, String> {
    let mut sql = "SELECT p.id, p.sku, p.barcode, p.name, p.description, p.category_id, c.name AS category_name,
                          p.unit, p.unit_price_minor, p.cost_price_minor, p.tax_rate_bp,
                          p.is_stock_tracked, p.current_stock_scaled, p.min_stock_threshold_scaled,
                          p.is_active, p.created_at, p.updated_at
                   FROM products p
                   LEFT JOIN categories c ON c.id = p.category_id
                   WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(active) = filter.is_active {
        sql.push_str(" AND p.is_active = ?");
        params_vec.push(Box::new(if active { 1 } else { 0 }));
    }

    if let Some(cat_id) = &filter.category_id {
        let trimmed_cat = cat_id.trim();
        if !trimmed_cat.is_empty() {
            sql.push_str(" AND p.category_id = ?");
            params_vec.push(Box::new(trimmed_cat.to_string()));
        }
    }

    if filter.low_stock_only == Some(true) {
        sql.push_str(" AND p.is_stock_tracked = 1 AND p.current_stock_scaled <= p.min_stock_threshold_scaled");
    }

    if let Some(search) = &filter.search {
        let s = search.trim();
        if !s.is_empty() {
            sql.push_str(" AND (p.barcode = ? OR p.sku LIKE ? OR p.name LIKE ?)");
            params_vec.push(Box::new(s.to_string()));
            params_vec.push(Box::new(format!("%{}%", s)));
            params_vec.push(Box::new(format!("%{}%", s)));
        }
    }

    sql.push_str(" ORDER BY p.name COLLATE NOCASE ASC;");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare products query: {}", e))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let product_rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            let is_stock_tracked_int: i64 = row.get(11)?;
            let is_active_int: i64 = row.get(14)?;
            Ok(Product {
                id: row.get(0)?,
                sku: row.get(1)?,
                barcode: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                category_id: row.get(5)?,
                category_name: row.get(6)?,
                unit: row.get(7)?,
                unit_price_minor: row.get(8)?,
                cost_price_minor: row.get(9)?,
                tax_rate_bp: row.get(10)?,
                is_stock_tracked: is_stock_tracked_int != 0,
                current_stock_scaled: row.get(12)?,
                min_stock_threshold_scaled: row.get(13)?,
                is_active: is_active_int != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for p in product_rows {
        list.push(p.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

fn create_product(conn: &mut Connection, dto: CreateProductDto) -> Result<Product, String> {
    use crate::domain::catalog::{normalize_barcode, normalize_sku};

    let sku = normalize_sku(&dto.sku).map_err(|e| e.to_string())?;
    let barcode = normalize_barcode(dto.barcode.as_deref()).map_err(|e| e.to_string())?;
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Product name cannot be empty".to_string());
    }

    if dto.unit_price_minor < 0 || dto.unit_price_minor > crate::domain::financial::MAX_SAFE_MONEY_MINOR {
        return Err("Unit selling price out of supported bounds".to_string());
    }

    let cost_price_minor = dto.cost_price_minor.unwrap_or(0);
    if cost_price_minor < 0 || cost_price_minor > crate::domain::financial::MAX_SAFE_MONEY_MINOR {
        return Err("Cost price out of supported bounds".to_string());
    }

    let tax_rate_bp = dto.tax_rate_bp.unwrap_or(0);
    if !(0..=10000).contains(&tax_rate_bp) {
        return Err("Tax rate must be between 0% and 100% (0 - 10000 basis points)".to_string());
    }

    let is_stock_tracked = dto.is_stock_tracked.unwrap_or(true);
    let opening_stock_scaled = dto.opening_stock_scaled.unwrap_or(0);
    if is_stock_tracked && opening_stock_scaled < 0 {
        return Err("Tracked inventory cannot have negative opening stock".to_string());
    }

    let min_stock_threshold_scaled = dto.min_stock_threshold_scaled.unwrap_or(0);
    if min_stock_threshold_scaled < 0 {
        return Err("Minimum stock threshold cannot be negative".to_string());
    }

    let unit = dto.unit.as_deref().unwrap_or("unit").trim().to_string();
    let unit = if unit.is_empty() { "unit".to_string() } else { unit };
    let desc = dto.description.as_deref().map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    let cat_id = dto.category_id.as_deref().map(|c| c.trim().to_string()).filter(|c| !c.is_empty());

    let id = format!("prod_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    let tx = conn.transaction().map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let res = tx.execute(
        "INSERT INTO products (
            id, sku, barcode, name, description, category_id, unit, unit_price_minor,
            cost_price_minor, tax_rate_bp, is_stock_tracked, current_stock_scaled,
            min_stock_threshold_scaled, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1, ?14, ?14);",
        params![
            id,
            sku,
            barcode,
            name,
            desc,
            cat_id,
            unit,
            dto.unit_price_minor,
            cost_price_minor,
            tax_rate_bp,
            if is_stock_tracked { 1 } else { 0 },
            opening_stock_scaled,
            min_stock_threshold_scaled,
            now,
        ],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed: products.sku") {
            return Err(format!("A product with SKU '{}' already exists (including archived). Please use a unique SKU.", sku));
        }
        if msg.contains("UNIQUE constraint failed: products.barcode") {
            return Err(format!("A product with Barcode '{}' already exists. Please use a unique Barcode.", barcode.unwrap_or_default()));
        }
        return Err(format!("Failed to insert product: {}", e));
    }

    if is_stock_tracked && opening_stock_scaled > 0 {
        let mov_id = format!("sm_{}", uuid::Uuid::new_v4().simple());
        tx.execute(
            "INSERT INTO stock_movements (
                id, product_id, reference_type, reference_id,
                quantity_delta_scaled, resulting_stock_scaled, notes, created_at
            ) VALUES (?1, ?2, 'opening', NULL, ?3, ?3, 'Opening Stock', ?4);",
            params![mov_id, id, opening_stock_scaled, now],
        )
        .map_err(|e| format!("Failed to insert opening stock movement: {}", e))?;
    }

    let category_name: Option<String> = if let Some(ref cid) = cat_id {
        tx.query_row(
            "SELECT name FROM categories WHERE id = ?1;",
            params![cid],
            |r| r.get(0),
        ).ok()
    } else {
        None
    };

    tx.commit().map_err(|e| format!("Failed to commit product creation: {}", e))?;

    Ok(Product {
        id,
        sku,
        barcode,
        name: name.to_string(),
        description: desc,
        category_id: cat_id,
        category_name,
        unit,
        unit_price_minor: dto.unit_price_minor,
        cost_price_minor,
        tax_rate_bp,
        is_stock_tracked,
        current_stock_scaled: opening_stock_scaled,
        min_stock_threshold_scaled,
        is_active: true,
        created_at: now,
        updated_at: now,
    })
}

fn update_product(conn: &mut Connection, dto: UpdateProductDto) -> Result<Product, String> {
    use crate::domain::catalog::{normalize_barcode, normalize_sku};

    let sku = normalize_sku(&dto.sku).map_err(|e| e.to_string())?;
    let barcode = normalize_barcode(dto.barcode.as_deref()).map_err(|e| e.to_string())?;
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Product name cannot be empty".to_string());
    }

    if dto.unit_price_minor < 0 || dto.unit_price_minor > crate::domain::financial::MAX_SAFE_MONEY_MINOR {
        return Err("Unit selling price out of supported bounds".to_string());
    }
    if dto.cost_price_minor < 0 || dto.cost_price_minor > crate::domain::financial::MAX_SAFE_MONEY_MINOR {
        return Err("Cost price out of supported bounds".to_string());
    }
    if !(0..=10000).contains(&dto.tax_rate_bp) {
        return Err("Tax rate must be between 0% and 100%".to_string());
    }
    if dto.min_stock_threshold_scaled < 0 {
        return Err("Minimum stock threshold cannot be negative".to_string());
    }

    let unit = dto.unit.trim();
    let unit = if unit.is_empty() { "unit" } else { unit };
    let desc = dto.description.as_deref().map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    let cat_id = dto.category_id.as_deref().map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let now = chrono::Utc::now().timestamp_millis();

    let (current_stock, is_active, created_at): (i64, bool, i64) = conn
        .query_row(
            "SELECT current_stock_scaled, is_active, created_at FROM products WHERE id = ?1;",
            params![dto.id],
            |r| {
                let active_int: i64 = r.get(1)?;
                Ok((r.get(0)?, active_int != 0, r.get(2)?))
            },
        )
        .map_err(|_| format!("Product with id '{}' not found", dto.id))?;

    if dto.is_stock_tracked && current_stock < 0 {
        return Err("Cannot enable stock tracking while product has negative stock".to_string());
    }

    let res = conn.execute(
        "UPDATE products SET
            sku = ?1,
            barcode = ?2,
            name = ?3,
            description = ?4,
            category_id = ?5,
            unit = ?6,
            unit_price_minor = ?7,
            cost_price_minor = ?8,
            tax_rate_bp = ?9,
            is_stock_tracked = ?10,
            min_stock_threshold_scaled = ?11,
            updated_at = ?12
         WHERE id = ?13;",
        params![
            sku,
            barcode,
            name,
            desc,
            cat_id,
            unit,
            dto.unit_price_minor,
            dto.cost_price_minor,
            dto.tax_rate_bp,
            if dto.is_stock_tracked { 1 } else { 0 },
            dto.min_stock_threshold_scaled,
            now,
            dto.id,
        ],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed: products.sku") {
            return Err(format!("A product with SKU '{}' already exists (including archived). Please use a unique SKU.", sku));
        }
        if msg.contains("UNIQUE constraint failed: products.barcode") {
            return Err(format!("A product with Barcode '{}' already exists. Please use a unique Barcode.", barcode.unwrap_or_default()));
        }
        return Err(format!("Failed to update product: {}", e));
    }

    let category_name: Option<String> = if let Some(ref cid) = cat_id {
        conn.query_row(
            "SELECT name FROM categories WHERE id = ?1;",
            params![cid],
            |r| r.get(0),
        ).ok()
    } else {
        None
    };

    Ok(Product {
        id: dto.id,
        sku,
        barcode,
        name: name.to_string(),
        description: desc,
        category_id: cat_id,
        category_name,
        unit: unit.to_string(),
        unit_price_minor: dto.unit_price_minor,
        cost_price_minor: dto.cost_price_minor,
        tax_rate_bp: dto.tax_rate_bp,
        is_stock_tracked: dto.is_stock_tracked,
        current_stock_scaled: current_stock,
        min_stock_threshold_scaled: dto.min_stock_threshold_scaled,
        is_active,
        created_at,
        updated_at: now,
    })
}

fn archive_product(conn: &Connection, id: &str) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let rows = conn
        .execute(
            "UPDATE products SET is_active = 0, updated_at = ?1 WHERE id = ?2;",
            params![now, id],
        )
        .map_err(|e| format!("Failed to archive product: {}", e))?;
    if rows == 0 {
        return Err(format!("Product with id '{}' not found", id));
    }
    Ok(())
}

fn restore_product(conn: &Connection, id: &str) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let rows = conn
        .execute(
            "UPDATE products SET is_active = 1, updated_at = ?1 WHERE id = ?2;",
            params![now, id],
        )
        .map_err(|e| format!("Failed to restore product: {}", e))?;
    if rows == 0 {
        return Err(format!("Product with id '{}' not found", id));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Customer Operations
// ---------------------------------------------------------------------------

fn fetch_customers(conn: &Connection, filter: CustomerFilter) -> Result<Vec<Customer>, String> {
    let mut sql = "SELECT id, name, phone, email, address_line1, address_line2, city, state, postal_code,
                          country, tax_identifier, current_balance_minor, is_active, created_at, updated_at
                   FROM customers WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(active) = filter.is_active {
        sql.push_str(" AND is_active = ?");
        params_vec.push(Box::new(if active { 1 } else { 0 }));
    }

    if let Some(search) = &filter.search {
        let s = search.trim();
        if !s.is_empty() {
            sql.push_str(" AND (name LIKE ? OR phone LIKE ? OR tax_identifier LIKE ?)");
            params_vec.push(Box::new(format!("%{}%", s)));
            params_vec.push(Box::new(format!("%{}%", s)));
            params_vec.push(Box::new(format!("%{}%", s)));
        }
    }

    sql.push_str(" ORDER BY name COLLATE NOCASE ASC;");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare customers query: {}", e))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |r| {
            let is_active_int: i64 = r.get(12)?;
            Ok(Customer {
                id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                email: r.get(3)?,
                address_line1: r.get(4)?,
                address_line2: r.get(5)?,
                city: r.get(6)?,
                state: r.get(7)?,
                postal_code: r.get(8)?,
                country: r.get(9)?,
                tax_identifier: r.get(10)?,
                current_balance_minor: r.get(11)?,
                is_active: is_active_int != 0,
                created_at: r.get(13)?,
                updated_at: r.get(14)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for c in rows {
        list.push(c.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

fn create_customer(conn: &mut Connection, dto: CreateCustomerDto) -> Result<Customer, String> {
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Customer name cannot be empty".to_string());
    }

    let phone = dto.phone.as_deref().map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let email = dto.email.as_deref().map(|e| e.trim().to_string()).filter(|e| !e.is_empty());
    let addr1 = dto.address_line1.as_deref().map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
    let addr2 = dto.address_line2.as_deref().map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
    let city = dto.city.as_deref().map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let state = dto.state.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let postal = dto.postal_code.as_deref().map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let country = dto
        .country
        .as_deref()
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "India".to_string());
    let tax_id = dto.tax_identifier.as_deref().map(|t| t.trim().to_string()).filter(|t| !t.is_empty());

    let id = format!("cust_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO customers (
            id, name, phone, email, address_line1, address_line2, city, state, postal_code,
            country, tax_identifier, current_balance_minor, is_active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, 1, ?12, ?12);",
        params![
            id, name, phone, email, addr1, addr2, city, state, postal, country, tax_id, now
        ],
    )
    .map_err(|e| format!("Failed to create customer: {}", e))?;

    Ok(Customer {
        id,
        name: name.to_string(),
        phone,
        email,
        address_line1: addr1,
        address_line2: addr2,
        city,
        state,
        postal_code: postal,
        country,
        tax_identifier: tax_id,
        current_balance_minor: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
    })
}

fn update_customer(conn: &mut Connection, dto: UpdateCustomerDto) -> Result<Customer, String> {
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Customer name cannot be empty".to_string());
    }

    let phone = dto.phone.as_deref().map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let email = dto.email.as_deref().map(|e| e.trim().to_string()).filter(|e| !e.is_empty());
    let addr1 = dto.address_line1.as_deref().map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
    let addr2 = dto.address_line2.as_deref().map(|a| a.trim().to_string()).filter(|a| !a.is_empty());
    let city = dto.city.as_deref().map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let state = dto.state.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let postal = dto.postal_code.as_deref().map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let country = if dto.country.trim().is_empty() {
        "India".to_string()
    } else {
        dto.country.trim().to_string()
    };
    let tax_id = dto.tax_identifier.as_deref().map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
    let now = chrono::Utc::now().timestamp_millis();

    let (current_balance, is_active, created_at): (i64, bool, i64) = conn
        .query_row(
            "SELECT current_balance_minor, is_active, created_at FROM customers WHERE id = ?1;",
            params![dto.id],
            |r| {
                let active_int: i64 = r.get(1)?;
                Ok((r.get(0)?, active_int != 0, r.get(2)?))
            },
        )
        .map_err(|_| format!("Customer with id '{}' not found", dto.id))?;

    conn.execute(
        "UPDATE customers SET
            name = ?1, phone = ?2, email = ?3, address_line1 = ?4, address_line2 = ?5,
            city = ?6, state = ?7, postal_code = ?8, country = ?9, tax_identifier = ?10,
            updated_at = ?11
         WHERE id = ?12;",
        params![
            name, phone, email, addr1, addr2, city, state, postal, country, tax_id, now, dto.id
        ],
    )
    .map_err(|e| format!("Failed to update customer: {}", e))?;

    Ok(Customer {
        id: dto.id,
        name: name.to_string(),
        phone,
        email,
        address_line1: addr1,
        address_line2: addr2,
        city,
        state,
        postal_code: postal,
        country,
        tax_identifier: tax_id,
        current_balance_minor: current_balance,
        is_active,
        created_at,
        updated_at: now,
    })
}

fn archive_customer(conn: &Connection, id: &str) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let rows = conn
        .execute(
            "UPDATE customers SET is_active = 0, updated_at = ?1 WHERE id = ?2;",
            params![now, id],
        )
        .map_err(|e| format!("Failed to archive customer: {}", e))?;
    if rows == 0 {
        return Err(format!("Customer with id '{}' not found", id));
    }
    Ok(())
}

fn restore_customer(conn: &Connection, id: &str) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let rows = conn
        .execute(
            "UPDATE customers SET is_active = 1, updated_at = ?1 WHERE id = ?2;",
            params![now, id],
        )
        .map_err(|e| format!("Failed to restore customer: {}", e))?;
    if rows == 0 {
        return Err(format!("Customer with id '{}' not found", id));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Category Operations
// ---------------------------------------------------------------------------

fn fetch_categories(conn: &Connection) -> Result<Vec<Category>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name COLLATE NOCASE ASC;")
        .map_err(|e| format!("Query prepare error: {}", e))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                created_at: r.get(3)?,
                updated_at: r.get(4)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for c in rows {
        list.push(c.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

fn create_category(conn: &Connection, dto: CreateCategoryDto) -> Result<Category, String> {
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Category name cannot be empty".to_string());
    }
    let desc = dto.description.as_deref().map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    let id = format!("cat_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    let res = conn.execute(
        "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4);",
        params![id, name, desc, now],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed: categories.name") {
            return Err(format!("A category with name '{}' already exists.", name));
        }
        return Err(format!("Failed to insert category: {}", e));
    }

    Ok(Category {
        id,
        name: name.to_string(),
        description: desc,
        created_at: now,
        updated_at: now,
    })
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

    #[test]
    fn test_product_creation_atomic_opening_stock_and_duplicate_sku_rejection() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("catalog_product_test.db");
        let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should start");

        // 1. Create a product with opening stock of 25.500 units (scaled: 25500)
        let create_dto = CreateProductDto {
            sku: "prod-sku-001".to_string(),
            barcode: Some(" 0012345678905 ".to_string()),
            name: "Premium Basmati Rice 5kg".to_string(),
            description: Some("Long grain aromatic rice".to_string()),
            category_id: None,
            unit: Some("bag".to_string()),
            unit_price_minor: 45000, // 450.00
            cost_price_minor: Some(38000), // 380.00
            tax_rate_bp: Some(500), // 5%
            is_stock_tracked: Some(true),
            opening_stock_scaled: Some(25500), // 25.500
            min_stock_threshold_scaled: Some(5000), // 5.000
        };

        let created = rt
            .block_on(worker.create_product(create_dto))
            .expect("Product creation should succeed");

        assert_eq!(created.sku, "PROD-SKU-001"); // SKU normalized to uppercase
        assert_eq!(created.barcode.as_deref(), Some("0012345678905")); // Leading zeros preserved
        assert_eq!(created.current_stock_scaled, 25500);
        assert_eq!(created.unit_price_minor, 45000);
        assert_eq!(created.cost_price_minor, 38000);
        assert_eq!(created.tax_rate_bp, 500);

        // Verify opening stock movement was inserted atomically
        {
            let conn = Connection::open(&db_path).unwrap();
            let (ref_type, delta, resulting): (String, i64, i64) = conn
                .query_row(
                    "SELECT reference_type, quantity_delta_scaled, resulting_stock_scaled FROM stock_movements WHERE product_id = ?1;",
                    params![created.id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .expect("Opening stock movement must exist");
            assert_eq!(ref_type, "opening");
            assert_eq!(delta, 25500);
            assert_eq!(resulting, 25500);
        }

        // 2. Reject duplicate SKU (case insensitive)
        let dup_sku_dto = CreateProductDto {
            sku: "Prod-Sku-001".to_string(),
            barcode: Some("999999999999".to_string()),
            name: "Duplicate SKU Product".to_string(),
            description: None,
            category_id: None,
            unit: None,
            unit_price_minor: 1000,
            cost_price_minor: None,
            tax_rate_bp: None,
            is_stock_tracked: None,
            opening_stock_scaled: None,
            min_stock_threshold_scaled: None,
        };
        let err_sku = rt
            .block_on(worker.create_product(dup_sku_dto))
            .expect_err("Duplicate SKU must be rejected");
        assert!(err_sku.contains("already exists"), "Must report SKU uniqueness violation: {}", err_sku);

        // 3. Reject duplicate barcode
        let dup_barcode_dto = CreateProductDto {
            sku: "UNIQUE-SKU-002".to_string(),
            barcode: Some("0012345678905".to_string()),
            name: "Duplicate Barcode Product".to_string(),
            description: None,
            category_id: None,
            unit: None,
            unit_price_minor: 1000,
            cost_price_minor: None,
            tax_rate_bp: None,
            is_stock_tracked: None,
            opening_stock_scaled: None,
            min_stock_threshold_scaled: None,
        };
        let err_bc = rt
            .block_on(worker.create_product(dup_barcode_dto))
            .expect_err("Duplicate Barcode must be rejected");
        assert!(err_bc.contains("already exists"), "Must report Barcode uniqueness violation: {}", err_bc);

        // 4. Update product: verify current_stock_scaled remains UNTOUCHED
        let update_dto = UpdateProductDto {
            id: created.id.clone(),
            sku: "PROD-SKU-001-RENAMED".to_string(),
            barcode: Some("0012345678905".to_string()),
            name: "Premium Basmati Rice 5kg (Updated)".to_string(),
            description: Some("New description".to_string()),
            category_id: None,
            unit: "bag".to_string(),
            unit_price_minor: 48000,
            cost_price_minor: 40000,
            tax_rate_bp: 500,
            is_stock_tracked: true,
            min_stock_threshold_scaled: 6000,
        };
        let updated = rt
            .block_on(worker.update_product(update_dto))
            .expect("Product update should succeed");
        assert_eq!(updated.name, "Premium Basmati Rice 5kg (Updated)");
        assert_eq!(updated.current_stock_scaled, 25500); // Intact!

        // 5. Archive and Restore
        rt.block_on(worker.archive_product(created.id.clone())).expect("Archive should succeed");
        let active_filter = ProductFilter { is_active: Some(true), ..Default::default() };
        let active_list = rt.block_on(worker.get_products(active_filter)).expect("fetch products");
        assert!(!active_list.iter().any(|p| p.id == created.id));

        rt.block_on(worker.restore_product(created.id.clone())).expect("Restore should succeed");
        let restored_list = rt.block_on(worker.get_products(ProductFilter { is_active: Some(true), ..Default::default() })).expect("fetch products");
        assert!(restored_list.iter().any(|p| p.id == created.id));
    }

    #[test]
    fn test_customer_create_update_archive_and_search() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("catalog_customer_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // 1. Create Customer
        let create_dto = CreateCustomerDto {
            name: "Hassan Al-Nuaimi".to_string(),
            phone: Some("+971 50 123 4567".to_string()),
            email: Some("hassan@example.ae".to_string()),
            address_line1: Some("Sheikh Zayed Road".to_string()),
            address_line2: Some("Suite 401".to_string()),
            city: Some("Dubai".to_string()),
            state: Some("Dubai".to_string()),
            postal_code: Some("00000".to_string()),
            country: Some("United Arab Emirates".to_string()),
            tax_identifier: Some("100200300400003".to_string()),
        };

        let cust = rt
            .block_on(worker.create_customer(create_dto))
            .expect("Customer creation should succeed");

        assert_eq!(cust.name, "Hassan Al-Nuaimi");
        assert_eq!(cust.phone.as_deref(), Some("+971 50 123 4567"));
        assert_eq!(cust.country, "United Arab Emirates");
        assert_eq!(cust.address_line2.as_deref(), Some("Suite 401"));

        // 2. Search customer by query
        let search_filter = CustomerFilter {
            search: Some("Nuaimi".to_string()),
            is_active: Some(true),
        };
        let matches = rt.block_on(worker.get_customers(search_filter)).expect("Search should succeed");
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].id, cust.id);

        // 3. Update customer
        let update_dto = UpdateCustomerDto {
            id: cust.id.clone(),
            name: "Hassan Al-Nuaimi (Al-Barsha)".to_string(),
            phone: Some("+971 50 123 4567".to_string()),
            email: Some("hassan.vip@example.ae".to_string()),
            address_line1: Some("Al Barsha 1".to_string()),
            address_line2: Some("Villa 12".to_string()),
            city: Some("Dubai".to_string()),
            state: Some("Dubai".to_string()),
            postal_code: None,
            country: "United Arab Emirates".to_string(),
            tax_identifier: Some("100200300400003".to_string()),
        };
        let updated = rt.block_on(worker.update_customer(update_dto)).expect("Update should succeed");
        assert_eq!(updated.name, "Hassan Al-Nuaimi (Al-Barsha)");
        assert_eq!(updated.address_line1.as_deref(), Some("Al Barsha 1"));

        // 4. Archive customer
        rt.block_on(worker.archive_customer(cust.id.clone())).expect("Archive customer should succeed");
        let active_customers = rt.block_on(worker.get_customers(CustomerFilter { is_active: Some(true), search: None })).unwrap();
        assert!(!active_customers.iter().any(|c| c.id == cust.id));
    }

    #[test]
    fn test_category_create_and_unique_constraint() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("category_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        let c1 = rt.block_on(worker.create_category(CreateCategoryDto {
            name: "Groceries".to_string(),
            description: Some("Daily supermarket essentials".to_string()),
        })).expect("create category");
        assert_eq!(c1.name, "Groceries");

        let err = rt.block_on(worker.create_category(CreateCategoryDto {
            name: "Groceries".to_string(),
            description: None,
        })).expect_err("duplicate category name must be rejected");
        assert!(err.contains("already exists"), "Expected uniqueness error: {}", err);

        let list = rt.block_on(worker.get_categories()).expect("get categories");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, c1.id);
    }
}

