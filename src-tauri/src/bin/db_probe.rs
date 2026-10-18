use billzen_lib::db::worker::DbWorkerHandle;
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: db_probe <db_path> [read|write]");
        std::process::exit(2);
    }
    let db_path = PathBuf::from(&args[1]);
    let action = args.get(2).map(|s| s.as_str()).unwrap_or("read");

    let worker = DbWorkerHandle::new(db_path).expect("Failed to initialize worker handle");

    if action == "read" {
        let settings = worker.get_business_settings().await.expect("Failed to read settings");
        println!(
            "READ: id={}, name='{}', phone='{}', city='{}'",
            settings.id, settings.business_name, settings.phone, settings.city
        );
    } else if action == "write" {
        let mut settings = worker.get_business_settings().await.expect("Failed to read settings");
        settings.business_name = "Kochi Organic Supermarket".to_string();
        settings.phone = "+91 9447001122".to_string();
        settings.city = "Ernakulam".to_string();
        let updated = worker.update_business_settings(settings).await.expect("Failed to save settings");
        println!(
            "WRITTEN: id={}, name='{}', phone='{}', city='{}'",
            updated.id, updated.business_name, updated.phone, updated.city
        );
    }
}
