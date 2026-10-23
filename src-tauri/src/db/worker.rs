use crate::db::initialize_database;
use crate::domain::catalog::{
    Category, CreateCategoryDto, CreateCustomerDto, CreateProductDto, Customer, CustomerFilter,
    Product, ProductFilter, UpdateCustomerDto, UpdateProductDto,
};
use crate::domain::models::{BusinessProfileDto, BusinessSettings};
use crate::domain::cashbook::*;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tokio::sync::{mpsc, oneshot};

pub enum DbRequest {
    PrepareUpdate { respond_to: oneshot::Sender<Result<PathBuf, String>> },
    ResumeAfterUpdate { respond_to: oneshot::Sender<Result<(), String>> },
    GetBusinessSettings {
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    UpdateBusinessSettings {
        settings: BusinessSettings,
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    UpdateBusinessProfile {
        profile: BusinessProfileDto,
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    CompleteBusinessSetup {
        profile: BusinessProfileDto,
        respond_to: oneshot::Sender<Result<BusinessSettings, String>>,
    },
    UpdateAppearancePreference {
        preference: String,
        respond_to: oneshot::Sender<Result<String, String>>,
    },
    UpdateGuideStatus {
        status: String,
        version: i32,
        respond_to: oneshot::Sender<Result<String, String>>,
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

    // Cashbook
    GetMoneyAccounts {
        respond_to: oneshot::Sender<Result<Vec<MoneyAccount>, String>>,
    },
    CreateMoneyAccount {
        dto: CreateMoneyAccountDto,
        respond_to: oneshot::Sender<Result<MoneyAccount, String>>,
    },
    UpdateMoneyAccount {
        dto: UpdateMoneyAccountDto,
        respond_to: oneshot::Sender<Result<MoneyAccount, String>>,
    },
    GetCashbookCategories {
        respond_to: oneshot::Sender<Result<Vec<CashbookCategory>, String>>,
    },
    CreateCashbookCategory {
        dto: CreateCashbookCategoryDto,
        respond_to: oneshot::Sender<Result<CashbookCategory, String>>,
    },
    GetCashbookParties {
        respond_to: oneshot::Sender<Result<Vec<CashbookParty>, String>>,
    },
    CreateCashbookParty {
        dto: CreateCashbookPartyDto,
        respond_to: oneshot::Sender<Result<CashbookParty, String>>,
    },
    EnsureCustomerCashbookParty {
        input: EnsureCustomerCashbookPartyInput,
        respond_to: oneshot::Sender<Result<CashbookParty, String>>,
    },
    GetCustomerCashHistory {
        filter: CustomerCashHistoryFilter,
        respond_to: oneshot::Sender<Result<CustomerCashHistory, String>>,
    },
    PostCashbookVoucher {
        input: CreateVoucherInput,
        respond_to: oneshot::Sender<Result<PostVoucherResult, String>>,
    },
    ReverseCashbookVoucher {
        voucher_id: String,
        confirmed_negative_balance: bool,
        respond_to: oneshot::Sender<Result<PostVoucherResult, String>>,
    },
    GetCashbookLedger {
        filter: CashbookLedgerFilter,
        respond_to: oneshot::Sender<Result<(Vec<CashbookLedgerEntry>, CashbookSummary), String>>,
    },
    ExportWorkspaceBackup {
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    RestoreWorkspaceBackup {
        backup_json: serde_json::Value,
        respond_to: oneshot::Sender<Result<crate::db::backup::RestoreBackupResult, String>>,
    },
}

impl DbRequest {
    fn reject_during_update(self) {
        match self {
            Self::PrepareUpdate { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::ResumeAfterUpdate { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetBusinessSettings { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateBusinessSettings { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateBusinessProfile { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CompleteBusinessSetup { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateAppearancePreference { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateGuideStatus { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetProducts { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateProduct { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateProduct { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::ArchiveProduct { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::RestoreProduct { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCustomers { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateCustomer { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateCustomer { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::ArchiveCustomer { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::RestoreCustomer { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCategories { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateCategory { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::Ping { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetMoneyAccounts { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateMoneyAccount { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::UpdateMoneyAccount { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCashbookCategories { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateCashbookCategory { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCashbookParties { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::EnsureCustomerCashbookParty { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCustomerCashHistory { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::CreateCashbookParty { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::PostCashbookVoucher { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::ReverseCashbookVoucher { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::GetCashbookLedger { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::ExportWorkspaceBackup { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
            Self::RestoreWorkspaceBackup { respond_to, .. } => { let _ = respond_to.send(Err("An update is being installed. Return from the installer to continue.".into())); },
        }
    }
}

#[derive(Clone)]
pub struct DbWorkerHandle {
    sender: mpsc::Sender<DbRequest>,
}

impl DbWorkerHandle {
    pub async fn prepare_update(&self) -> Result<PathBuf, String> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(DbRequest::PrepareUpdate { respond_to: tx }).await.map_err(|_|"Database worker terminated")?;
        rx.await.map_err(|_|"Database worker did not respond")?
    }
    pub async fn resume_after_update(&self) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(DbRequest::ResumeAfterUpdate { respond_to: tx }).await.map_err(|_|"Database worker terminated")?;
        rx.await.map_err(|_|"Database worker did not respond")?
    }

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

                let mut update_paused = false;
                while let Some(request) = rx.blocking_recv() {
                    if update_paused && !matches!(&request, DbRequest::ResumeAfterUpdate { .. }) {
                        request.reject_during_update();
                        continue;
                    }
                    match request {
                        DbRequest::PrepareUpdate { respond_to } => {
                            let directory = db_path.parent().unwrap_or_else(|| std::path::Path::new(".")).join("recovery");
                            let result = crate::db::recovery::snapshot(&conn, &directory, "before-app-update").map_err(|e|e.to_string());
                            if result.is_ok() { update_paused = true; }
                            let _ = respond_to.send(result);
                        }
                        DbRequest::ResumeAfterUpdate { respond_to } => {
                            update_paused = false;
                            let _ = respond_to.send(Ok(()));
                        }
                        DbRequest::GetBusinessSettings { respond_to } => {
                            let result = fetch_business_settings(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateBusinessSettings { settings, respond_to } => {
                            let result = save_business_settings(&mut conn, settings);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateBusinessProfile { profile, respond_to } => {
                            let result = save_business_profile(&mut conn, profile);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CompleteBusinessSetup { profile, respond_to } => {
                            let result = complete_business_setup(&mut conn, profile);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateAppearancePreference { preference, respond_to } => {

                            let result = update_appearance_preference(&conn, &preference);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateGuideStatus { status, version, respond_to } => {
                            let result = update_guide_status(&conn, &status, version);
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
                        DbRequest::GetMoneyAccounts { respond_to } => {
                            let result = fetch_money_accounts(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CreateMoneyAccount { dto, respond_to } => {
                            let result = create_money_account(&conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::UpdateMoneyAccount { dto, respond_to } => {
                            let result = update_money_account(&conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::GetCashbookCategories { respond_to } => {
                            let result = fetch_cashbook_categories(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::CreateCashbookCategory { dto, respond_to } => {
                            let result = create_cashbook_category(&conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::GetCashbookParties { respond_to } => {
                            let result = fetch_cashbook_parties(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::EnsureCustomerCashbookParty { input, respond_to } => {
                            let _ = respond_to.send(ensure_customer_cashbook_party(&mut conn, input));
                        }
                        DbRequest::GetCustomerCashHistory { filter, respond_to } => {
                            let _ = respond_to.send(fetch_customer_cash_history(&conn, filter));
                        }
                        DbRequest::CreateCashbookParty { dto, respond_to } => {
                            let result = create_cashbook_party(&conn, dto);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::PostCashbookVoucher { input, respond_to } => {
                            let result = post_cashbook_voucher(&mut conn, input);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::ReverseCashbookVoucher { voucher_id, confirmed_negative_balance, respond_to } => {
                            let result = reverse_cashbook_voucher(&mut conn, voucher_id, confirmed_negative_balance);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::GetCashbookLedger { filter, respond_to } => {
                            let result = fetch_cashbook_ledger(&conn, filter);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::ExportWorkspaceBackup { respond_to } => {
                            let result = crate::db::backup::create_workspace_backup(&conn);
                            let _ = respond_to.send(result);
                        }
                        DbRequest::RestoreWorkspaceBackup { backup_json, respond_to } => {
                            // Checkpoint current active database
                            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
                            drop(conn);

                            let restore_res = crate::db::backup::restore_workspace_backup(&db_path, &backup_json);

                            // Reopen active connection to db_path
                            match initialize_database(&db_path) {
                                Ok(reopened) => {
                                    conn = reopened;
                                    let _ = respond_to.send(restore_res);
                                }
                                Err(e) => {
                                    let err = format!("FATAL: Failed to reopen database after restore attempt: {}", e);
                                    eprintln!("[BillZen DbWorker] {}", err);
                                    let _ = respond_to.send(Err(err));
                                    return;
                                }
                            }
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

    pub async fn update_business_profile(
        &self,
        profile: BusinessProfileDto,
    ) -> Result<BusinessSettings, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateBusinessProfile {
                profile,
                respond_to: tx,
            })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn complete_business_setup(
        &self,
        profile: BusinessProfileDto,
    ) -> Result<BusinessSettings, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CompleteBusinessSetup {
                profile,
                respond_to: tx,
            })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }


    pub async fn update_appearance_preference(&self, preference: String) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateAppearancePreference {
                preference,
                respond_to: tx,
            })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn update_guide_status(&self, status: String, version: i32) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateGuideStatus {
                status,
                version,
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

    pub async fn get_money_accounts(&self) -> Result<Vec<MoneyAccount>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetMoneyAccounts { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_money_account(&self, dto: CreateMoneyAccountDto) -> Result<MoneyAccount, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateMoneyAccount { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn update_money_account(&self, dto: UpdateMoneyAccountDto) -> Result<MoneyAccount, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::UpdateMoneyAccount { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn get_cashbook_categories(&self) -> Result<Vec<CashbookCategory>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetCashbookCategories { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_cashbook_category(&self, dto: CreateCashbookCategoryDto) -> Result<CashbookCategory, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateCashbookCategory { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn ensure_customer_cashbook_party(&self, input: EnsureCustomerCashbookPartyInput) -> Result<CashbookParty, String> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(DbRequest::EnsureCustomerCashbookParty { input, respond_to: tx }).await.map_err(|_| "Database worker unavailable".to_string())?;
        rx.await.map_err(|_| "Database worker response dropped".to_string())?
    }

    pub async fn get_customer_cash_history(&self, filter: CustomerCashHistoryFilter) -> Result<CustomerCashHistory, String> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(DbRequest::GetCustomerCashHistory { filter, respond_to: tx }).await.map_err(|_| "Database worker unavailable".to_string())?;
        rx.await.map_err(|_| "Database worker response dropped".to_string())?
    }

    pub async fn get_cashbook_parties(&self) -> Result<Vec<CashbookParty>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetCashbookParties { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn create_cashbook_party(&self, dto: CreateCashbookPartyDto) -> Result<CashbookParty, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::CreateCashbookParty { dto, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn post_cashbook_voucher(&self, input: CreateVoucherInput) -> Result<PostVoucherResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::PostCashbookVoucher { input, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn reverse_cashbook_voucher(&self, voucher_id: String, confirmed_negative_balance: bool) -> Result<PostVoucherResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::ReverseCashbookVoucher { voucher_id, confirmed_negative_balance, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn get_cashbook_ledger(&self, filter: CashbookLedgerFilter) -> Result<(Vec<CashbookLedgerEntry>, CashbookSummary), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::GetCashbookLedger { filter, respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn export_workspace_backup(&self) -> Result<serde_json::Value, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::ExportWorkspaceBackup { respond_to: tx })
            .await
            .map_err(|_| "Database worker thread has terminated".to_string())?;
        rx.await
            .map_err(|_| "Database worker failed to respond".to_string())?
    }

    pub async fn restore_workspace_backup(&self, backup_json: serde_json::Value) -> Result<crate::db::backup::RestoreBackupResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(DbRequest::RestoreWorkspaceBackup { backup_json, respond_to: tx })
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
                timezone, invoice_prefix, terms_and_conditions,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
            ) VALUES (
                'default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22,
                ?23, ?24
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
                if default_settings.is_setup_completed { 1 } else { 0 },
                default_settings.appearance_preference,
                default_settings.guide_status,
                default_settings.guide_version,
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
                timezone, invoice_prefix, terms_and_conditions,
                is_setup_completed, appearance_preference, guide_status, guide_version,
                created_at, updated_at
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
                is_setup_completed: row.get::<_, i32>(19)? != 0,
                appearance_preference: row.get(20)?,
                guide_status: row.get(21)?,
                guide_version: row.get(22)?,
                created_at: row.get(23)?,
                updated_at: row.get(24)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read business settings: {}", e))
}

fn save_business_profile(
    conn: &mut Connection,
    profile: BusinessProfileDto,
) -> Result<BusinessSettings, String> {
    // 1. Validate currency code and exponent in Rust domain
    crate::domain::currency::validate_currency(&profile.currency_code, profile.currency_exponent)?;

    // 2. Prevent unsafe base currency changes if existing financial/catalog records exist
    let current = fetch_business_settings(conn)?;
    if current.currency_code != profile.currency_code
        || current.currency_exponent != profile.currency_exponent
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

        let has_posted_vouchers: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM cashbook_vouchers WHERE status = 'posted' LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check cashbook vouchers: {}", e))?;

        let has_nonzero_accounts: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM money_accounts WHERE opening_balance_minor != 0 LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check non-zero money accounts: {}", e))?;

        let has_movements: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM cashbook_movements LIMIT 1);",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to check cashbook movements: {}", e))?;

        if has_products || has_invoices || has_payments || has_expenses || has_posted_vouchers || has_nonzero_accounts || has_movements {
            return Err("Cannot change base currency after catalog products, invoices, payments, or expenses exist, or posted cashbook vouchers, non-zero accounts, or movements exist in the system. Changing currency would silently corrupt historical ledger values.".to_string());
        }
    }

    let updated_at = chrono::Utc::now().timestamp_millis();

    // Preserve independently-owned is_setup_completed, appearance_preference, guide_status, guide_version
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
            profile.business_name,
            profile.legal_name,
            profile.tax_identifier,
            profile.phone,
            profile.email,
            profile.address_line1,
            profile.address_line2,
            profile.city,
            profile.state,
            profile.postal_code,
            profile.country,
            profile.currency_code,
            profile.currency_symbol,
            profile.currency_exponent,
            profile.locale,
            profile.timezone,
            profile.invoice_prefix,
            profile.terms_and_conditions,
            updated_at,
        ],
    )
    .map_err(|e| format!("Failed to update business profile: {}", e))?;

    // Synchronize empty money accounts (0 opening balance and no movements) to match new currency
    conn.execute(
        "UPDATE money_accounts
         SET currency_code = ?1, currency_exponent = ?2, updated_at = ?3
         WHERE opening_balance_minor = 0
           AND NOT EXISTS (SELECT 1 FROM cashbook_movements WHERE account_id = money_accounts.id);",
        params![profile.currency_code, profile.currency_exponent, updated_at],
    )
    .map_err(|e| format!("Failed to sync currency to empty money accounts: {}", e))?;

    fetch_business_settings(conn)
}

fn complete_business_setup(
    conn: &mut Connection,
    profile: BusinessProfileDto,
) -> Result<BusinessSettings, String> {
    crate::domain::currency::validate_currency(&profile.currency_code, profile.currency_exponent)?;

    let updated_at = chrono::Utc::now().timestamp_millis();

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
            is_setup_completed = 1,
            updated_at = ?19
         WHERE id = 'default';",
        params![
            profile.business_name,
            profile.legal_name,
            profile.tax_identifier,
            profile.phone,
            profile.email,
            profile.address_line1,
            profile.address_line2,
            profile.city,
            profile.state,
            profile.postal_code,
            profile.country,
            profile.currency_code,
            profile.currency_symbol,
            profile.currency_exponent,
            profile.locale,
            profile.timezone,
            profile.invoice_prefix,
            profile.terms_and_conditions,
            updated_at,
        ],
    )
    .map_err(|e| format!("Failed to complete business setup: {}", e))?;

    // Synchronize empty money accounts (0 opening balance and no movements) to match setup currency
    conn.execute(
        "UPDATE money_accounts
         SET currency_code = ?1, currency_exponent = ?2, updated_at = ?3
         WHERE opening_balance_minor = 0
           AND NOT EXISTS (SELECT 1 FROM cashbook_movements WHERE account_id = money_accounts.id);",
        params![profile.currency_code, profile.currency_exponent, updated_at],
    )
    .map_err(|e| format!("Failed to sync currency to empty money accounts: {}", e))?;

    fetch_business_settings(conn)
}

fn save_business_settings(
    conn: &mut Connection,
    settings: BusinessSettings,
) -> Result<BusinessSettings, String> {
    let profile = BusinessProfileDto {
        business_name: settings.business_name,
        legal_name: settings.legal_name,
        tax_identifier: settings.tax_identifier,
        phone: settings.phone,
        email: settings.email,
        address_line1: settings.address_line1,
        address_line2: settings.address_line2,
        city: settings.city,
        state: settings.state,
        postal_code: settings.postal_code,
        country: settings.country,
        currency_code: settings.currency_code,
        currency_symbol: settings.currency_symbol,
        currency_exponent: settings.currency_exponent,
        locale: settings.locale,
        timezone: settings.timezone,
        invoice_prefix: settings.invoice_prefix,
        terms_and_conditions: settings.terms_and_conditions,
    };
    save_business_profile(conn, profile)
}


fn update_appearance_preference(conn: &Connection, preference: &str) -> Result<String, String> {
    let pref = match preference {
        "system" | "light" | "dark" => preference,
        _ => return Err(format!("Invalid appearance preference: '{}'. Must be system, light, or dark", preference)),
    };
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE business_settings SET appearance_preference = ?1, updated_at = ?2 WHERE id = 'default';",
        params![pref, now],
    )
    .map_err(|e| format!("Failed to update appearance preference: {}", e))?;
    Ok(pref.to_string())
}

fn update_guide_status(conn: &Connection, status: &str, version: i32) -> Result<String, String> {
    let stat = match status {
        "unseen" | "completed" | "skipped" => status,
        _ => return Err(format!("Invalid guide status: '{}'. Must be unseen, completed, or skipped", status)),
    };
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE business_settings SET guide_status = ?1, guide_version = ?2, updated_at = ?3 WHERE id = 'default';",
        params![stat, version, now],
    )
    .map_err(|e| format!("Failed to update guide status: {}", e))?;
    Ok(stat.to_string())
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

    if dto.unit_price_minor < 0 || dto.unit_price_minor > crate::domain::financial::MAX_MONEY_MINOR {
        return Err("Unit selling price out of supported bounds".to_string());
    }

    let cost_price_minor = dto.cost_price_minor.unwrap_or(0);
    if cost_price_minor < 0 || cost_price_minor > crate::domain::financial::MAX_MONEY_MINOR {
        return Err("Cost price out of supported bounds".to_string());
    }

    let tax_rate_bp = dto.tax_rate_bp.unwrap_or(0);
    if !(0..=10000).contains(&tax_rate_bp) {
        return Err("Tax rate must be between 0% and 100% (0 - 10000 basis points)".to_string());
    }

    let is_stock_tracked = dto.is_stock_tracked.unwrap_or(true);
    let opening_stock_scaled = dto.opening_stock_scaled.unwrap_or(0);
    if !is_stock_tracked {
        if opening_stock_scaled != 0 {
            return Err("Untracked products cannot have opening stock".to_string());
        }
    } else {
        if opening_stock_scaled < 0 {
            return Err("Tracked inventory cannot have negative opening stock".to_string());
        }
        if opening_stock_scaled > crate::domain::financial::MAX_QUANTITY_SCALED {
            return Err("Opening stock exceeds maximum supported quantity".to_string());
        }
    }

    let initial_stock_scaled = if is_stock_tracked { opening_stock_scaled } else { 0 };

    let min_stock_threshold_scaled = dto.min_stock_threshold_scaled.unwrap_or(0);
    if min_stock_threshold_scaled < 0 {
        return Err("Minimum stock threshold cannot be negative".to_string());
    }
    if min_stock_threshold_scaled > crate::domain::financial::MAX_QUANTITY_SCALED {
        return Err("Minimum stock threshold exceeds maximum supported quantity".to_string());
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
            initial_stock_scaled,
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

    if is_stock_tracked && initial_stock_scaled > 0 {
        let mov_id = format!("sm_{}", uuid::Uuid::new_v4().simple());
        tx.execute(
            "INSERT INTO stock_movements (
                id, product_id, reference_type, reference_id,
                quantity_delta_scaled, resulting_stock_scaled, notes, created_at
            ) VALUES (?1, ?2, 'opening', NULL, ?3, ?3, 'Opening Stock', ?4);",
            params![mov_id, id, initial_stock_scaled, now],
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
        current_stock_scaled: initial_stock_scaled,
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

    if dto.unit_price_minor < 0 || dto.unit_price_minor > crate::domain::financial::MAX_MONEY_MINOR {
        return Err("Unit selling price out of supported bounds".to_string());
    }
    if dto.cost_price_minor < 0 || dto.cost_price_minor > crate::domain::financial::MAX_MONEY_MINOR {
        return Err("Cost price out of supported bounds".to_string());
    }
    if !(0..=10000).contains(&dto.tax_rate_bp) {
        return Err("Tax rate must be between 0% and 100%".to_string());
    }
    if dto.min_stock_threshold_scaled < 0 {
        return Err("Minimum stock threshold cannot be negative".to_string());
    }
    if dto.min_stock_threshold_scaled > crate::domain::financial::MAX_QUANTITY_SCALED {
        return Err("Minimum stock threshold exceeds maximum supported quantity".to_string());
    }

    let unit = dto.unit.trim();
    let unit = if unit.is_empty() { "unit" } else { unit };
    let desc = dto.description.as_deref().map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    let cat_id = dto.category_id.as_deref().map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let now = chrono::Utc::now().timestamp_millis();

    let (current_stock, was_tracked, is_active, created_at): (i64, bool, bool, i64) = conn
        .query_row(
            "SELECT current_stock_scaled, is_stock_tracked, is_active, created_at FROM products WHERE id = ?1;",
            params![dto.id],
            |r| {
                let tracked_int: i64 = r.get(1)?;
                let active_int: i64 = r.get(2)?;
                Ok((r.get(0)?, tracked_int != 0, active_int != 0, r.get(3)?))
            },
        )
        .map_err(|_| format!("Product with id '{}' not found", dto.id))?;

    if !was_tracked && dto.is_stock_tracked {
        let ledger_sum: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(quantity_delta_scaled), 0) FROM stock_movements WHERE product_id = ?1;",
                params![dto.id],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to verify ledger: {}", e))?;

        if current_stock != ledger_sum {
            return Err(format!(
                "Cannot enable stock tracking: product stock balance ({}) diverges from ledger sum ({})",
                current_stock, ledger_sum
            ));
        }
    }

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

    let tx = conn.transaction().map_err(|e|e.to_string())?;
    tx.execute(
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

    sync_customer_party_projection(&tx, &dto.id)?;
    tx.commit().map_err(|e|e.to_string())?;

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

    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM categories WHERE name COLLATE NOCASE = ?1);",
            params![name],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if exists {
        return Err(format!("A category with name '{}' already exists.", name));
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
        if msg.contains("UNIQUE constraint failed") {
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

// ---------------------------------------------------------------------------
// Cashbook Operations
// ---------------------------------------------------------------------------

fn row_to_voucher(r: &rusqlite::Row) -> Result<CashbookVoucher, rusqlite::Error> {
    let dir_str: String = r.get(7)?;
    let class_str: String = r.get(8)?;
    let pay_method_str: String = r.get(9)?;
    let status_str: String = r.get(12)?;

    let direction = MovementDirection::from_str(&dir_str).unwrap_or(MovementDirection::Inflow);
    let classification = CashbookClassification::from_str(&class_str).unwrap_or(CashbookClassification::OperatingIncome);
    let payment_method = PaymentMethod::from_str(&pay_method_str).unwrap_or(PaymentMethod::Cash);
    let status = VoucherStatus::from_str(&status_str).unwrap_or(VoucherStatus::Posted);

    Ok(CashbookVoucher {
        id: r.get(0)?,
        voucher_number: r.get(1)?,
        idempotency_key: r.get(2)?,
        payload_hash: r.get(3)?,
        account_id: r.get(4)?,
        party_id: r.get(5)?,
        category_id: r.get(6)?,
        direction,
        classification,
        payment_method,
        amount_minor: r.get(10)?,
        business_date: r.get(11)?,
        status,
        is_reversal: r.get::<_, i64>(13)? == 1,
        reversal_for_voucher_id: r.get(14)?,
        is_reversed: r.get::<_, i64>(15)? == 1,
        reversed_by_voucher_id: r.get(16)?,
        reversed_at: r.get(17)?,
        reference_note: r.get(18)?,
        notes: r.get(19)?,
        business_name_snap: r.get(20)?,
        business_tax_id_snap: r.get(21)?,
        business_address_snap: r.get(22)?,
        business_phone_snap: r.get(23)?,
        party_name_snap: r.get(24)?,
        party_phone_snap: r.get(25)?,
        party_tax_id_snap: r.get(26)?,
        party_address_snap: r.get(27)?,
        account_name_snap: r.get(28)?,
        currency_code_snap: r.get(29)?,
        currency_exponent_snap: r.get(30)?,
        amount_in_words_snap: r.get(31)?,
        created_at: r.get(32)?,
        posted_at: r.get(33)?,
    })
}

fn fetch_voucher_by_id(conn: &Connection, id: &str) -> Result<CashbookVoucher, String> {
    let mut stmt = conn
        .prepare(
            "SELECT 
                id, voucher_number, idempotency_key, payload_hash, account_id,
                party_id, category_id, direction, classification, payment_method,
                amount_minor, business_date, status, is_reversal, reversal_for_voucher_id,
                is_reversed, reversed_by_voucher_id, reversed_at, reference_note, notes,
                business_name_snap, business_tax_id_snap, business_address_snap, business_phone_snap,
                party_name_snap, party_phone_snap, party_tax_id_snap, party_address_snap,
                account_name_snap, currency_code_snap, currency_exponent_snap, amount_in_words_snap,
                created_at, posted_at
             FROM cashbook_vouchers
             WHERE id = ?1;"
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    stmt.query_row(params![id], |r| row_to_voucher(r))
        .map_err(|e| format!("Voucher with id '{}' not found: {}", id, e))
}

fn fetch_money_accounts(conn: &Connection) -> Result<Vec<MoneyAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT 
                a.id, a.account_name, a.account_type, a.opening_balance_minor,
                a.allow_negative_balance, a.currency_code, a.currency_exponent,
                a.bank_name, a.account_number, a.ifsc_or_routing, a.is_archived,
                a.created_at, a.updated_at,
                (a.opening_balance_minor + COALESCE((SELECT SUM(m.amount_minor) FROM cashbook_movements m WHERE m.account_id = a.id), 0)) AS current_balance_minor
            FROM money_accounts a
            ORDER BY a.is_archived ASC, a.account_name COLLATE NOCASE ASC;"
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    let rows = stmt
        .query_map([], |r| {
            let act_type_str: String = r.get(2)?;
            let act_type = AccountType::from_str(&act_type_str).unwrap_or(AccountType::Other);
            Ok(MoneyAccount {
                id: r.get(0)?,
                account_name: r.get(1)?,
                account_type: act_type,
                opening_balance_minor: r.get(3)?,
                allow_negative_balance: r.get::<_, i64>(4)? == 1,
                currency_code: r.get(5)?,
                currency_exponent: r.get(6)?,
                bank_name: r.get(7)?,
                account_number: r.get(8)?,
                ifsc_or_routing: r.get(9)?,
                is_archived: r.get::<_, i64>(10)? == 1,
                created_at: r.get(11)?,
                updated_at: r.get(12)?,
                current_balance_minor: r.get(13)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for a in rows {
        list.push(a.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

fn create_money_account(conn: &Connection, dto: CreateMoneyAccountDto) -> Result<MoneyAccount, String> {
    let name = dto.account_name.trim();
    if name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    if dto.opening_balance_minor < -MAX_MONEY_MINOR || dto.opening_balance_minor > MAX_MONEY_MINOR {
        return Err(format!("Opening balance exceeds limit: {}", MAX_MONEY_MINOR));
    }
    let act_type = AccountType::from_str(&dto.account_type)
        .ok_or_else(|| format!("Invalid account type: {}", dto.account_type))?;

    let settings = fetch_business_settings(conn)?;
    let (currency_code, currency_exponent) = match (dto.currency_code, dto.currency_exponent) {
        (Some(c), Some(e)) => {
            crate::domain::currency::validate_currency(&c, e)
                .map_err(|e| e.to_string())?;
            if c != settings.currency_code {
                return Err(CashbookError::CurrencyMismatch {
                    expected: settings.currency_code,
                    actual: c,
                }.to_string());
            }
            if e != settings.currency_exponent {
                return Err(CashbookError::CurrencyExponentMismatch {
                    expected: settings.currency_exponent,
                    actual: e,
                }.to_string());
            }
            (c, e)
        }
        (Some(c), None) => {
            if c != settings.currency_code {
                return Err(CashbookError::CurrencyMismatch {
                    expected: settings.currency_code,
                    actual: c,
                }.to_string());
            }
            (c, settings.currency_exponent)
        }
        (None, Some(e)) => {
            if e != settings.currency_exponent {
                return Err(CashbookError::CurrencyExponentMismatch {
                    expected: settings.currency_exponent,
                    actual: e,
                }.to_string());
            }
            (settings.currency_code, e)
        }
        (None, None) => (settings.currency_code, settings.currency_exponent),
    };

    let id = format!("acc_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    let res = conn.execute(
        "INSERT INTO money_accounts (
            id, account_name, account_type, opening_balance_minor,
            allow_negative_balance, currency_code, currency_exponent,
            bank_name, account_number, ifsc_or_routing, is_archived,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, ?11);",
        params![
            id,
            name,
            act_type.as_str(),
            dto.opening_balance_minor,
            if dto.allow_negative_balance { 1 } else { 0 },
            currency_code,
            currency_exponent,
            dto.bank_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.account_number.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.ifsc_or_routing.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            now
        ],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed") {
            return Err(format!("An account with name '{}' already exists.", name));
        }
        return Err(format!("Failed to insert money account: {}", e));
    }

    Ok(MoneyAccount {
        id,
        account_name: name.to_string(),
        account_type: act_type,
        opening_balance_minor: dto.opening_balance_minor,
        allow_negative_balance: dto.allow_negative_balance,
        currency_code,
        currency_exponent,
        bank_name: dto.bank_name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        account_number: dto.account_number.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        ifsc_or_routing: dto.ifsc_or_routing.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        is_archived: false,
        current_balance_minor: dto.opening_balance_minor,
        created_at: now,
        updated_at: now,
    })
}

fn update_money_account(conn: &Connection, dto: UpdateMoneyAccountDto) -> Result<MoneyAccount, String> {
    let name = dto.account_name.trim();
    if name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    let now = chrono::Utc::now().timestamp_millis();

    let res = conn.execute(
        "UPDATE money_accounts SET
            account_name = ?1,
            allow_negative_balance = ?2,
            bank_name = ?3,
            account_number = ?4,
            ifsc_or_routing = ?5,
            is_archived = ?6,
            updated_at = ?7
        WHERE id = ?8;",
        params![
            name,
            if dto.allow_negative_balance { 1 } else { 0 },
            dto.bank_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.account_number.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.ifsc_or_routing.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            if dto.is_archived { 1 } else { 0 },
            now,
            dto.id
        ],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed") {
            return Err(format!("An account with name '{}' already exists.", name));
        }
        return Err(format!("Failed to update money account: {}", e));
    }

    let mut stmt = conn
        .prepare(
            "SELECT 
                a.id, a.account_name, a.account_type, a.opening_balance_minor,
                a.allow_negative_balance, a.currency_code, a.currency_exponent,
                a.bank_name, a.account_number, a.ifsc_or_routing, a.is_archived,
                a.created_at, a.updated_at,
                (a.opening_balance_minor + COALESCE((SELECT SUM(m.amount_minor) FROM cashbook_movements m WHERE m.account_id = a.id), 0)) AS current_balance_minor
            FROM money_accounts a
            WHERE a.id = ?1;"
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    stmt.query_row(params![dto.id], |r| {
        let act_type_str: String = r.get(2)?;
        let act_type = AccountType::from_str(&act_type_str).unwrap_or(AccountType::Other);
        Ok(MoneyAccount {
            id: r.get(0)?,
            account_name: r.get(1)?,
            account_type: act_type,
            opening_balance_minor: r.get(3)?,
            allow_negative_balance: r.get::<_, i64>(4)? == 1,
            currency_code: r.get(5)?,
            currency_exponent: r.get(6)?,
            bank_name: r.get(7)?,
            account_number: r.get(8)?,
            ifsc_or_routing: r.get(9)?,
            is_archived: r.get::<_, i64>(10)? == 1,
            created_at: r.get(11)?,
            updated_at: r.get(12)?,
            current_balance_minor: r.get(13)?,
        })
    })
    .map_err(|e| format!("Account with id '{}' not found: {}", dto.id, e))
}

fn fetch_cashbook_categories(conn: &Connection) -> Result<Vec<CashbookCategory>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, category_type, is_default, is_archived, created_at 
             FROM cashbook_categories 
             ORDER BY is_default DESC, name COLLATE NOCASE ASC;"
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    let rows = stmt
        .query_map([], |r| {
            let cat_type_str: String = r.get(2)?;
            let cat_type = CategoryType::from_str(&cat_type_str).unwrap_or(CategoryType::Both);
            Ok(CashbookCategory {
                id: r.get(0)?,
                name: r.get(1)?,
                category_type: cat_type,
                is_default: r.get::<_, i64>(3)? == 1,
                is_archived: r.get::<_, i64>(4)? == 1,
                created_at: r.get(5)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for c in rows {
        list.push(c.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

fn create_cashbook_category(conn: &Connection, dto: CreateCashbookCategoryDto) -> Result<CashbookCategory, String> {
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Category name cannot be empty".to_string());
    }
    let cat_type = CategoryType::from_str(&dto.category_type)
        .ok_or_else(|| format!("Invalid category type: {}", dto.category_type))?;

    let id = format!("cbcat_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    let res = conn.execute(
        "INSERT INTO cashbook_categories (id, name, category_type, is_default, is_archived, created_at)
         VALUES (?1, ?2, ?3, 0, 0, ?4);",
        params![id, name, cat_type.as_str(), now],
    );

    if let Err(e) = res {
        let msg = e.to_string();
        if msg.contains("UNIQUE constraint failed") {
            return Err(format!("A category with name '{}' already exists.", name));
        }
        return Err(format!("Failed to insert category: {}", e));
    }

    Ok(CashbookCategory {
        id,
        name: name.to_string(),
        category_type: cat_type,
        is_default: false,
        is_archived: false,
        created_at: now,
    })
}

fn fetch_cashbook_parties(conn: &Connection) -> Result<Vec<CashbookParty>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, party_type, customer_id, phone, email, tax_id, address, is_archived, created_at, updated_at
             FROM cashbook_parties
             ORDER BY name COLLATE NOCASE ASC;"
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    let rows = stmt
        .query_map([], |r| {
            let pty_type_str: String = r.get(2)?;
            let pty_type = PartyType::from_str(&pty_type_str).unwrap_or(PartyType::Other);
            Ok(CashbookParty {
                id: r.get(0)?,
                name: r.get(1)?,
                party_type: pty_type,
                customer_id: r.get(3)?,
                phone: r.get(4)?,
                email: r.get(5)?,
                tax_id: r.get(6)?,
                address: r.get(7)?,
                is_archived: r.get::<_, i64>(8)? == 1,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut list = Vec::new();
    for p in rows {
        list.push(p.map_err(|e| format!("Row mapping error: {}", e))?);
    }
    Ok(list)
}

// Customer owns the current contact projection. Voucher snapshot columns are never updated.
fn sync_customer_party_projection(conn: &Connection, customer_id: &str) -> Result<(), String> {
    conn.execute("UPDATE cashbook_parties SET
        name = (SELECT name FROM customers WHERE id=?1),
        phone = (SELECT phone FROM customers WHERE id=?1),
        email = (SELECT email FROM customers WHERE id=?1),
        tax_id = (SELECT tax_identifier FROM customers WHERE id=?1),
        address = (SELECT NULLIF(TRIM(
            COALESCE(address_line1 || ', ', '') || COALESCE(address_line2 || ', ', '') ||
            COALESCE(city || ', ', '') || COALESCE(state || ', ', '') ||
            COALESCE(postal_code || ', ', '') || COALESCE(country, ''), ', '), '')
            FROM customers WHERE id=?1),
        updated_at = (SELECT updated_at FROM customers WHERE id=?1)
        WHERE customer_id=?1", [customer_id]).map_err(|e|e.to_string())?;
    Ok(())
}

fn ensure_customer_cashbook_party(conn: &mut Connection, input: EnsureCustomerCashbookPartyInput) -> Result<CashbookParty, String> {
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(|e|e.to_string())?;
    let active: Option<bool> = tx.query_row("SELECT is_active FROM customers WHERE id=?", [&input.customer_id], |r|r.get(0)).optional().map_err(|e|e.to_string())?;
    match active {
        None => return Err(CustomerPartyError::CustomerNotFound.to_string()),
        Some(false) => return Err(CustomerPartyError::CustomerArchived.to_string()),
        Some(true) => (),
    }
    let parties = fetch_cashbook_parties(&tx)?;
    let id = if let Some(ref party_id) = input.existing_party_id {
        let party = parties.iter().find(|p| &p.id == party_id).ok_or_else(||CustomerPartyError::PartyNotFound.to_string())?;
        if party.is_archived { return Err(CustomerPartyError::PartyArchived.to_string()); }
        if party.customer_id.as_ref().is_some_and(|id|id != &input.customer_id) { return Err(CustomerPartyError::PartyLinkConflict.to_string()); }
        if party.customer_id.is_none() {
            tx.execute("UPDATE cashbook_parties SET customer_id=?1, updated_at=?2 WHERE id=?3", params![input.customer_id, chrono::Utc::now().timestamp_millis(), party_id]).map_err(|e|e.to_string())?;
            let details = serde_json::json!({"party_id":party_id,"customer_id":input.customer_id,"previous_customer_id":null}).to_string();
            tx.execute("INSERT INTO cashbook_audit_events (id,voucher_id,event_type,details_json,created_at) VALUES (?1,NULL,'customer_party_linked',?2,?3)",params![format!("aud_{}",uuid::Uuid::new_v4().simple()),details,chrono::Utc::now().timestamp_millis()]).map_err(|e|e.to_string())?;
        }
        party.id.clone()
    } else {
        let linked: Vec<_> = parties.iter().filter(|p|p.customer_id.as_ref()==Some(&input.customer_id)).collect();
        match linked.as_slice() {
            [] => {
                let name: String = tx.query_row("SELECT name FROM customers WHERE id=?", [&input.customer_id], |r|r.get(0)).map_err(|e|e.to_string())?;
                create_cashbook_party(&tx, CreateCashbookPartyDto {name,party_type:"customer".into(),customer_id:Some(input.customer_id.clone()),phone:None,email:None,tax_id:None,address:None})?.id
            },
            [party] if !party.is_archived => party.id.clone(),
            _ => return Err(CustomerPartyError::PartySelectionRequired.to_string()),
        }
    };
    sync_customer_party_projection(&tx, &input.customer_id)?;
    let party = fetch_cashbook_parties(&tx)?.into_iter().find(|p|p.id==id).ok_or_else(||CustomerPartyError::PartyNotFound.to_string())?;
    tx.commit().map_err(|e|e.to_string())?;
    Ok(party)
}

fn fetch_customer_cash_history(conn: &Connection, filter: CustomerCashHistoryFilter) -> Result<CustomerCashHistory, String> {
    let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM customers WHERE id=?)", [&filter.customer_id], |r|r.get(0)).map_err(|e|e.to_string())?;
    if !exists { return Err(CustomerPartyError::CustomerNotFound.to_string()); }
    for date in [&filter.start_date, &filter.end_date].into_iter().flatten() {
        if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() || date.len()!=10 { return Err(CashbookError::InvalidDateFormat(date.clone()).to_string()); }
    }
    if filter.start_date.as_ref().zip(filter.end_date.as_ref()).is_some_and(|(a,b)|a>b) { return Err("Start date must not follow end date".into()); }
    let (entries, _) = fetch_cashbook_ledger_for_customer(conn, CashbookLedgerFilter {account_id:filter.account_id,start_date:filter.start_date,end_date:filter.end_date,include_archived:Some(true),..Default::default()},Some(&filter.customer_id))?;
    let mut received_minor = 0i64;
    let mut paid_minor = 0i64;
    for entry in &entries {
        let amount = entry.movement.amount_minor;
        if amount > 0 { received_minor = received_minor.checked_add(amount).ok_or_else(||CashbookError::BalanceOverflow.to_string())?; }
        else { paid_minor = paid_minor.checked_add(amount.checked_neg().ok_or_else(||CashbookError::BalanceOverflow.to_string())?).ok_or_else(||CashbookError::BalanceOverflow.to_string())?; }
    }
    let net_movement_minor = received_minor.checked_sub(paid_minor).ok_or_else(||CashbookError::BalanceOverflow.to_string())?;
    Ok(CustomerCashHistory {entries,received_minor,paid_minor,net_movement_minor})
}


fn create_cashbook_party(conn: &Connection, dto: CreateCashbookPartyDto) -> Result<CashbookParty, String> {
    let name = dto.name.trim();
    if name.is_empty() {
        return Err("Party name cannot be empty".to_string());
    }
    let pty_type = PartyType::from_str(&dto.party_type)
        .ok_or_else(|| format!("Invalid party type: {}", dto.party_type))?;

    let id = format!("pty_{}", uuid::Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO cashbook_parties (
            id, name, party_type, customer_id, phone, email, tax_id, address, is_archived, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9);",
        params![
            id,
            name,
            pty_type.as_str(),
            dto.customer_id.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.email.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.tax_id.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            dto.address.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            now
        ],
    )
    .map_err(|e| format!("Failed to insert party: {}", e))?;

    Ok(CashbookParty {
        id,
        name: name.to_string(),
        party_type: pty_type,
        customer_id: dto.customer_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        phone: dto.phone.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        email: dto.email.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        tax_id: dto.tax_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        address: dto.address.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        is_archived: false,
        created_at: now,
        updated_at: now,
    })
}

fn post_cashbook_voucher(
    conn: &mut Connection,
    input: CreateVoucherInput,
) -> Result<PostVoucherResult, String> {
    validate_money_amount(input.amount_minor).map_err(|e| e.to_string())?;

    let parsed_date = chrono::NaiveDate::parse_from_str(&input.business_date, "%Y-%m-%d")
        .map_err(|_| CashbookError::InvalidDateFormat(input.business_date.clone()).to_string())?;

    if input.idempotency_key.trim().is_empty() {
        return Err("Idempotency key cannot be empty".to_string());
    }

    validate_direction_and_classification(input.direction, input.classification)
        .map_err(|e| e.to_string())?;

    let payload_hash = compute_client_intent_hash(&input);

    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Transaction begin error: {}", e))?;

    // 1. Idempotency Check inside transaction
    let existing: Option<(String, String)> = tx
        .query_row(
            "SELECT id, payload_hash FROM cashbook_vouchers WHERE idempotency_key = ?1;",
            params![input.idempotency_key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to check idempotency key: {}", e))?;

    if let Some((existing_id, existing_hash)) = existing {
        if existing_hash == payload_hash {
            let v = fetch_voucher_by_id(&tx, &existing_id)?;
            return Ok(PostVoucherResult::Posted(v));
        } else {
            return Err(CashbookError::IdempotencyKeyConflict.to_string());
        }
    }

    // 2. Fetch Account Info inside transaction
    let acc_opt = tx
        .query_row(
            "SELECT account_name, opening_balance_minor, allow_negative_balance, currency_code, currency_exponent, is_archived
             FROM money_accounts WHERE id = ?1;",
            params![input.account_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i32>(4)?,
                r.get::<_, i64>(5)?,
            )),
        )
        .optional()
        .map_err(|e| format!("Failed to fetch money account: {}", e))?;

    let (account_name, opening_balance_minor, allow_negative_balance, account_currency, account_exponent, is_archived) = match acc_opt {
        Some(vals) => vals,
        None => return Err(CashbookError::AccountNotFound(input.account_id.clone()).to_string()),
    };

    if is_archived != 0 {
        return Err(CashbookError::AccountArchived(input.account_id.clone()).to_string());
    }

    // 3. Currency Match check inside transaction
    let (company_currency, company_exponent): (String, i32) = tx
        .query_row(
            "SELECT currency_code, currency_exponent FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| format!("Failed to fetch business settings currency: {}", e))?;

    if account_currency != company_currency {
        return Err(CashbookError::CurrencyMismatch {
            expected: company_currency,
            actual: account_currency,
        }.to_string());
    }
    if account_exponent != company_exponent {
        return Err(CashbookError::CurrencyExponentMismatch {
            expected: company_exponent,
            actual: account_exponent,
        }.to_string());
    }

    // 4. Category Validation inside transaction
    if let Some(ref cat_id) = input.category_id {
        let cat_type_str: Option<String> = tx
            .query_row(
                "SELECT category_type FROM cashbook_categories WHERE id = ?1;",
                params![cat_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| format!("Failed to fetch category: {}", e))?;

        match cat_type_str {
            Some(s) => {
                let cat_type = CategoryType::from_str(&s)
                    .ok_or_else(|| format!("Invalid category type in database: {}", s))?;
                validate_direction_and_category(input.direction, cat_type)
                    .map_err(|e| e.to_string())?;
            }
            None => {
                return Err(CashbookError::CategoryNotFound(cat_id.clone()).to_string());
            }
        }
    }

    // 5. Authoritative Current Balance with checked arithmetic inside transaction
    let sum_movs: i64 = tx
        .query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements WHERE account_id = ?1;",
            params![input.account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to compute sum of movements: {}", e))?;

    let current_balance = opening_balance_minor
        .checked_add(sum_movs)
        .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;

    let movement_delta = match input.direction {
        MovementDirection::Inflow => input.amount_minor,
        MovementDirection::Outflow => -input.amount_minor,
    };

    let projected_balance = current_balance
        .checked_add(movement_delta)
        .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;

    if projected_balance < -MAX_TOTAL_MINOR || projected_balance > MAX_TOTAL_MINOR {
        return Err(CashbookError::BalanceExceedsMaximum(projected_balance, MAX_TOTAL_MINOR).to_string());
    }

    // 6. Negative Balance Guard inside transaction
    if projected_balance < 0 && allow_negative_balance == 0 && !input.confirmed_negative_balance {
        return Ok(PostVoucherResult::RequiresConfirmation {
            current_balance_minor: current_balance,
            amount_minor: input.amount_minor,
            projected_balance_minor: projected_balance,
            message: format!(
                "Account balance would become negative: current {}, projected {}",
                current_balance, projected_balance
            ),
        });
    }

    let now = chrono::Utc::now().timestamp_millis();
    let year_month = parsed_date.format("%Y%m").to_string();

    let prefix = match input.direction {
        MovementDirection::Inflow => "RCP",
        MovementDirection::Outflow => "PAY",
    };
    let seq_key = format!("{}-{}", prefix, year_month);

    let next_seq: i64 = tx
        .query_row(
            "INSERT INTO cashbook_sequences (sequence_key, current_number, updated_at)
             VALUES (?1, 1, ?2)
             ON CONFLICT(sequence_key) DO UPDATE SET current_number = current_number + 1, updated_at = ?2
             RETURNING current_number;",
            params![seq_key, now],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to allocate sequence: {}", e))?;

    let voucher_number = format_voucher_number(prefix, &year_month, next_seq);
    let voucher_id = format!("vch_{}", uuid::Uuid::new_v4().simple());

    // Snapshots
    let (biz_name, biz_tax_id, biz_addr, biz_phone): (Option<String>, Option<String>, Option<String>, Option<String>) = tx
        .query_row(
            "SELECT business_name, tax_identifier, address_line1, phone FROM business_settings WHERE id = 'default';",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap_or((Some("BillZen Store".to_string()), None, None, None));

    let (party_name, party_phone, party_tax_id, party_addr): (Option<String>, Option<String>, Option<String>, Option<String>) = if let Some(ref pid) = input.party_id {
        tx.query_row(
            "SELECT name, phone, tax_id, address FROM cashbook_parties WHERE id = ?1;",
            params![pid],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .unwrap_or((None, None, None, None))
    } else {
        (None, None, None, None)
    };

    tx.execute(
        "INSERT INTO cashbook_vouchers (
            id, voucher_number, idempotency_key, payload_hash, account_id,
            party_id, category_id, direction, classification, payment_method,
            amount_minor, business_date, status, is_reversal, reversal_for_voucher_id,
            is_reversed, reversed_by_voucher_id, reversed_at, reference_note, notes,
            business_name_snap, business_tax_id_snap, business_address_snap, business_phone_snap,
            party_name_snap, party_phone_snap, party_tax_id_snap, party_address_snap,
            account_name_snap, currency_code_snap, currency_exponent_snap, amount_in_words_snap,
            created_at, posted_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9, ?10,
            ?11, ?12, 'posted', 0, NULL,
            0, NULL, NULL, ?13, ?14,
            ?15, ?16, ?17, ?18,
            ?19, ?20, ?21, ?22,
            ?23, ?24, ?25, NULL,
            ?26, ?26
        );",
        params![
            voucher_id,
            voucher_number,
            input.idempotency_key,
            payload_hash,
            input.account_id,
            input.party_id,
            input.category_id,
            input.direction.as_str(),
            input.classification.as_str(),
            input.payment_method.as_str(),
            input.amount_minor,
            input.business_date,
            input.reference_note.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            input.notes.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            biz_name,
            biz_tax_id,
            biz_addr,
            biz_phone,
            party_name,
            party_phone,
            party_tax_id,
            party_addr,
            account_name,
            account_currency,
            account_exponent,
            now
        ],
    ).map_err(|e| format!("Failed to insert voucher: {}", e))?;

    let movement_id = format!("mov_{}", uuid::Uuid::new_v4().simple());
    let next_mov_seq: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM cashbook_movements WHERE account_id = ?1;",
            params![input.account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to allocate movement sequence: {}", e))?;

    tx.execute(
        "INSERT INTO cashbook_movements (
            id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
        params![
            movement_id,
            voucher_id,
            input.account_id,
            movement_delta,
            input.business_date,
            next_mov_seq,
            now
        ],
    ).map_err(|e| format!("Failed to insert movement: {}", e))?;

    // Transactional audit events
    let aud_post_id = format!("aud_{}", uuid::Uuid::new_v4().simple());
    let post_details = serde_json::json!({
        "voucher_id": voucher_id,
        "voucher_number": voucher_number,
        "amount_minor": input.amount_minor,
        "account_id": input.account_id,
        "direction": input.direction.as_str(),
        "classification": input.classification.as_str(),
        "posted_at": now,
    }).to_string();
    tx.execute(
        "INSERT INTO cashbook_audit_events (id, voucher_id, event_type, details_json, created_at)
         VALUES (?1, ?2, 'voucher_posted', ?3, ?4);",
        params![aud_post_id, voucher_id, post_details, now],
    ).map_err(|e| format!("Failed to log voucher_posted audit event: {}", e))?;

    if projected_balance < 0 && allow_negative_balance == 0 && input.confirmed_negative_balance {
        let audit_id = format!("aud_{}", uuid::Uuid::new_v4().simple());
        let details = serde_json::json!({
            "current_balance_minor": current_balance,
            "amount_minor": input.amount_minor,
            "projected_balance_minor": projected_balance,
            "account_id": input.account_id,
            "voucher_id": voucher_id,
            "voucher_number": voucher_number,
            "confirmed_at": now,
        }).to_string();

        tx.execute(
            "INSERT INTO cashbook_audit_events (id, voucher_id, event_type, details_json, created_at)
             VALUES (?1, ?2, 'negative_balance_confirmed', ?3, ?4);",
            params![audit_id, voucher_id, details, now],
        ).map_err(|e| format!("Failed to log audit event: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Transaction commit failed: {}", e))?;
    let v = fetch_voucher_by_id(conn, &voucher_id)?;
    Ok(PostVoucherResult::Posted(v))
}

fn reverse_cashbook_voucher(
    conn: &mut Connection,
    voucher_id: String,
    confirmed_negative_balance: bool,
) -> Result<PostVoucherResult, String> {
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Transaction begin error: {}", e))?;

    let orig = fetch_voucher_by_id(&tx, &voucher_id)
        .map_err(|_| CashbookError::VoucherNotFound(voucher_id.clone()).to_string())?;

    if orig.status != VoucherStatus::Posted {
        return Err(CashbookError::CannotReverseNonPosted(voucher_id).to_string());
    }
    if orig.is_reversed {
        return Err(CashbookError::VoucherAlreadyReversed(voucher_id).to_string());
    }
    if orig.is_reversal {
        return Err(CashbookError::CannotReverseReversal(voucher_id).to_string());
    }

    let acc_opt = tx
        .query_row(
            "SELECT allow_negative_balance, opening_balance_minor, is_archived FROM money_accounts WHERE id = ?1;",
            params![orig.account_id],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to read money account: {}", e))?;

    let (allow_negative_balance, opening_balance_minor, is_archived) = match acc_opt {
        Some(vals) => vals,
        None => return Err(CashbookError::AccountNotFound(orig.account_id.clone()).to_string()),
    };

    if is_archived != 0 {
        return Err(CashbookError::AccountArchived(orig.account_id.clone()).to_string());
    }

    let sum_movs: i64 = tx
        .query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements WHERE account_id = ?1;",
            params![orig.account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to compute sum of movements: {}", e))?;

    let current_balance = opening_balance_minor
        .checked_add(sum_movs)
        .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;

    let (reversal_movement_delta, reversal_direction, reversal_prefix) = match orig.direction {
        MovementDirection::Inflow => (-orig.amount_minor, MovementDirection::Outflow, "RCP-REV"),
        MovementDirection::Outflow => (orig.amount_minor, MovementDirection::Inflow, "PAY-REV"),
    };

    let projected_balance = current_balance
        .checked_add(reversal_movement_delta)
        .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;

    if projected_balance < -MAX_TOTAL_MINOR || projected_balance > MAX_TOTAL_MINOR {
        return Err(CashbookError::BalanceExceedsMaximum(projected_balance, MAX_TOTAL_MINOR).to_string());
    }

    if projected_balance < 0 && allow_negative_balance == 0 && !confirmed_negative_balance {
        return Ok(PostVoucherResult::RequiresConfirmation {
            current_balance_minor: current_balance,
            amount_minor: orig.amount_minor,
            projected_balance_minor: projected_balance,
            message: format!(
                "Reversal would make account balance negative: current {}, projected {}",
                current_balance, projected_balance
            ),
        });
    }

    let company_timezone: String = tx
        .query_row(
            "SELECT timezone FROM business_settings WHERE id = 'default';",
            [],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| "Asia/Kolkata".to_string());

    let now = chrono::Utc::now();
    let now_millis = now.timestamp_millis();
    let (reversal_business_date, reversal_year_month) =
        format_business_date_and_year_month(now, &company_timezone);
    let seq_key = format!("{}-{}", reversal_prefix, reversal_year_month);

    let next_seq: i64 = tx
        .query_row(
            "INSERT INTO cashbook_sequences (sequence_key, current_number, updated_at)
             VALUES (?1, 1, ?2)
             ON CONFLICT(sequence_key) DO UPDATE SET current_number = current_number + 1, updated_at = ?2
             RETURNING current_number;",
            params![seq_key, now_millis],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to allocate sequence: {}", e))?;

    let reversal_voucher_number = format_voucher_number(reversal_prefix, &reversal_year_month, next_seq);
    let reversal_voucher_id = format!("vch_{}", uuid::Uuid::new_v4().simple());
    let reversal_idempotency_key = format!("rev_{}", orig.id);

    // Insert reversal voucher before updating original voucher reversal linkage
    tx.execute(
        "INSERT INTO cashbook_vouchers (
            id, voucher_number, idempotency_key, payload_hash, account_id,
            party_id, category_id, direction, classification, payment_method,
            amount_minor, business_date, status, is_reversal, reversal_for_voucher_id,
            is_reversed, reversed_by_voucher_id, reversed_at, reference_note, notes,
            business_name_snap, business_tax_id_snap, business_address_snap, business_phone_snap,
            party_name_snap, party_phone_snap, party_tax_id_snap, party_address_snap,
            account_name_snap, currency_code_snap, currency_exponent_snap, amount_in_words_snap,
            created_at, posted_at
        ) VALUES (
            ?1, ?2, ?3, 'reversal', ?4,
            ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, 'posted', 1, ?12,
            0, NULL, NULL, ?13, ?14,
            ?15, ?16, ?17, ?18,
            ?19, ?20, ?21, ?22,
            ?23, ?24, ?25, ?26,
            ?27, ?27
        );",
        params![
            reversal_voucher_id,
            reversal_voucher_number,
            reversal_idempotency_key,
            orig.account_id,
            orig.party_id,
            orig.category_id,
            reversal_direction.as_str(),
            orig.classification.as_str(),
            orig.payment_method.as_str(),
            orig.amount_minor,
            reversal_business_date,
            orig.id,
            orig.reference_note,
            format!("Reversal of voucher {}", orig.voucher_number),
            orig.business_name_snap,
            orig.business_tax_id_snap,
            orig.business_address_snap,
            orig.business_phone_snap,
            orig.party_name_snap,
            orig.party_phone_snap,
            orig.party_tax_id_snap,
            orig.party_address_snap,
            orig.account_name_snap,
            orig.currency_code_snap,
            orig.currency_exponent_snap,
            orig.amount_in_words_snap,
            now_millis
        ],
    ).map_err(|e| format!("Failed to insert reversal voucher: {}", e))?;

    let movement_id = format!("mov_{}", uuid::Uuid::new_v4().simple());
    let next_mov_seq: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM cashbook_movements WHERE account_id = ?1;",
            params![orig.account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Failed to allocate reversal movement sequence: {}", e))?;

    tx.execute(
        "INSERT INTO cashbook_movements (
            id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
        params![
            movement_id,
            reversal_voucher_id,
            orig.account_id,
            reversal_movement_delta,
            reversal_business_date,
            next_mov_seq,
            now_millis
        ],
    ).map_err(|e| format!("Failed to insert reversal movement: {}", e))?;

    tx.execute(
        "UPDATE cashbook_vouchers SET is_reversed = 1, reversed_by_voucher_id = ?1, reversed_at = ?2 WHERE id = ?3;",
        params![reversal_voucher_id, now_millis, orig.id],
    ).map_err(|e| format!("Failed to update original voucher reversal status: {}", e))?;

    let audit_id = format!("aud_{}", uuid::Uuid::new_v4().simple());
    let details = serde_json::json!({
        "original_voucher_id": orig.id,
        "original_voucher_number": orig.voucher_number,
        "reversal_voucher_id": reversal_voucher_id,
        "reversal_voucher_number": reversal_voucher_number,
        "reversed_at": now_millis,
    }).to_string();

    tx.execute(
        "INSERT INTO cashbook_audit_events (id, voucher_id, event_type, details_json, created_at)
         VALUES (?1, ?2, 'voucher_reversed', ?3, ?4);",
        params![audit_id, orig.id, details, now_millis],
    ).map_err(|e| format!("Failed to log reversal audit event: {}", e))?;

    if projected_balance < 0 && allow_negative_balance == 0 && confirmed_negative_balance {
        let aud_neg_id = format!("aud_{}", uuid::Uuid::new_v4().simple());
        let neg_details = serde_json::json!({
            "current_balance_minor": current_balance,
            "reversal_amount_minor": orig.amount_minor,
            "projected_balance_minor": projected_balance,
            "account_id": orig.account_id,
            "reversal_voucher_id": reversal_voucher_id,
            "confirmed_at": now_millis,
        }).to_string();

        tx.execute(
            "INSERT INTO cashbook_audit_events (id, voucher_id, event_type, details_json, created_at)
             VALUES (?1, ?2, 'negative_balance_confirmed', ?3, ?4);",
            params![aud_neg_id, reversal_voucher_id, neg_details, now_millis],
        ).map_err(|e| format!("Failed to log negative balance audit event: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Transaction commit failed: {}", e))?;
    let rev_v = fetch_voucher_by_id(conn, &reversal_voucher_id)?;
    Ok(PostVoucherResult::Posted(rev_v))
}

fn fetch_cashbook_ledger(
    conn: &Connection,
    filter: CashbookLedgerFilter,
) -> Result<(Vec<CashbookLedgerEntry>, CashbookSummary), String> {
    fetch_cashbook_ledger_for_customer(conn, filter, None)
}

fn fetch_cashbook_ledger_for_customer(conn: &Connection, filter: CashbookLedgerFilter, customer_id: Option<&str>) -> Result<(Vec<CashbookLedgerEntry>, CashbookSummary), String> {
    let mut sql = "WITH ledger AS (
        SELECT 
            v.id AS v_id, v.voucher_number, v.idempotency_key, v.payload_hash, v.account_id AS v_account_id,
            v.party_id, v.category_id, v.direction, v.classification, v.payment_method,
            v.amount_minor AS v_amount_minor, v.business_date AS v_business_date, v.status, v.is_reversal, v.reversal_for_voucher_id,
            v.is_reversed, v.reversed_by_voucher_id, v.reversed_at, v.reference_note, v.notes,
            v.business_name_snap, v.business_tax_id_snap, v.business_address_snap, v.business_phone_snap,
            v.party_name_snap, v.party_phone_snap, v.party_tax_id_snap, v.party_address_snap,
            v.account_name_snap, v.currency_code_snap, v.currency_exponent_snap, v.amount_in_words_snap,
            v.created_at AS v_created_at, v.posted_at,
            m.id AS m_id, m.voucher_id AS m_voucher_id, m.account_id AS m_account_id, m.amount_minor AS m_amount_minor, 
            m.business_date AS m_business_date, m.sequence_number AS m_sequence_number, m.created_at AS m_created_at,
            (a.opening_balance_minor + SUM(m.amount_minor) OVER (
                PARTITION BY m.account_id 
                ORDER BY m.business_date ASC, m.sequence_number ASC, m.id ASC
            )) AS running_balance_minor,
            a.is_archived AS a_is_archived
        FROM cashbook_movements m
        JOIN cashbook_vouchers v ON m.voucher_id = v.id
        JOIN money_accounts a ON m.account_id = a.id
    )
    SELECT 
        v_id, voucher_number, idempotency_key, payload_hash, v_account_id,
        party_id, category_id, direction, classification, payment_method,
        v_amount_minor, v_business_date, status, is_reversal, reversal_for_voucher_id,
        is_reversed, reversed_by_voucher_id, reversed_at, reference_note, notes,
        business_name_snap, business_tax_id_snap, business_address_snap, business_phone_snap,
        party_name_snap, party_phone_snap, party_tax_id_snap, party_address_snap,
        account_name_snap, currency_code_snap, currency_exponent_snap, amount_in_words_snap,
        v_created_at, posted_at,
        m_id, m_voucher_id, m_account_id, m_amount_minor,
        m_business_date, m_sequence_number, m_created_at,
        running_balance_minor
    FROM ledger
    WHERE 1=1".to_string();

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(customer_id) = customer_id {
        sql.push_str(" AND EXISTS (SELECT 1 FROM cashbook_parties p WHERE p.id=ledger.party_id AND p.customer_id=?)");
        params_vec.push(Box::new(customer_id.to_string()));
    }
    if let Some(ref party_id) = filter.party_id {
        sql.push_str(" AND party_id = ?");
        params_vec.push(Box::new(party_id.clone()));
    }
    if let Some(ref acc_id) = filter.account_id {
        sql.push_str(" AND m_account_id = ?");
        params_vec.push(Box::new(acc_id.clone()));
    } else if !filter.include_archived.unwrap_or(false) {
        sql.push_str(" AND a_is_archived = 0");
    }

    if let Some(ref start) = filter.start_date {
        sql.push_str(" AND m_business_date >= ?");
        params_vec.push(Box::new(start.clone()));
    }
    if let Some(ref end) = filter.end_date {
        sql.push_str(" AND m_business_date <= ?");
        params_vec.push(Box::new(end.clone()));
    }
    if let Some(ref class) = filter.classification {
        sql.push_str(" AND classification = ?");
        params_vec.push(Box::new(class.clone()));
    }
    if let Some(ref search) = filter.search {
        let pattern = format!("%{}%", search.trim());
        sql.push_str(" AND (voucher_number LIKE ? OR party_name_snap LIKE ? OR notes LIKE ? OR reference_note LIKE ?)");
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern));
    }

    sql.push_str(" ORDER BY m_business_date ASC, m_sequence_number ASC, m_id ASC;");

    let params_slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Query prepare error: {}", e))?;
    let rows = stmt.query_map(params_slice.as_slice(), |r| {
        let voucher = row_to_voucher(r)?;
        let movement = CashbookMovement {
            id: r.get(34)?,
            voucher_id: r.get(35)?,
            account_id: r.get(36)?,
            amount_minor: r.get(37)?,
            business_date: r.get(38)?,
            sequence_number: r.get(39)?,
            created_at: r.get(40)?,
        };
        let running_balance_minor: i64 = r.get(41)?;
        Ok(CashbookLedgerEntry {
            voucher,
            movement,
            running_balance_minor,
        })
    }).map_err(|e| format!("Query execution error: {}", e))?;

    let mut entries = Vec::new();
    let mut matching_inflows: i64 = 0;
    let mut matching_outflows: i64 = 0;

    for item in rows {
        let entry = item.map_err(|e| format!("Row mapping error: {}", e))?;
        let m_amt = entry.movement.amount_minor;
        if m_amt > 0 {
            matching_inflows = matching_inflows
                .checked_add(m_amt)
                .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;
        } else {
            matching_outflows = matching_outflows
                .checked_add(m_amt.unsigned_abs() as i64)
                .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;
        }
        entries.push(entry);
    }

    let is_display_filtered = filter.search.is_some() || filter.classification.is_some() || filter.party_id.is_some();
    let (matching_inflows_minor, matching_outflows_minor, matching_count) = if is_display_filtered {
        (Some(matching_inflows), Some(matching_outflows), Some(entries.len()))
    } else {
        (None, None, None)
    };

    let (period_inflows, period_outflows, net_operating): (i64, i64, i64) = {
        let mut period_sql = "SELECT 
            COALESCE(SUM(CASE WHEN m.amount_minor > 0 THEN m.amount_minor ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN m.amount_minor < 0 THEN -m.amount_minor ELSE 0 END), 0),
            COALESCE(SUM(CASE 
                WHEN v.classification IN ('operating_income', 'operating_expense') THEN m.amount_minor 
                ELSE 0 
            END), 0)
        FROM cashbook_movements m
        JOIN cashbook_vouchers v ON m.voucher_id = v.id
        JOIN money_accounts a ON m.account_id = a.id
        WHERE 1=1".to_string();

        let mut period_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref acc_id) = filter.account_id {
            period_sql.push_str(" AND m.account_id = ?");
            period_params.push(Box::new(acc_id.clone()));
        } else if !filter.include_archived.unwrap_or(false) {
            period_sql.push_str(" AND a.is_archived = 0");
        }

        if let Some(ref start) = filter.start_date {
            period_sql.push_str(" AND m.business_date >= ?");
            period_params.push(Box::new(start.clone()));
        }
        if let Some(ref end) = filter.end_date {
            period_sql.push_str(" AND m.business_date <= ?");
            period_params.push(Box::new(end.clone()));
        }

        let slice: Vec<&dyn rusqlite::ToSql> = period_params.iter().map(|b| b.as_ref()).collect();
        conn.query_row(&period_sql, slice.as_slice(), |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        }).map_err(|e| format!("Failed to compute period totals: {}", e))?
    };

    let (total_cash_minor, active_cash_minor): (i64, i64) = if let Some(ref acc_id) = filter.account_id {
        let (opening, is_archived): (i64, i64) = conn.query_row(
            "SELECT opening_balance_minor, is_archived FROM money_accounts WHERE id = ?1;",
            params![acc_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).map_err(|e| format!("Failed to query account balance: {}", e))?;

        let mov_sum: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements WHERE account_id = ?1;",
            params![acc_id],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to sum movements: {}", e))?;

        let bal = opening.checked_add(mov_sum).ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;
        let act_bal = if is_archived == 0 { bal } else { 0 };
        (bal, act_bal)
    } else {
        let all_openings: i64 = conn.query_row(
            "SELECT COALESCE(SUM(opening_balance_minor), 0) FROM money_accounts;",
            [],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to query all opening balances: {}", e))?;

        let all_movements: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements;",
            [],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to query all movements: {}", e))?;

        let active_openings: i64 = conn.query_row(
            "SELECT COALESCE(SUM(opening_balance_minor), 0) FROM money_accounts WHERE is_archived = 0;",
            [],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to query active opening balances: {}", e))?;

        let active_movements: i64 = conn.query_row(
            "SELECT COALESCE(SUM(m.amount_minor), 0) FROM cashbook_movements m JOIN money_accounts a ON m.account_id = a.id WHERE a.is_archived = 0;",
            [],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to query active movements: {}", e))?;

        let total = all_openings.checked_add(all_movements).ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;
        let active = active_openings.checked_add(active_movements).ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;
        (total, active)
    };

    let period_opening_balance: i64 = if let Some(ref acc_id) = filter.account_id {
        let base_opening: i64 = conn.query_row(
            "SELECT opening_balance_minor FROM money_accounts WHERE id = ?1;",
            params![acc_id],
            |r| r.get(0),
        ).map_err(|e| format!("Failed to query account opening balance: {}", e))?;

        if let Some(ref start) = filter.start_date {
            let prior_movs: i64 = conn.query_row(
                "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements WHERE account_id = ?1 AND business_date < ?2;",
                params![acc_id, start],
                |r| r.get(0),
            ).map_err(|e| format!("Failed to sum prior movements: {}", e))?;
            base_opening.checked_add(prior_movs).ok_or_else(|| CashbookError::BalanceOverflow.to_string())?
        } else {
            base_opening
        }
    } else {
        let include_arch = filter.include_archived.unwrap_or(false);
        let base_opening: i64 = if include_arch {
            conn.query_row(
                "SELECT COALESCE(SUM(opening_balance_minor), 0) FROM money_accounts;",
                [],
                |r| r.get(0),
            ).map_err(|e| format!("Failed to query opening balance: {}", e))?
        } else {
            conn.query_row(
                "SELECT COALESCE(SUM(opening_balance_minor), 0) FROM money_accounts WHERE is_archived = 0;",
                [],
                |r| r.get(0),
            ).map_err(|e| format!("Failed to query active opening balance: {}", e))?
        };

        if let Some(ref start) = filter.start_date {
            let prior_movs: i64 = if include_arch {
                conn.query_row(
                    "SELECT COALESCE(SUM(amount_minor), 0) FROM cashbook_movements WHERE business_date < ?1;",
                    params![start],
                    |r| r.get(0),
                ).map_err(|e| format!("Failed to sum prior movements: {}", e))?
            } else {
                conn.query_row(
                    "SELECT COALESCE(SUM(m.amount_minor), 0) FROM cashbook_movements m JOIN money_accounts a ON m.account_id = a.id WHERE a.is_archived = 0 AND m.business_date < ?1;",
                    params![start],
                    |r| r.get(0),
                ).map_err(|e| format!("Failed to sum prior active movements: {}", e))?
            };
            base_opening.checked_add(prior_movs).ok_or_else(|| CashbookError::BalanceOverflow.to_string())?
        } else {
            base_opening
        }
    };

    let period_closing_balance = period_opening_balance
        .checked_add(period_inflows)
        .and_then(|b| b.checked_sub(period_outflows))
        .ok_or_else(|| CashbookError::BalanceOverflow.to_string())?;

    let summary = CashbookSummary {
        total_cash_minor,
        active_cash_minor,
        period_inflows_minor: period_inflows,
        period_outflows_minor: period_outflows,
        net_operating_cash_flow_minor: net_operating,
        opening_balance_minor: period_opening_balance,
        closing_balance_minor: period_closing_balance,
        matching_inflows_minor,
        matching_outflows_minor,
        matching_count,
    };

    Ok((entries, summary))
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

    #[test]
    fn test_untracked_product_cannot_have_opening_stock() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("untracked_stock_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        let err = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "SERVICE-01".to_string(),
                barcode: None,
                name: "Consultation Service".to_string(),
                description: None,
                category_id: None,
                unit: Some("hour".to_string()),
                unit_price_minor: 50000,
                cost_price_minor: None,
                tax_rate_bp: Some(1800),
                is_stock_tracked: Some(false),
                opening_stock_scaled: Some(5000), // Disallowed for untracked!
                min_stock_threshold_scaled: Some(0),
            }))
            .expect_err("Untracked products must reject positive opening stock");

        assert!(
            err.contains("Untracked products cannot have opening stock"),
            "Expected untracked opening stock error, got: {}",
            err
        );
    }

    #[test]
    fn test_enabling_tracking_fails_if_stock_diverges_from_ledger() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("tracking_transition_test.db");
        let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should start");

        // 1. Create untracked product with 0 stock
        let prod = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "ITEM-UNTRACKED".to_string(),
                barcode: None,
                name: "Untracked Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: 1000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: Some(false),
                opening_stock_scaled: Some(0),
                min_stock_threshold_scaled: Some(0),
            }))
            .expect("Product creation should succeed");

        // 2. Corrupt stock balance directly in DB to simulate phantom stock without ledger history
        {
            let conn = rusqlite::Connection::open(&db_path).expect("open raw conn");
            conn.execute(
                "UPDATE products SET current_stock_scaled = 5000 WHERE id = ?1;",
                rusqlite::params![prod.id],
            )
            .expect("corrupt stock");
        }

        // 3. Attempt to enable stock tracking on product with phantom stock
        let err = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: prod.id,
                sku: "ITEM-UNTRACKED".to_string(),
                barcode: None,
                name: "Untracked Item".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: 1000,
                cost_price_minor: 0,
                tax_rate_bp: 0,
                is_stock_tracked: true, // Enabling tracking!
                min_stock_threshold_scaled: 0,
            }))
            .expect_err("Enabling tracking with phantom stock must fail reconciliation");

        assert!(
            err.contains("diverges from ledger sum"),
            "Expected ledger divergence error, got: {}",
            err
        );
    }

    #[test]
    fn test_product_pricing_exceeding_max_money_minor_rejected() {
        use crate::domain::financial::MAX_MONEY_MINOR;

        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("price_bounds_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // Selling price > MAX_MONEY_MINOR rejected on create
        let err_price = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "EXP-PRICE".to_string(),
                barcode: None,
                name: "Expensive Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: MAX_MONEY_MINOR + 1,
                cost_price_minor: Some(100),
                tax_rate_bp: None,
                is_stock_tracked: Some(false),
                opening_stock_scaled: None,
                min_stock_threshold_scaled: None,
            }))
            .expect_err("Price exceeding MAX_MONEY_MINOR must be rejected");
        assert!(err_price.contains("selling price out of supported bounds"), "Expected price bounds error, got: {}", err_price);

        // Cost price > MAX_MONEY_MINOR rejected on create
        let err_cost = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "EXP-COST".to_string(),
                barcode: None,
                name: "Expensive Cost Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: 1000,
                cost_price_minor: Some(MAX_MONEY_MINOR + 1),
                tax_rate_bp: None,
                is_stock_tracked: Some(false),
                opening_stock_scaled: None,
                min_stock_threshold_scaled: None,
            }))
            .expect_err("Cost price exceeding MAX_MONEY_MINOR must be rejected");
        assert!(err_cost.contains("Cost price out of supported bounds"), "Expected cost bounds error, got: {}", err_cost);

        // Exact MAX_MONEY_MINOR accepted on create
        let created_max = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "MAX-PRICE".to_string(),
                barcode: None,
                name: "Max Bound Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: MAX_MONEY_MINOR,
                cost_price_minor: Some(MAX_MONEY_MINOR),
                tax_rate_bp: None,
                is_stock_tracked: Some(false),
                opening_stock_scaled: None,
                min_stock_threshold_scaled: None,
            }))
            .expect("Exact MAX_MONEY_MINOR must be accepted on creation");
        assert_eq!(created_max.unit_price_minor, MAX_MONEY_MINOR);
        assert_eq!(created_max.cost_price_minor, MAX_MONEY_MINOR);

        // Update with selling price > MAX_MONEY_MINOR rejected
        let err_update_price = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: created_max.id.clone(),
                sku: "MAX-PRICE".to_string(),
                barcode: None,
                name: "Max Bound Item".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: MAX_MONEY_MINOR + 1,
                cost_price_minor: 1000,
                tax_rate_bp: 0,
                is_stock_tracked: false,
                min_stock_threshold_scaled: 0,
            }))
            .expect_err("Selling price exceeding MAX_MONEY_MINOR on update must be rejected");
        assert!(err_update_price.contains("selling price out of supported bounds"), "Expected price bounds error on update, got: {}", err_update_price);

        // Update with cost price > MAX_MONEY_MINOR rejected
        let err_update_cost = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: created_max.id.clone(),
                sku: "MAX-PRICE".to_string(),
                barcode: None,
                name: "Max Bound Item".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: 1000,
                cost_price_minor: MAX_MONEY_MINOR + 1,
                tax_rate_bp: 0,
                is_stock_tracked: false,
                min_stock_threshold_scaled: 0,
            }))
            .expect_err("Cost price exceeding MAX_MONEY_MINOR on update must be rejected");
        assert!(err_update_cost.contains("Cost price out of supported bounds"), "Expected cost bounds error on update, got: {}", err_update_cost);

        // Update with exact MAX_MONEY_MINOR succeeds
        let updated_max = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: created_max.id.clone(),
                sku: "MAX-PRICE".to_string(),
                barcode: None,
                name: "Max Bound Item Updated".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: MAX_MONEY_MINOR,
                cost_price_minor: MAX_MONEY_MINOR,
                tax_rate_bp: 0,
                is_stock_tracked: false,
                min_stock_threshold_scaled: 0,
            }))
            .expect("Exact MAX_MONEY_MINOR on update must be accepted");
        assert_eq!(updated_max.unit_price_minor, MAX_MONEY_MINOR);
        assert_eq!(updated_max.cost_price_minor, MAX_MONEY_MINOR);
    }

    #[test]
    fn test_product_quantities_exceeding_max_quantity_scaled_rejected() {
        use crate::domain::financial::MAX_QUANTITY_SCALED;

        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("quantity_bounds_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // Opening stock > MAX_QUANTITY_SCALED rejected
        let err_open = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "QTY-OVERFLOW".to_string(),
                barcode: None,
                name: "Overflow Qty Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: 1000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: Some(true),
                opening_stock_scaled: Some(MAX_QUANTITY_SCALED + 1),
                min_stock_threshold_scaled: None,
            }))
            .expect_err("Opening stock exceeding MAX_QUANTITY_SCALED must be rejected");
        assert!(err_open.contains("Opening stock exceeds maximum supported quantity"), "Expected opening quantity bounds error, got: {}", err_open);

        // Min threshold > MAX_QUANTITY_SCALED rejected
        let err_thresh = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "THRESH-OVERFLOW".to_string(),
                barcode: None,
                name: "Overflow Threshold Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: 1000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: Some(true),
                opening_stock_scaled: Some(1000),
                min_stock_threshold_scaled: Some(MAX_QUANTITY_SCALED + 1),
            }))
            .expect_err("Min threshold exceeding MAX_QUANTITY_SCALED must be rejected");
        assert!(err_thresh.contains("Minimum stock threshold exceeds maximum supported quantity"), "Expected threshold bounds error, got: {}", err_thresh);

        // Exact MAX_QUANTITY_SCALED accepted on create
        let created_max = rt
            .block_on(worker.create_product(CreateProductDto {
                sku: "QTY-MAX".to_string(),
                barcode: None,
                name: "Max Qty Item".to_string(),
                description: None,
                category_id: None,
                unit: Some("pcs".to_string()),
                unit_price_minor: 1000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: Some(true),
                opening_stock_scaled: Some(MAX_QUANTITY_SCALED),
                min_stock_threshold_scaled: Some(MAX_QUANTITY_SCALED),
            }))
            .expect("Exact MAX_QUANTITY_SCALED must be accepted on creation");
        assert_eq!(created_max.current_stock_scaled, MAX_QUANTITY_SCALED);
        assert_eq!(created_max.min_stock_threshold_scaled, MAX_QUANTITY_SCALED);

        // Update with min threshold > MAX_QUANTITY_SCALED rejected
        let err_update_thresh = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: created_max.id.clone(),
                sku: "QTY-MAX".to_string(),
                barcode: None,
                name: "Max Qty Item".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: 1000,
                cost_price_minor: 0,
                tax_rate_bp: 0,
                is_stock_tracked: true,
                min_stock_threshold_scaled: MAX_QUANTITY_SCALED + 1,
            }))
            .expect_err("Min threshold exceeding MAX_QUANTITY_SCALED on update must be rejected");
        assert!(err_update_thresh.contains("Minimum stock threshold exceeds maximum supported quantity"), "Expected threshold bounds error on update, got: {}", err_update_thresh);

        // Update with exact MAX_QUANTITY_SCALED succeeds
        let updated_max = rt
            .block_on(worker.update_product(UpdateProductDto {
                id: created_max.id.clone(),
                sku: "QTY-MAX".to_string(),
                barcode: None,
                name: "Max Qty Item Updated".to_string(),
                description: None,
                category_id: None,
                unit: "pcs".to_string(),
                unit_price_minor: 1000,
                cost_price_minor: 0,
                tax_rate_bp: 0,
                is_stock_tracked: true,
                min_stock_threshold_scaled: MAX_QUANTITY_SCALED,
            }))
            .expect("Exact MAX_QUANTITY_SCALED on update must be accepted");
        assert_eq!(updated_max.min_stock_threshold_scaled, MAX_QUANTITY_SCALED);
    }

    #[test]
    fn test_category_name_case_insensitive_duplicate_rejected() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("category_nocase_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        let c1 = rt
            .block_on(worker.create_category(CreateCategoryDto {
                name: "Groceries".to_string(),
                description: Some("Supermarket groceries".to_string()),
            }))
            .expect("Create first category");
        assert_eq!(c1.name, "Groceries");

        let err = rt
            .block_on(worker.create_category(CreateCategoryDto {
                name: "groceries".to_string(), // lowercase duplicate!
                description: None,
            }))
            .expect_err("lowercase duplicate category name must be rejected");
        assert!(err.contains("already exists"), "Expected duplicate error, got: {}", err);

        let err_padded = rt
            .block_on(worker.create_category(CreateCategoryDto {
                name: "  GROCERIES  ".to_string(), // uppercase trimmed duplicate!
                description: None,
            }))
            .expect_err("trimmed uppercase duplicate category name must be rejected");
        assert!(err_padded.contains("already exists"), "Expected duplicate error, got: {}", err_padded);
    }

    #[test]
    fn test_appearance_preference_update_and_invalid_rejection() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("appearance_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // Initial default is 'system'
        let initial = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(initial.appearance_preference, "system");

        // Update to 'dark' succeeds
        let dark_res = rt.block_on(worker.update_appearance_preference("dark".to_string())).expect("update dark");
        assert_eq!(dark_res, "dark");
        let after_dark = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(after_dark.appearance_preference, "dark");

        // Update to 'light' succeeds
        let light_res = rt.block_on(worker.update_appearance_preference("light".to_string())).expect("update light");
        assert_eq!(light_res, "light");
        let after_light = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(after_light.appearance_preference, "light");

        // Invalid preference is rejected
        let invalid_err = rt.block_on(worker.update_appearance_preference("neon".to_string())).expect_err("invalid appearance must fail");
        assert!(invalid_err.contains("Invalid appearance preference"), "Expected error, got: {}", invalid_err);
    }

    #[test]
    fn test_guide_status_update_and_invalid_rejection() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("guide_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // Initial default is 'unseen'
        let initial = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(initial.guide_status, "unseen");
        assert_eq!(initial.guide_version, 1);

        // Update to 'skipped' succeeds
        let skip_res = rt.block_on(worker.update_guide_status("skipped".to_string(), 1)).expect("update skipped");
        assert_eq!(skip_res, "skipped");
        let after_skip = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(after_skip.guide_status, "skipped");

        // Update to 'completed' with version 2 succeeds
        let comp_res = rt.block_on(worker.update_guide_status("completed".to_string(), 2)).expect("update completed");
        assert_eq!(comp_res, "completed");
        let after_comp = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(after_comp.guide_status, "completed");
        assert_eq!(after_comp.guide_version, 2);

        // Invalid status is rejected
        let invalid_err = rt.block_on(worker.update_guide_status("dismissed".to_string(), 1)).expect_err("invalid status must fail");
        assert!(invalid_err.contains("Invalid guide status"), "Expected error, got: {}", invalid_err);
    }

    #[test]
    fn test_initial_business_setup_atomic_completion() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("setup_atomic_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        let settings = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert!(!settings.is_setup_completed, "Fresh settings must have is_setup_completed=false");

        // 1. Attempt save with invalid currency: must fail and NOT mark setup complete
        let mut invalid_settings = settings.clone();
        invalid_settings.currency_code = "XYZ".to_string();
        invalid_settings.is_setup_completed = true;
        let err = rt.block_on(worker.update_business_settings(invalid_settings)).expect_err("invalid currency must fail");
        assert!(err.contains("Unsupported currency code"), "Expected currency error, got: {}", err);

        let check_after_fail = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert!(!check_after_fail.is_setup_completed, "Setup must NOT be marked complete after failed save");

        // 2. Successful atomic setup for UAE / AED using complete_business_setup
        let profile = BusinessProfileDto {
            business_name: "Gulf Tech Supplies".to_string(),
            legal_name: None,
            tax_identifier: Some("100200300400003".to_string()),
            phone: "+971 50 123 4567".to_string(),
            email: None,
            address_line1: "Business Bay".to_string(),
            address_line2: None,
            city: "Dubai".to_string(),
            state: "Dubai".to_string(),
            postal_code: "".to_string(),
            country: "United Arab Emirates".to_string(),
            currency_code: "AED".to_string(),
            currency_symbol: "AED".to_string(),
            currency_exponent: 2,
            locale: "en-AE".to_string(),
            timezone: "Asia/Dubai".to_string(),
            invoice_prefix: "INV".to_string(),
            terms_and_conditions: None,
        };

        let saved = rt.block_on(worker.complete_business_setup(profile)).expect("complete setup");
        assert!(saved.is_setup_completed);
        assert_eq!(saved.business_name, "Gulf Tech Supplies");
        assert_eq!(saved.country, "United Arab Emirates");
        assert_eq!(saved.currency_code, "AED");
        assert_eq!(saved.timezone, "Asia/Dubai");

        let reloaded = rt.block_on(worker.get_business_settings()).expect("reload settings");
        assert!(reloaded.is_setup_completed);
        assert_eq!(reloaded.business_name, "Gulf Tech Supplies");
    }

    #[test]
    fn test_stale_profile_save_preserves_appearance_guide_and_setup_state() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("stale_save_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // 1. Initial setup complete + appearance set to 'dark' + guide status set to 'completed' v2
        let setup_profile = BusinessProfileDto {
            business_name: "Original Store".to_string(),
            legal_name: None,
            tax_identifier: None,
            phone: "+91 9999999999".to_string(),
            email: None,
            address_line1: "1st Avenue".to_string(),
            address_line2: None,
            city: "Kochi".to_string(),
            state: "Kerala".to_string(),
            postal_code: "682001".to_string(),
            country: "India".to_string(),
            currency_code: "INR".to_string(),
            currency_symbol: "₹".to_string(),
            currency_exponent: 2,
            locale: "en-IN".to_string(),
            timezone: "Asia/Kolkata".to_string(),
            invoice_prefix: "INV".to_string(),
            terms_and_conditions: None,
        };
        rt.block_on(worker.complete_business_setup(setup_profile)).expect("setup");
        rt.block_on(worker.update_appearance_preference("dark".to_string())).expect("dark");
        rt.block_on(worker.update_guide_status("completed".to_string(), 2)).expect("guide");

        let baseline = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert!(baseline.is_setup_completed);
        assert_eq!(baseline.appearance_preference, "dark");
        assert_eq!(baseline.guide_status, "completed");
        assert_eq!(baseline.guide_version, 2);

        // 2. Client performs an ordinary business profile save with a STALE DTO
        // simulating the browser holding old state: appearance='system', is_setup_completed=false, guide_status='unseen'
        let mut stale_dto = baseline.clone();
        stale_dto.business_name = "Renamed Store".to_string();
        stale_dto.appearance_preference = "system".to_string(); // Stale!
        stale_dto.is_setup_completed = false;                   // Stale!
        stale_dto.guide_status = "unseen".to_string();           // Stale!
        stale_dto.guide_version = 1;                             // Stale!

        let updated = rt.block_on(worker.update_business_settings(stale_dto)).expect("update business settings");

        // Profile field MUST be updated
        assert_eq!(updated.business_name, "Renamed Store");

        // Independently owned fields MUST be strictly preserved
        assert!(updated.is_setup_completed, "is_setup_completed must not be reset by stale profile save");
        assert_eq!(updated.appearance_preference, "dark", "appearance_preference must not be reset by stale profile save");
        assert_eq!(updated.guide_status, "completed", "guide_status must not be reset by stale profile save");
        assert_eq!(updated.guide_version, 2, "guide_version must not be reset by stale profile save");

        // Verify from fresh database query
        let from_db = rt.block_on(worker.get_business_settings()).expect("get settings");
        assert_eq!(from_db.business_name, "Renamed Store");
        assert!(from_db.is_setup_completed);
        assert_eq!(from_db.appearance_preference, "dark");
        assert_eq!(from_db.guide_status, "completed");
        assert_eq!(from_db.guide_version, 2);
    }

    #[test]
    fn test_interleaved_settings_updates() {
        let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
        let dir = tempdir().expect("failed to create tempdir");
        let db_path = dir.path().join("interleaved_test.db");
        let worker = DbWorkerHandle::new(db_path).expect("worker should start");

        // Interleave 1: Change appearance to dark
        rt.block_on(worker.update_appearance_preference("dark".to_string())).expect("set dark");

        // Interleave 2: Update business profile
        let profile1 = BusinessProfileDto {
            business_name: "Apex Trading".to_string(),
            legal_name: None,
            tax_identifier: None,
            phone: "+91 9876500000".to_string(),
            email: None,
            address_line1: "Main St".to_string(),
            address_line2: None,
            city: "Calicut".to_string(),
            state: "Kerala".to_string(),
            postal_code: "673001".to_string(),
            country: "India".to_string(),
            currency_code: "INR".to_string(),
            currency_symbol: "₹".to_string(),
            currency_exponent: 2,
            locale: "en-IN".to_string(),
            timezone: "Asia/Kolkata".to_string(),
            invoice_prefix: "APX".to_string(),
            terms_and_conditions: None,
        };
        let res1 = rt.block_on(worker.update_business_profile(profile1)).expect("update profile 1");
        assert_eq!(res1.appearance_preference, "dark");
        assert_eq!(res1.business_name, "Apex Trading");

        // Interleave 3: Change guide status to skipped
        rt.block_on(worker.update_guide_status("skipped".to_string(), 1)).expect("set guide");

        // Interleave 4: Change appearance to light
        rt.block_on(worker.update_appearance_preference("light".to_string())).expect("set light");

        // Interleave 5: Update business settings via legacy DTO
        let mut legacy_dto = res1;
        legacy_dto.address_line1 = "Second St".to_string();
        legacy_dto.appearance_preference = "dark".to_string(); // older view!
        let res2 = rt.block_on(worker.update_business_settings(legacy_dto)).expect("update legacy");

        assert_eq!(res2.address_line1, "Second St");
        assert_eq!(res2.appearance_preference, "light", "Should keep light from interleave 4");
        assert_eq!(res2.guide_status, "skipped", "Should keep skipped from interleave 3");
    }
}


