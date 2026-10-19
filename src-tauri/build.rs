fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "get_business_settings",
                "update_business_settings",
                "update_business_profile",
                "complete_business_setup",
                "update_appearance_preference",
                "update_guide_status",
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

                "get_money_accounts",
                "create_money_account",
                "update_money_account",
                "get_cashbook_categories",
                "create_cashbook_category",
                "get_cashbook_parties",
                "create_cashbook_party",
                "post_cashbook_voucher",
                "reverse_cashbook_voucher",
                "get_cashbook_ledger",
                "export_workspace_backup",
                "restore_workspace_backup",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
