#[test]
fn desktop_commands_are_main_only_without_raw_plugin_permissions() {
    let main: serde_json::Value =
        serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
    let other: serde_json::Value =
        serde_json::from_str(include_str!("../capabilities/unprivileged.json")).unwrap();
    assert_eq!(main["windows"], serde_json::json!(["main"]));
    for command in [
        "get-desktop-update-status",
        "check-desktop-update",
        "download-desktop-update",
        "install-desktop-update",
        "cancel-desktop-update",
    ] {
        let permission = format!("allow-{command}");
        assert!(main["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p == &permission));
        assert!(!other["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p == &permission));
    }
    for capability in [main, other] {
        assert!(!capability["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p.as_str().unwrap_or("").starts_with("updater:")));
    }
}

#[test]
fn install_preparation_checkpoints_wal_and_preserves_snapshot_before_pause() {
    use billzen_lib::db::worker::DbWorkerHandle;
    let directory = tempfile::tempdir().unwrap();
    let database = directory.path().join("billzen.db");
    let worker = DbWorkerHandle::new(database.clone()).unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime
        .block_on(worker.update_appearance_preference("dark".into()))
        .unwrap();
    let wal = database.with_extension("db-wal");
    assert!(wal.metadata().unwrap().len() > 0);
    let backup = runtime.block_on(worker.prepare_update()).unwrap();
    assert_eq!(
        wal.metadata().unwrap().len(),
        0,
        "installation must checkpoint the WAL before pausing"
    );
    let snapshot = rusqlite::Connection::open(backup).unwrap();
    let preference: String = snapshot
        .query_row(
            "SELECT appearance_preference FROM business_settings",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(preference, "dark");
    assert!(runtime
        .block_on(worker.update_appearance_preference("light".into()))
        .is_err());
    runtime.block_on(worker.resume_after_update()).unwrap();
    runtime
        .block_on(worker.update_appearance_preference("light".into()))
        .unwrap();
}

#[test]
fn failed_recovery_snapshot_leaves_database_writable() {
    use billzen_lib::db::worker::DbWorkerHandle;
    let directory = tempfile::tempdir().unwrap();
    let worker = DbWorkerHandle::new(directory.path().join("billzen.db")).unwrap();
    std::fs::write(directory.path().join("recovery"), b"directory blocked").unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    assert!(runtime.block_on(worker.prepare_update()).is_err());
    runtime
        .block_on(worker.update_appearance_preference("dark".into()))
        .unwrap();
    assert_eq!(
        runtime
            .block_on(worker.get_business_settings())
            .unwrap()
            .appearance_preference,
        "dark"
    );
}
