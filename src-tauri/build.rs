fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "get_business_settings",
                "update_business_settings",
                "check_print_support",
                "ping",
                "get_products",
                "create_product",
                "update_product",
                "archive_product",
                "restore_product",
                "get_customers",
                "create_customer",
                "update_customer",
                "archive_customer",
                "restore_customer",
                "get_categories",
                "create_category",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
