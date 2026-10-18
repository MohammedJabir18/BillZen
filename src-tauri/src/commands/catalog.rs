use crate::db::worker::DbWorkerHandle;
use crate::domain::catalog::{
    Category, CreateCategoryDto, CreateCustomerDto, CreateProductDto, Customer, CustomerFilter,
    Product, ProductFilter, UpdateCustomerDto, UpdateProductDto,
};
use tauri::State;

// Products
#[tauri::command]
pub async fn get_products(
    worker: State<'_, DbWorkerHandle>,
    filter: ProductFilter,
) -> Result<Vec<Product>, String> {
    worker.get_products(filter).await
}

#[tauri::command]
pub async fn create_product(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateProductDto,
) -> Result<Product, String> {
    worker.create_product(dto).await
}

#[tauri::command]
pub async fn update_product(
    worker: State<'_, DbWorkerHandle>,
    dto: UpdateProductDto,
) -> Result<Product, String> {
    worker.update_product(dto).await
}

#[tauri::command]
pub async fn archive_product(
    worker: State<'_, DbWorkerHandle>,
    id: String,
) -> Result<(), String> {
    worker.archive_product(id).await
}

#[tauri::command]
pub async fn restore_product(
    worker: State<'_, DbWorkerHandle>,
    id: String,
) -> Result<(), String> {
    worker.restore_product(id).await
}

// Customers
#[tauri::command]
pub async fn get_customers(
    worker: State<'_, DbWorkerHandle>,
    filter: CustomerFilter,
) -> Result<Vec<Customer>, String> {
    worker.get_customers(filter).await
}

#[tauri::command]
pub async fn create_customer(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateCustomerDto,
) -> Result<Customer, String> {
    worker.create_customer(dto).await
}

#[tauri::command]
pub async fn update_customer(
    worker: State<'_, DbWorkerHandle>,
    dto: UpdateCustomerDto,
) -> Result<Customer, String> {
    worker.update_customer(dto).await
}

#[tauri::command]
pub async fn archive_customer(
    worker: State<'_, DbWorkerHandle>,
    id: String,
) -> Result<(), String> {
    worker.archive_customer(id).await
}

#[tauri::command]
pub async fn restore_customer(
    worker: State<'_, DbWorkerHandle>,
    id: String,
) -> Result<(), String> {
    worker.restore_customer(id).await
}

// Categories
#[tauri::command]
pub async fn get_categories(
    worker: State<'_, DbWorkerHandle>,
) -> Result<Vec<Category>, String> {
    worker.get_categories().await
}

#[tauri::command]
pub async fn create_category(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateCategoryDto,
) -> Result<Category, String> {
    worker.create_category(dto).await
}
