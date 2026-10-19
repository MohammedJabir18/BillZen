use crate::db::backup::RestoreBackupResult;
use crate::db::worker::DbWorkerHandle;
use tauri::State;

#[tauri::command]
pub async fn export_workspace_backup(
    worker: State<'_, DbWorkerHandle>,
) -> Result<serde_json::Value, String> {
    worker.export_workspace_backup().await
}

#[tauri::command]
pub async fn restore_workspace_backup(
    worker: State<'_, DbWorkerHandle>,
    backup_json: serde_json::Value,
) -> Result<RestoreBackupResult, String> {
    worker.restore_workspace_backup(backup_json).await
}
