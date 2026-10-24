//! Local editor recovery is separate from authoritative saved invoices and workspace backups.
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recovery_is_atomic_local_and_rejects_invalid_content_without_losing_previous() {
        let dir = tempfile::tempdir().unwrap();
        let value = serde_json::json!({"schema":1,"source_id":"draft-id","source_version":3,"form":{"notes":"Unsaved edit"},"pending":null});
        assert!(read(dir.path()).unwrap().is_none());
        write(dir.path(), Some(value.clone())).unwrap();
        assert_eq!(read(dir.path()).unwrap(), Some(value.clone()));
        assert!(write(dir.path(),Some(serde_json::json!({"schema":1,"source_id":"draft-id","source_version":null,"form":{}}))).is_err());
        assert_eq!(read(dir.path()).unwrap(), Some(value));
        write(dir.path(), None).unwrap();
        assert!(read(dir.path()).unwrap().is_none());
    }
}
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;
static LOCK: Mutex<()> = Mutex::new(());
fn validate(value: &Value) -> Result<(), String> {
    if value["schema"] != 1
        || !value["form"].is_object()
        || !(value["source_id"].is_null() && value["source_version"].is_null()
            || value["source_id"].as_str().is_some_and(|s| !s.is_empty())
                && value["source_version"].as_i64().is_some_and(|v| v > 0))
    {
        return Err("Invalid draft editor recovery".into());
    }
    Ok(())
}
fn read(directory: &Path) -> Result<Option<Value>, String> {
    let _guard = LOCK.lock().map_err(|_| "Draft recovery unavailable")?;
    let path = directory.join("invoice-draft-editor.json");
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > 1_000_000 {
        return Err("Draft recovery too large".into());
    }
    let value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    validate(&value)?;
    Ok(Some(value))
}
fn write(directory: &Path, value: Option<Value>) -> Result<(), String> {
    let bytes = if let Some(v) = value {
        validate(&v)?;
        let b = serde_json::to_vec(&v).map_err(|e| e.to_string())?;
        if b.len() > 1_000_000 {
            return Err("Draft recovery too large".into());
        }
        Some(b)
    } else {
        None
    };
    let _guard = LOCK.lock().map_err(|_| "Draft recovery unavailable")?;
    let path = directory.join("invoice-draft-editor.json");
    if let Some(bytes) = bytes {
        std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
        let temp = directory.join("invoice-draft-editor.partial");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&temp)
            .map_err(|e| e.to_string())?;
        use std::io::Write;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        std::fs::rename(temp, path).map_err(|e| e.to_string())?;
    } else if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn recovery_directory(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        let _ = app;
        Ok(crate::get_app_data_dir())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        use tauri::Manager;
        app.path().app_data_dir().map_err(|e| e.to_string())
    }
}
#[tauri::command]
pub async fn get_draft_editor_recovery(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let path = recovery_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || read(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn set_draft_editor_recovery(
    app: tauri::AppHandle,
    value: Option<Value>,
) -> Result<(), String> {
    let path = recovery_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || write(&path, value))
        .await
        .map_err(|e| e.to_string())?
}
