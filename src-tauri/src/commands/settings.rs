use crate::db::worker::DbWorkerHandle;
use crate::domain::models::BusinessSettings;
use tauri::State;

#[tauri::command]
pub async fn get_business_settings(
    worker: State<'_, DbWorkerHandle>,
) -> Result<BusinessSettings, String> {
    worker.get_business_settings().await
}

#[tauri::command]
pub async fn update_business_settings(
    worker: State<'_, DbWorkerHandle>,
    settings: BusinessSettings,
) -> Result<BusinessSettings, String> {
    worker.update_business_settings(settings).await
}
