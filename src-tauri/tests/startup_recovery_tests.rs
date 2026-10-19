use billzen_lib::db::initialize_database;
use rusqlite::Connection;
use tempfile::tempdir;

#[test]
fn populated_wal_workspace_is_snapshotted_before_pending_migration() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("billzen.db");
    let original = initialize_database(&path).unwrap();
    original.execute_batch("PRAGMA wal_autocheckpoint=0; CREATE TABLE recovery_probe(value TEXT); INSERT INTO recovery_probe VALUES ('committed-in-wal'); DELETE FROM schema_migrations WHERE version=8;").unwrap();
    let upgraded = initialize_database(&path).unwrap();
    let backups: Vec<_> = std::fs::read_dir(dir.path().join("recovery")).expect("pre-migration recovery directory").map(|e|e.unwrap().path()).collect();
    assert_eq!(backups.len(), 1);
    let snapshot = Connection::open(&backups[0]).unwrap();
    let old_version: i64 = snapshot.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get(0)).unwrap();
    assert_eq!(old_version, 7, "snapshot must precede migrations");
    let value: String = snapshot.query_row("SELECT value FROM recovery_probe",[],|r|r.get(0)).unwrap();
    assert_eq!(value,"committed-in-wal");
    let version: i64 = upgraded.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get(0)).unwrap();
    assert_eq!(version,8);
    drop(upgraded);
    let _ = initialize_database(&path).unwrap();
    assert_eq!(std::fs::read_dir(dir.path().join("recovery")).unwrap().count(),1,"normal launches must not create repeated snapshots");
}

#[test]
fn recovery_failure_prevents_any_migration() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("billzen.db");
    let original = initialize_database(&path).unwrap();
    original.execute("DELETE FROM schema_migrations WHERE version=8",[]).unwrap();
    std::fs::write(dir.path().join("recovery"),"directory blocked").unwrap();
    assert!(initialize_database(&path).is_err(),"must not migrate without recovery snapshot");
    let version:i64 = original.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get(0)).unwrap();
    assert_eq!(version,7);
}

#[test]
fn installer_snapshot_serializes_writes_until_cancelled() {
    let dir=tempdir().unwrap();
    let worker=billzen_lib::db::worker::DbWorkerHandle::new(dir.path().join("billzen.db")).unwrap();
    let rt=tokio::runtime::Builder::new_current_thread().build().unwrap();
    let path=rt.block_on(worker.prepare_update()).unwrap();
    assert!(path.is_file());
    assert!(rt.block_on(worker.get_business_settings()).is_err(),"worker must remain quiescent until installer returns");
    rt.block_on(worker.resume_after_update()).unwrap();
    assert!(rt.block_on(worker.get_business_settings()).is_ok());
}
