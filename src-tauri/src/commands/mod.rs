pub mod catalog;
pub mod settings;
pub mod system;
pub mod cashbook;
pub mod backup;

pub mod updates;

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
pub mod desktop_updates;

pub mod invoice_drafts;
