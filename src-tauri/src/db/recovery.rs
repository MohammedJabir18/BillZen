//! WAL-safe recovery before migrations, including externally installed bootstrap upgrades.
use super::{run_integrity_check, DbError};
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};

pub const CURRENT_SCHEMA_VERSION: i64 = 9;

pub fn snapshot(source: &Connection, directory: &Path, label: &str) -> Result<PathBuf, DbError> {
    std::fs::create_dir_all(directory)?;
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(directory, std::fs::Permissions::from_mode(0o700))?;
    }
    let name = format!("{}-{}-{}", label, chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4());
    let partial = directory.join(format!("{}.partial", name));
    let destination = directory.join(format!("{}.db", name));
    let result = (|| {
        source.backup(rusqlite::MAIN_DB, &partial, None)?;
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&partial, std::fs::Permissions::from_mode(0o600))?;
        }
        // A standalone recovery file must not depend on WAL sidecars.
        let verify = Connection::open(&partial)?;
        verify.pragma_update(None, "journal_mode", "DELETE")?;
        run_integrity_check(&verify)?;
        drop(verify);
        std::fs::OpenOptions::new().read(true).write(true).open(&partial)?.sync_all()?;
        std::fs::rename(&partial, &destination)?;
        Ok(destination)
    })();
    if result.is_err() { let _ = std::fs::remove_file(&partial); }
    result
}

pub fn before_migrations(path: &Path) -> Result<Option<PathBuf>, DbError> {
    if !path.exists() || path.metadata()?.len() == 0 { return Ok(None); }
    let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let has_ledger: bool = source.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations')", [], |r|r.get(0))?;
    let version = if has_ledger {
        source.query_row("SELECT COALESCE(MAX(version),0) FROM schema_migrations",[],|r|r.get::<_,i64>(0))?
    } else { 0 };
    if version >= CURRENT_SCHEMA_VERSION { return Ok(None); }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    snapshot(&source, &parent.join("recovery"), &format!("before-schema-{}-to-{}",version,CURRENT_SCHEMA_VERSION)).map(Some)
}
