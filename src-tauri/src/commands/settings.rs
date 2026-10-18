use crate::db::worker::DbWorkerHandle;
use crate::domain::models::{BusinessProfileDto, BusinessSettings};
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

#[tauri::command]
pub async fn update_business_profile(
    worker: State<'_, DbWorkerHandle>,
    profile: BusinessProfileDto,
) -> Result<BusinessSettings, String> {
    worker.update_business_profile(profile).await
}

#[tauri::command]
pub async fn complete_business_setup(
    worker: State<'_, DbWorkerHandle>,
    profile: BusinessProfileDto,
) -> Result<BusinessSettings, String> {
    worker.complete_business_setup(profile).await
}


#[tauri::command]
pub async fn update_appearance_preference(
    worker: State<'_, DbWorkerHandle>,
    preference: String,
) -> Result<String, String> {
    worker.update_appearance_preference(preference).await
}

#[tauri::command]
pub async fn update_guide_status(
    worker: State<'_, DbWorkerHandle>,
    status: String,
    version: i32,
) -> Result<String, String> {
    worker.update_guide_status(status, version).await
}
