use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintSupportInfo {
    pub platform: String,
    pub native_dialog_available: bool,
    pub cups_detected: bool,
    pub in_app_preview_supported: bool,
    pub empirical_status: String,
    pub notes: String,
}

#[tauri::command]
pub fn check_print_support() -> Result<PrintSupportInfo, String> {
    // Check if CUPS / lp / lpr utilities exist in PATH
    let cups_detected = std::process::Command::new("which")
        .arg("lp")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
        || std::process::Command::new("which")
            .arg("lpr")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

    let is_linux = cfg!(target_os = "linux");
    let has_display = std::env::var("DISPLAY").is_ok() || std::env::var("WAYLAND_DISPLAY").is_ok();

    Ok(PrintSupportInfo {
        platform: std::env::consts::OS.to_string(),
        native_dialog_available: is_linux && has_display,
        cups_detected,
        in_app_preview_supported: true,
        empirical_status: "unverified".to_string(),
        notes: "Native GTK/WebKit print dialog is available for dispatch, but remains unverified until empirical dialog observation is confirmed by the operator. In-app A4 CSS preview is fully supported.".to_string(),
    })
}

#[tauri::command]
pub fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}
