//! Desktop updater state lives in Rust; webviews cannot supply artifacts or bypass verification.
use crate::db::worker::DbWorkerHandle;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::watch;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateInfo {
    status: String,
    message: String,
    version: Option<String>,
    notes: Option<String>,
    downloaded_bytes: u64,
    total_bytes: u64,
}
impl DesktopUpdateInfo {
    fn new(status: &str, message: &str) -> Self {
        Self {
            status: status.into(),
            message: message.into(),
            version: None,
            notes: None,
            downloaded_bytes: 0,
            total_bytes: 0,
        }
    }
}
#[derive(Default)]
pub struct DesktopUpdateService(Mutex<DesktopState>);
struct DesktopState {
    info: DesktopUpdateInfo,
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
    busy: bool,
    generation: u64,
    cancel: Option<watch::Sender<bool>>,
}
impl Default for DesktopState {
    fn default() -> Self {
        Self {
            info: DesktopUpdateInfo::new("idle", "Check for updates when online."),
            update: None,
            bytes: None,
            busy: false,
            generation: 0,
            cancel: None,
        }
    }
}
struct Operation {
    service: Arc<DesktopUpdateService>,
    generation: u64,
    cancelled: watch::Receiver<bool>,
}
impl Drop for Operation {
    fn drop(&mut self) {
        if let Ok(mut state) = self.service.0.lock() {
            state.busy = false;
            state.cancel = None;
        }
    }
}
impl DesktopUpdateService {
    fn begin(self: &Arc<Self>, status: &str, message: &str) -> Result<Operation, String> {
        let mut state = self.0.lock().map_err(|_| "Update state unavailable")?;
        if state.busy {
            return Err("An update operation is already running".into());
        }
        if status == "downloading" && state.update.is_none() {
            return Err("Check for an update first".into());
        }
        if status == "installing"
            && (state.info.status != "ready" || state.bytes.is_none() || state.update.is_none())
        {
            return Err("Download and verify the update before installing".into());
        }
        if status == "checking" {
            state.update = None;
            state.bytes = None;
            state.info = DesktopUpdateInfo::new(status, message);
        }
        if status == "downloading" {
            state.bytes = None;
            state.info.downloaded_bytes = 0;
            state.info.total_bytes = 0;
        }
        state.info.status = status.into();
        state.info.message = message.into();
        state.busy = true;
        state.generation += 1;
        let (cancel, cancelled) = watch::channel(false);
        state.cancel = Some(cancel);
        Ok(Operation {
            service: self.clone(),
            generation: state.generation,
            cancelled,
        })
    }
    fn cancel(&self) -> Result<DesktopUpdateInfo, String> {
        let mut state = self.0.lock().map_err(|_| "Update state unavailable")?;
        if state.info.status == "installing" {
            return Err("Installation has started and cannot be cancelled".into());
        }
        if let Some(cancel) = &state.cancel {
            let _ = cancel.send(true);
        }
        state.generation += 1;
        state.update = None;
        state.bytes = None;
        state.info = DesktopUpdateInfo::new("cancelled", "Update cancelled. Check again to retry.");
        Ok(state.info.clone())
    }
}
impl Operation {
    fn mutate(&self, f: impl FnOnce(&mut DesktopState)) -> Result<DesktopUpdateInfo, String> {
        let mut state = self
            .service
            .0
            .lock()
            .map_err(|_| "Update state unavailable")?;
        if state.generation == self.generation {
            f(&mut state);
        }
        Ok(state.info.clone())
    }
    fn fail(&self, message: String) -> Result<DesktopUpdateInfo, String> {
        self.mutate(|s| {
            s.bytes = None;
            s.info.status = "error".into();
            s.info.message = message;
        })
    }
}

#[tauri::command]
pub fn get_desktop_update_status(
    service: State<'_, Arc<DesktopUpdateService>>,
) -> Result<DesktopUpdateInfo, String> {
    service
        .inner()
        .0
        .lock()
        .map(|s| s.info.clone())
        .map_err(|_| "Update state unavailable".into())
}
#[tauri::command]
pub fn cancel_desktop_update(
    service: State<'_, Arc<DesktopUpdateService>>,
) -> Result<DesktopUpdateInfo, String> {
    service.cancel()
}

#[tauri::command]
pub async fn check_desktop_update(
    app: tauri::AppHandle,
    service: State<'_, Arc<DesktopUpdateService>>,
) -> Result<DesktopUpdateInfo, String> {
    let mut operation = service
        .inner()
        .begin("checking", "Checking for an update…")?;
    if let Err(message) = supported_installation(&app) {
        return operation.mutate(|s| s.info = DesktopUpdateInfo::new("unavailable", &message));
    }
    let updater = match app
        .updater_builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(updater) => updater,
        Err(e) => {
            return operation.fail(format!(
                "Signed desktop update delivery is unavailable: {e}"
            ))
        }
    };
    let result = tokio::select! {
        _ = operation.cancelled.changed() => return operation.mutate(|_| {}),
        result = updater.check() => result,
    };
    match result {
        Ok(Some(mut update)) => {
            if let Err(message) = validate_release_url(&update.download_url, &update.version) {
                return operation.fail(message);
            }
            update.timeout = Some(std::time::Duration::from_secs(600));
            operation.mutate(|s| {
                s.info = DesktopUpdateInfo {
                    version: Some(update.version.clone()),
                    notes: update.body.clone(),
                    ..DesktopUpdateInfo::new(
                        "available",
                        "An update is available. Download it to verify its signature.",
                    )
                };
                s.update = Some(update);
            })
        }
        Ok(None) => operation.mutate(|s| {
            s.info = DesktopUpdateInfo::new("current", "You have the latest available version.")
        }),
        Err(e) => operation.fail(format!("Could not check for updates: {e}")),
    }
}
#[tauri::command]
pub async fn download_desktop_update(
    service: State<'_, Arc<DesktopUpdateService>>,
) -> Result<DesktopUpdateInfo, String> {
    let mut operation = service
        .inner()
        .begin("downloading", "Downloading and verifying the update…")?;
    let update = service
        .inner()
        .0
        .lock()
        .map_err(|_| "Update state unavailable")?
        .update
        .clone()
        .ok_or("Check for an update first")?;
    let progress_service = service.inner().clone();
    let generation = operation.generation;
    let (too_large, mut size_limit) = watch::channel(false);
    let result = tokio::select! {
        biased;
        _ = operation.cancelled.changed() => return operation.mutate(|_| {}),
        _ = size_limit.changed() => return operation.fail("Update exceeds the 256 MiB download limit. Install the release manually.".into()),
        result = update.download(move |chunk, total| {
            if let Ok(mut state) = progress_service.0.lock() {
                if state.generation == generation {
                    state.info.downloaded_bytes = state.info.downloaded_bytes.saturating_add(chunk as u64);
                    state.info.total_bytes = total.unwrap_or(0);
                    if state.info.downloaded_bytes > MAX_DOWNLOAD_BYTES || total.is_some_and(|size| size > MAX_DOWNLOAD_BYTES) { let _ = too_large.send(true); }
                }
            }
        }, || {}) => result,
    };
    match result {
        Ok(bytes) if bytes.len() as u64 > MAX_DOWNLOAD_BYTES => operation.fail(
            "Update exceeds the 256 MiB download limit. Install the release manually.".into(),
        ),
        Ok(bytes) => operation.mutate(|s| {
            // The plugin only returns bytes after its pinned-key signature check succeeds.
            s.info.downloaded_bytes = bytes.len() as u64;
            s.info.total_bytes = bytes.len() as u64;
            s.bytes = Some(bytes);
            s.info.status = "ready".into();
            s.info.message =
                "Signature verified. Save your work before installing and restarting.".into();
        }),
        Err(e) => operation.fail(format!("Download or signature verification failed: {e}")),
    }
}
#[tauri::command]
pub async fn install_desktop_update(
    app: tauri::AppHandle,
    service: State<'_, Arc<DesktopUpdateService>>,
    worker: State<'_, DbWorkerHandle>,
) -> Result<(), String> {
    let operation = service
        .inner()
        .begin("installing", "Backing up data and installing the update…")?;
    let result = async {
        supported_installation(&app)?;
        worker.prepare_update().await?;
        let (update, bytes) = {
            let mut state = service
                .inner()
                .0
                .lock()
                .map_err(|_| "Update state unavailable")?;
            (
                state.update.clone().ok_or("Verified update unavailable")?,
                state.bytes.take().ok_or("Verified download unavailable")?,
            )
        };
        tauri::async_runtime::spawn_blocking(move || {
            update
                .install(bytes)
                .map_err(|e| format!("Could not install update: {e}"))
        })
        .await
        .map_err(|e| e.to_string())?
    }
    .await;
    if let Err(message) = result {
        let resume = worker.resume_after_update().await;
        let message = match resume {
            Ok(()) => message,
            Err(e) => format!("{message}. Could not resume database: {e}"),
        };
        operation.fail(message.clone())?;
        return Err(message);
    }
    // Windows installation exits the process itself. Unix installation replaces the bundle.
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    app.restart();
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    Ok(())
}

const MAX_DOWNLOAD_BYTES: u64 = 256 * 1024 * 1024;
fn validate_release_url(url: &reqwest::Url, version: &str) -> Result<(), String> {
    let prefix = format!("/MohammedJabir18/BillZen/releases/download/v{version}/");
    let filename = url.path().strip_prefix(&prefix).unwrap_or("");
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || filename.is_empty()
        || filename.contains('/')
        || filename.contains('%')
        || semver::Version::parse(version).is_err()
    {
        return Err("The update download is not an immutable BillZen release artifact.".into());
    }
    Ok(())
}
fn writable_directory(path: &std::path::Path) -> Result<(), String> {
    use std::io::Write;
    let probe = path.join(format!(".billzen-update-{}", uuid::Uuid::new_v4()));
    let result = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .and_then(|mut file| file.write_all(b"update permission check"));
    let _ = std::fs::remove_file(probe);
    result.map_err(|e| format!("The installation folder is not writable: {e}. Move BillZen to a writable installation folder or install the release manually."))
}
fn supported_installation(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use tauri::Manager;
        let image = app.env().appimage.clone().ok_or("In-app Linux updates require the AppImage edition. Debian packages and standalone executables must be updated manually.")?;
        validate_appimage_path(std::path::Path::new(&image))?;
    }
    #[cfg(target_os = "macos")]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let bundle = exe
            .ancestors()
            .find(|p| p.extension().is_some_and(|ext| ext == "app"))
            .ok_or("Run BillZen from its installed application bundle.")?;
        writable_directory(bundle.parent().ok_or("Application folder unavailable")?)?;
        writable_directory(bundle)?;
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    let _ = app;
    Ok(())
}
#[cfg(target_os = "linux")]
fn validate_appimage_path(image: &std::path::Path) -> Result<(), String> {
    if !image.is_file() {
        return Err("The running AppImage is unavailable. Install the release manually.".into());
    }
    std::fs::OpenOptions::new()
        .write(true)
        .open(image)
        .map_err(|e| format!("The AppImage is not writable: {e}. Install the release manually."))?;
    writable_directory(image.parent().ok_or("AppImage folder unavailable")?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn release_url_is_bound_to_billzen_immutable_version_and_https() {
        let accepted = "https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.7/BillZen.AppImage.tar.gz";
        assert!(validate_release_url(&accepted.parse().unwrap(), "0.1.7").is_ok());
        for rejected in [
            "http://github.com/MohammedJabir18/BillZen/releases/download/v0.1.7/app",
            "https://evil.example/MohammedJabir18/BillZen/releases/download/v0.1.7/app",
            "https://github.com/Other/BillZen/releases/download/v0.1.7/app",
            "https://github.com/MohammedJabir18/BillZen/releases/latest/download/app",
            "https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.6/app",
            "https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.7/app?redirect=1",
        ] {
            assert!(
                validate_release_url(&rejected.parse().unwrap(), "0.1.7").is_err(),
                "{rejected}"
            );
        }
    }
    #[test]
    fn operations_are_serialized_and_cancel_invalidates_late_results() {
        let service = Arc::new(DesktopUpdateService::default());
        let op = service.begin("checking", "checking").unwrap();
        assert!(service.begin("checking", "again").is_err());
        assert_eq!(service.cancel().unwrap().status, "cancelled");
        op.mutate(|s| s.info.status = "available".into()).unwrap();
        assert_eq!(service.0.lock().unwrap().info.status, "cancelled");
        drop(op);
        assert!(service.begin("checking", "retry").is_ok());
    }
    #[test]
    fn install_requires_verified_download_and_cannot_be_cancelled() {
        let service = Arc::new(DesktopUpdateService::default());
        assert!(service.begin("installing", "install").is_err());
        assert!(service.begin("downloading", "download").is_err());
        service.0.lock().unwrap().info.status = "installing".into();
        assert!(service.cancel().is_err());
    }
    #[test]
    fn cancelling_discards_download_buffers() {
        let service = DesktopUpdateService::default();
        service.0.lock().unwrap().bytes = Some(vec![1, 2, 3]);
        service.cancel().unwrap();
        assert!(service.0.lock().unwrap().bytes.is_none());
    }
    #[cfg(target_os = "linux")]
    #[test]
    fn appimage_guard_rejects_missing_runtime_path() {
        let directory = tempfile::tempdir().unwrap();
        assert!(validate_appimage_path(&directory.path().join("missing.AppImage")).is_err());
        assert!(validate_appimage_path(directory.path()).is_err());
        let image = directory.path().join("BillZen.AppImage");
        std::fs::write(&image, b"fixture").unwrap();
        assert!(validate_appimage_path(&image).is_ok());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }
}
