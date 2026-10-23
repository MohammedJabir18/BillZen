pub mod commands;
pub mod db;
pub mod domain;
pub mod updates;

use crate::db::worker::DbWorkerHandle;
use fs2::FileExt;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug)]
pub struct InstanceLock {
    file: File,
    pub lock_path: PathBuf,
}

impl Drop for InstanceLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

pub fn get_app_data_dir() -> PathBuf {
    if let Ok(custom) = std::env::var("BILLZEN_DATA_DIR") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("billzen")
}

pub fn acquire_instance_lock(app_data_dir: &Path) -> Result<InstanceLock, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create application data directory: {}", e))?;

    let lock_path = app_data_dir.join("billzen.lock");

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(&lock_path)
        .map_err(|e| format!("Failed to open single-instance lock file at {:?}: {}", lock_path, e))?;

    file.try_lock_exclusive().map_err(|e| {
        format!(
            "Another instance of BillZen is already running or holding lock at {:?}: {}",
            lock_path, e
        )
    })?;

    // Record the current process ID into the lockfile for operator diagnostics
    let mut file = file;
    let _ = file.set_len(0);
    let _ = writeln!(file, "pid: {}", std::process::id());
    let _ = file.flush();

    Ok(InstanceLock { file, lock_path })
}

fn acquire_instance_lock_for_startup(app_data_dir: &Path) -> Result<InstanceLock, String> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    loop {
        match acquire_instance_lock(app_data_dir) {
            Ok(lock) => return Ok(lock),
            Err(error) if error.starts_with("Another instance") && std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(error) => return Err(error),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(not(target_os = "android"))]
    let (desktop_lock, desktop_worker) = {
        let app_data_dir = get_app_data_dir();

        // Acquire single instance lock
        // Tauri spawns the restart successor just before the old process exits.
        // Wait briefly for the kernel to release its lock; never bypass a held lock.
        let lock = match acquire_instance_lock_for_startup(&app_data_dir) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[BillZen Fatal] Another instance of BillZen is already running or lock failed: {}", e);
                std::process::exit(1);
            }
        };

        let db_path = app_data_dir.join("billzen.db");
        let worker_handle = match DbWorkerHandle::new(db_path) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[BillZen Fatal] Failed to initialize database worker: {}", e);
                std::process::exit(1);
            }
        };

        (lock, worker_handle)
    };

    tauri::Builder::default()
        .manage(std::sync::Arc::new(commands::updates::UpdateService::default()))
        .setup(move |app| {
            #[cfg(not(target_os = "android"))]
            {
                #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
                {
                    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                    app.manage(std::sync::Arc::new(commands::desktop_updates::DesktopUpdateService::default()));
                }
                app.manage(desktop_lock);
                app.manage(desktop_worker);
            }

            #[cfg(target_os = "android")]
            {
                let app_data_dir = app.path().app_data_dir().map_err(|e| {
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to resolve Android app data dir: {}", e),
                    )) as Box<dyn std::error::Error>
                })?;
                std::fs::create_dir_all(&app_data_dir)?;

                let lock = acquire_instance_lock(&app_data_dir).map_err(|e| {
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to acquire instance lock on Android: {}", e),
                    )) as Box<dyn std::error::Error>
                })?;
                app.manage(lock);

                let db_path = app_data_dir.join("billzen.db");
                let worker_handle = DbWorkerHandle::new(db_path).map_err(|e| {
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to initialize Android database worker: {}", e),
                    )) as Box<dyn std::error::Error>
                })?;
                app.manage(worker_handle);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_business_settings,
            commands::settings::update_business_settings,
            commands::settings::update_business_profile,
            commands::settings::complete_business_setup,
            commands::settings::update_appearance_preference,
            commands::settings::update_guide_status,
            commands::system::check_print_support,

            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            commands::desktop_updates::get_desktop_update_status,
            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            commands::desktop_updates::check_desktop_update,
            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            commands::desktop_updates::download_desktop_update,
            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            commands::desktop_updates::install_desktop_update,
            #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
            commands::desktop_updates::cancel_desktop_update,
            commands::updates::get_update_status,
            commands::updates::cancel_update,
            commands::updates::check_android_update,
            commands::updates::download_android_update,
            commands::updates::prepare_android_update,
            commands::updates::resume_after_update,
            commands::system::ping,
            commands::catalog::get_products,
            commands::catalog::create_product,
            commands::catalog::update_product,
            commands::catalog::archive_product,
            commands::catalog::restore_product,
            commands::catalog::post_stock_adjustment,
            commands::catalog::get_stock_history,
            commands::catalog::get_customers,
            commands::catalog::create_customer,
            commands::catalog::update_customer,
            commands::catalog::archive_customer,
            commands::catalog::restore_customer,
            commands::catalog::get_categories,
            commands::catalog::create_category,

            commands::cashbook::get_money_accounts,
            commands::cashbook::create_money_account,
            commands::cashbook::update_money_account,
            commands::cashbook::get_cashbook_categories,
            commands::cashbook::create_cashbook_category,
            commands::cashbook::ensure_customer_cashbook_party,
            commands::cashbook::get_customer_cash_history,
            commands::cashbook::post_cashbook_transfer,
            commands::cashbook::reverse_cashbook_transfer,
            commands::cashbook::get_cashbook_transfers,

            commands::cashbook::get_cashbook_parties,
            commands::cashbook::create_cashbook_party,
            commands::cashbook::post_cashbook_voucher,
            commands::cashbook::reverse_cashbook_voucher,
            commands::cashbook::get_cashbook_ledger,
            commands::backup::export_workspace_backup,
            commands::backup::restore_workspace_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BillZen application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_single_instance_lock_mutual_exclusion_and_release() {
        let dir = tempdir().expect("failed to create tempdir");
        let dir_path = dir.path();

        // 1. First process / caller acquires the lock successfully
        let lock1 = acquire_instance_lock(dir_path);
        assert!(lock1.is_ok(), "First lock acquisition must succeed");
        let held_lock = lock1.unwrap();

        // 2. Second process / caller attempting to acquire the same lock MUST be rejected
        let lock2 = acquire_instance_lock(dir_path);
        assert!(
            lock2.is_err(),
            "Second lock acquisition while first is held must fail"
        );
        let err_msg = lock2.unwrap_err();
        assert!(
            err_msg.contains("Another instance of BillZen is already running"),
            "Error message must clearly communicate lock contention: {}",
            err_msg
        );

        // 3. Drop first lock (simulating process exit or termination)
        drop(held_lock);

        // 4. Third caller can now acquire the lock cleanly
        let lock3 = acquire_instance_lock(dir_path);
        assert!(
            lock3.is_ok(),
            "Subsequent lock acquisition after drop must succeed"
        );
    }

    #[test]
    fn test_restart_successor_waits_for_the_existing_kernel_lock() {
        let directory = tempdir().unwrap();
        let held = acquire_instance_lock(directory.path()).unwrap();
        let releaser = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(120));
            drop(held);
        });
        let successor = acquire_instance_lock_for_startup(directory.path()).unwrap();
        releaser.join().unwrap();
        assert!(acquire_instance_lock(directory.path()).is_err());
        drop(successor);
        assert!(acquire_instance_lock(directory.path()).is_ok());
    }

    #[test]
    fn test_database_worker_handshake_fails_on_inaccessible_path() {
        // A real file cannot be a parent directory on Linux, macOS or Windows.
        // /dev/null is not a reserved device path on Windows.
        let dir = tempfile::tempdir().expect("temporary fixture directory");
        let parent_file = dir.path().join("not-a-directory");
        std::fs::write(&parent_file, b"fixture").expect("fixture file");
        let invalid_path = parent_file.join("invalid.db");

        let handle = DbWorkerHandle::new(invalid_path);
        assert!(
            handle.is_err(),
            "DbWorkerHandle::new must fail handshake when database path is inaccessible"
        );

        let err = handle.err().unwrap();
        assert!(
            err.contains("Database initialization failed")
                || err.contains("terminated before completing initialization handshake"),
            "Error must clearly indicate database initialization failure: {}",
            err
        );
    }

    #[test]
    fn test_database_worker_handshake_succeeds_on_valid_temp_database() {
        let dir = tempdir().expect("failed to create tempdir");
        let valid_path = dir.path().join("test_handshake.db");

        let handle = DbWorkerHandle::new(valid_path);
        assert!(
            handle.is_ok(),
            "DbWorkerHandle::new must succeed handshake on accessible database path"
        );
    }

    #[test]
    fn test_configuration_verification_window_capabilities_allow_main_and_deny_unprivileged() {
        // Read capability files to verify window-level permission boundaries (Configuration Verification)
        let default_cap_str = include_str!("../capabilities/default.json");
        let unpriv_cap_str = include_str!("../capabilities/unprivileged.json");

        let default_cap: serde_json::Value =
            serde_json::from_str(default_cap_str).expect("default.json must be valid JSON");
        let unpriv_cap: serde_json::Value =
            serde_json::from_str(unpriv_cap_str).expect("unprivileged.json must be valid JSON");

        // 1. Verify main window has full app-command permissions
        let main_windows = default_cap["windows"]
            .as_array()
            .expect("windows must be an array");
        assert!(main_windows.iter().any(|w| w.as_str() == Some("main")));

        let main_perms = default_cap["permissions"]
            .as_array()
            .expect("permissions must be an array");
        let main_perms_str: Vec<&str> = main_perms.iter().filter_map(|p| p.as_str()).collect();

        assert!(main_perms_str.contains(&"allow-get-business-settings"));
        assert!(main_perms_str.contains(&"allow-update-business-settings"));
        assert!(main_perms_str.contains(&"allow-update-appearance-preference"));
        assert!(main_perms_str.contains(&"allow-update-guide-status"));
        assert!(main_perms_str.contains(&"allow-check-print-support"));
        assert!(main_perms_str.contains(&"allow-ping"));
        assert!(main_perms_str.contains(&"allow-get-products"));
        assert!(main_perms_str.contains(&"allow-create-product"));
        assert!(main_perms_str.contains(&"allow-update-product"));
        assert!(main_perms_str.contains(&"allow-archive-product"));
        assert!(main_perms_str.contains(&"allow-restore-product"));
        assert!(main_perms_str.contains(&"allow-get-customers"));
        assert!(main_perms_str.contains(&"allow-create-customer"));
        assert!(main_perms_str.contains(&"allow-update-customer"));
        assert!(main_perms_str.contains(&"allow-archive-customer"));
        assert!(main_perms_str.contains(&"allow-restore-customer"));
        assert!(main_perms_str.contains(&"allow-get-categories"));
        assert!(main_perms_str.contains(&"allow-create-category"));
        assert!(main_perms_str.contains(&"allow-get-money-accounts"));
        assert!(main_perms_str.contains(&"allow-create-money-account"));
        assert!(main_perms_str.contains(&"allow-update-money-account"));
        assert!(main_perms_str.contains(&"allow-get-cashbook-categories"));
        assert!(main_perms_str.contains(&"allow-create-cashbook-category"));
        assert!(main_perms_str.contains(&"allow-get-cashbook-parties"));
        assert!(main_perms_str.contains(&"allow-create-cashbook-party"));
        assert!(main_perms_str.contains(&"allow-post-cashbook-voucher"));
        assert!(main_perms_str.contains(&"allow-reverse-cashbook-voucher"));
        assert!(main_perms_str.contains(&"allow-get-cashbook-ledger"));

        // 2. Verify unprivileged window is DENIED custom app-commands
        let unpriv_windows = unpriv_cap["windows"]
            .as_array()
            .expect("windows must be an array");
        assert!(unpriv_windows
            .iter()
            .any(|w| w.as_str() == Some("unprivileged-window")));

        let unpriv_perms = unpriv_cap["permissions"]
            .as_array()
            .expect("permissions must be an array");
        let unpriv_perms_str: Vec<&str> = unpriv_perms.iter().filter_map(|p| p.as_str()).collect();

        assert!(!unpriv_perms_str.contains(&"allow-get-business-settings"));
        assert!(!unpriv_perms_str.contains(&"allow-update-business-settings"));
        assert!(!unpriv_perms_str.contains(&"allow-update-appearance-preference"));
        assert!(!unpriv_perms_str.contains(&"allow-update-guide-status"));
        assert!(!unpriv_perms_str.contains(&"allow-check-print-support"));
        assert!(!unpriv_perms_str.contains(&"allow-ping"));
        assert!(!unpriv_perms_str.contains(&"allow-get-products"));
        assert!(!unpriv_perms_str.contains(&"allow-create-product"));
        assert!(!unpriv_perms_str.contains(&"allow-get-customers"));
        assert!(!unpriv_perms_str.contains(&"allow-create-customer"));
        assert!(!unpriv_perms_str.contains(&"allow-get-categories"));
        assert!(!unpriv_perms_str.contains(&"allow-create-category"));
    }

    #[test]
    fn test_get_app_data_dir_environment_override() {
        let test_dir = "/tmp/billzen_custom_isolated_test_dir";
        std::env::set_var("BILLZEN_DATA_DIR", test_dir);
        assert_eq!(get_app_data_dir(), PathBuf::from(test_dir));

        std::env::remove_var("BILLZEN_DATA_DIR");
        let default_dir = get_app_data_dir();
        assert!(default_dir.ends_with("billzen"));
    }
}
