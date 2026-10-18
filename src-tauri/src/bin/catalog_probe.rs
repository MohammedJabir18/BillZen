use billzen_lib::db::worker::DbWorkerHandle;
use billzen_lib::domain::catalog::{
    CreateCategoryDto, CreateCustomerDto, CreateProductDto, CustomerFilter, ProductFilter,
    UpdateProductDto,
};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: catalog_probe <db_path> [write|read_and_verify]");
        std::process::exit(2);
    }

    let db_path = PathBuf::from(&args[1]);
    let action = &args[2];

    let worker = DbWorkerHandle::new(db_path.clone())
        .expect("Failed to initialize database worker in catalog probe");

    if action == "write" {
        println!("[catalog_probe:write] Starting write phase on {:?}", db_path);

        // 1. Create a category
        let cat = worker
            .create_category(CreateCategoryDto {
                name: "Grains & Staples".to_string(),
                description: Some("Rice, wheat, pulses, and dry staples".to_string()),
            })
            .await
            .expect("Failed to create category");
        println!("[catalog_probe:write] Category created: id={}, name={}", cat.id, cat.name);

        // 2. Create product with leading zero barcode and opening stock
        let prod = worker
            .create_product(CreateProductDto {
                sku: "BASMATI-5KG".to_string(),
                barcode: Some("0012345678905".to_string()),
                name: "Royal Basmati Rice 5kg".to_string(),
                description: Some("Aged aromatic long grain basmati rice".to_string()),
                category_id: Some(cat.id.clone()),
                unit: Some("bag".to_string()),
                unit_price_minor: 45000, // 450.00
                cost_price_minor: Some(38000), // 380.00
                tax_rate_bp: Some(500), // 5%
                is_stock_tracked: Some(true),
                opening_stock_scaled: Some(25500), // 25.500
                min_stock_threshold_scaled: Some(5000), // 5.000
            })
            .await
            .expect("Failed to create product with opening stock");
        println!(
            "[catalog_probe:write] Product created: id={}, sku={}, barcode={:?}, stock={}",
            prod.id, prod.sku, prod.barcode, prod.current_stock_scaled
        );

        // 3. Create customer with international phone and tax ID
        let cust = worker
            .create_customer(CreateCustomerDto {
                name: "Al-Nuaimi Trading LLC".to_string(),
                phone: Some("+971 50 123 4567".to_string()),
                email: Some("procurement@nuaimi.ae".to_string()),
                address_line1: Some("Sheikh Zayed Road".to_string()),
                address_line2: Some("Level 14, Tower B".to_string()),
                city: Some("Dubai".to_string()),
                state: Some("Dubai".to_string()),
                postal_code: Some("00000".to_string()),
                country: Some("United Arab Emirates".to_string()),
                tax_identifier: Some("100200300400003".to_string()),
            })
            .await
            .expect("Failed to create customer");
        println!(
            "[catalog_probe:write] Customer created: id={}, name={}, phone={:?}, tax_id={:?}",
            cust.id, cust.name, cust.phone, cust.tax_identifier
        );

        // 4. Archive customer to test state preservation across restart
        worker
            .archive_customer(cust.id.clone())
            .await
            .expect("Failed to archive customer");
        println!("[catalog_probe:write] Customer archived successfully");

        // 5. Test update product (ensuring current_stock_scaled is untouched)
        let updated_prod = worker
            .update_product(UpdateProductDto {
                id: prod.id.clone(),
                sku: "BASMATI-5KG".to_string(),
                barcode: Some("0012345678905".to_string()),
                name: "Royal Basmati Rice 5kg (Premium Reserve)".to_string(),
                description: Some("Updated reserve quality".to_string()),
                category_id: Some(cat.id.clone()),
                unit: "bag".to_string(),
                unit_price_minor: 48000,
                cost_price_minor: 40000,
                tax_rate_bp: 500,
                is_stock_tracked: true,
                min_stock_threshold_scaled: 6000,
            })
            .await
            .expect("Failed to update product");
        assert_eq!(
            updated_prod.current_stock_scaled, 25500,
            "Product update must preserve current stock without modification"
        );
        println!("[catalog_probe:write] Product updated, stock preserved at {}", updated_prod.current_stock_scaled);

        println!("[catalog_probe:write] Completed successfully. Terminating process (quit)...");
    } else if action == "read_and_verify" {
        println!("[catalog_probe:read_and_verify] Fresh process started, reading from {:?}", db_path);

        // 1. Fetch categories
        let cats = worker.get_categories().await.expect("Failed to read categories");
        assert_eq!(cats.len(), 1, "Expected exactly 1 category");
        assert_eq!(cats[0].name, "Grains & Staples");
        println!("[catalog_probe:read_and_verify] Category verified: {}", cats[0].name);

        // 2. Fetch products
        let prods = worker
            .get_products(ProductFilter {
                search: Some("0012345678905".to_string()),
                ..Default::default()
            })
            .await
            .expect("Failed to query product by barcode");
        assert_eq!(prods.len(), 1, "Expected exactly 1 product matching barcode");
        let p = &prods[0];

        assert_eq!(p.sku, "BASMATI-5KG");
        assert_eq!(p.barcode.as_deref(), Some("0012345678905"), "Leading zero in barcode must be intact!");
        assert_eq!(p.name, "Royal Basmati Rice 5kg (Premium Reserve)");
        assert_eq!(p.unit_price_minor, 48000);
        assert_eq!(p.current_stock_scaled, 25500);
        assert_eq!(p.category_name.as_deref(), Some("Grains & Staples"));
        assert!(p.is_active);
        println!("[catalog_probe:read_and_verify] Product verified: sku={}, barcode={:?}, stock={}, price={}", p.sku, p.barcode, p.current_stock_scaled, p.unit_price_minor);

        // 3. Verify opening stock movement in SQLite ledger
        {
            let conn = rusqlite::Connection::open(&db_path).expect("Failed to open db directly for ledger audit");
            let (ref_type, delta, resulting): (String, i64, i64) = conn
                .query_row(
                    "SELECT reference_type, quantity_delta_scaled, resulting_stock_scaled FROM stock_movements WHERE product_id = ?1;",
                    rusqlite::params![p.id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .expect("Stock movement record must exist in SQLite ledger");
            assert_eq!(ref_type, "opening");
            assert_eq!(delta, 25500);
            assert_eq!(resulting, 25500);
            println!("[catalog_probe:read_and_verify] Stock movement ledger verified: ref_type={}, delta={}, resulting={}", ref_type, delta, resulting);
        }

        // 4. Fetch customers (both active and archived)
        let active_custs = worker
            .get_customers(CustomerFilter {
                search: Some("Nuaimi".to_string()),
                is_active: Some(true),
            })
            .await
            .expect("Failed to search active customers");
        assert_eq!(active_custs.len(), 0, "Archived customer must not appear in active search");

        let all_custs = worker
            .get_customers(CustomerFilter {
                search: Some("Nuaimi".to_string()),
                is_active: None,
            })
            .await
            .expect("Failed to search all customers");
        assert_eq!(all_custs.len(), 1, "Customer must exist in all records");
        let c = &all_custs[0];
        assert_eq!(c.name, "Al-Nuaimi Trading LLC");
        assert_eq!(c.phone.as_deref(), Some("+971 50 123 4567"), "International phone prefix must be preserved");
        assert_eq!(c.country, "United Arab Emirates");
        assert_eq!(c.tax_identifier.as_deref(), Some("100200300400003"));
        assert!(!c.is_active, "Customer archived status must persist");
        println!("[catalog_probe:read_and_verify] Customer verified: name={}, phone={:?}, country={}, tax_id={:?}, is_active={}", c.name, c.phone, c.country, c.tax_identifier, c.is_active);

        // 5. Test backend invariant: Duplicate SKU rejection
        let dup_sku_err = worker
            .create_product(CreateProductDto {
                sku: "basmati-5kg".to_string(), // case-insensitive duplicate
                barcode: Some("999999999999".to_string()),
                name: "Duplicate Sku Test".to_string(),
                description: None,
                category_id: None,
                unit: None,
                unit_price_minor: 10000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: None,
                opening_stock_scaled: None,
                min_stock_threshold_scaled: None,
            })
            .await
            .expect_err("Duplicate SKU must be rejected by backend");
        assert!(dup_sku_err.contains("already exists"), "Error must report SKU uniqueness violation: {}", dup_sku_err);
        println!("[catalog_probe:read_and_verify] Duplicate SKU rejected: {}", dup_sku_err);

        // 6. Test backend invariant: Duplicate Barcode rejection
        let dup_bc_err = worker
            .create_product(CreateProductDto {
                sku: "DIFFERENT-SKU".to_string(),
                barcode: Some("0012345678905".to_string()), // duplicate barcode
                name: "Duplicate Barcode Test".to_string(),
                description: None,
                category_id: None,
                unit: None,
                unit_price_minor: 10000,
                cost_price_minor: None,
                tax_rate_bp: None,
                is_stock_tracked: None,
                opening_stock_scaled: None,
                min_stock_threshold_scaled: None,
            })
            .await
            .expect_err("Duplicate Barcode must be rejected by backend");
        assert!(dup_bc_err.contains("already exists"), "Error must report Barcode uniqueness violation: {}", dup_bc_err);
        println!("[catalog_probe:read_and_verify] Duplicate Barcode rejected: {}", dup_bc_err);

        println!("[catalog_probe:read_and_verify] ALL NATIVE VERIFICATION CHECKS PASSED!");
    } else {
        eprintln!("Unknown action: {}", action);
        std::process::exit(1);
    }
}
