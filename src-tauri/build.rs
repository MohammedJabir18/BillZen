fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "get_business_settings",
                "update_business_settings",
                "check_print_support",
                "ping",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
