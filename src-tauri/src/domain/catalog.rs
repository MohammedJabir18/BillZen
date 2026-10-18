use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CatalogError {
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("A product with SKU '{0}' already exists (including archived). Please use a unique SKU.")]
    DuplicateSku(String),
    #[error("A product with Barcode '{0}' already exists. Please use a unique Barcode.")]
    DuplicateBarcode(String),
    #[error("Product not found: {0}")]
    ProductNotFound(String),
    #[error("Customer not found: {0}")]
    CustomerNotFound(String),
    #[error("Category not found: {0}")]
    CategoryNotFound(String),
    #[error("A category with name '{0}' already exists.")]
    DuplicateCategory(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Normalizes a SKU: trims whitespace, upper-cases, and validates non-empty.
pub fn normalize_sku(raw: &str) -> Result<String, CatalogError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(CatalogError::ValidationError("SKU cannot be empty".to_string()));
    }
    // Limit to reasonable length and non-control characters
    if trimmed.len() > 64 {
        return Err(CatalogError::ValidationError("SKU must not exceed 64 characters".to_string()));
    }
    Ok(trimmed.to_uppercase())
}

/// Normalizes a barcode: trims whitespace, PRESERVES leading zeros, returns None if empty.
pub fn normalize_barcode(raw: Option<&str>) -> Result<Option<String>, CatalogError> {
    match raw {
        None => Ok(None),
        Some(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                if trimmed.len() > 64 {
                    return Err(CatalogError::ValidationError("Barcode must not exceed 64 characters".to_string()));
                }
                // Disallow control characters
                if trimmed.chars().any(|c| c.is_control()) {
                    return Err(CatalogError::ValidationError("Barcode contains invalid characters".to_string()));
                }
                Ok(Some(trimmed.to_string()))
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryDto {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Product {
    pub id: String,
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub unit: String,
    pub unit_price_minor: i64,
    pub cost_price_minor: i64,
    pub tax_rate_bp: i64,
    pub is_stock_tracked: bool,
    pub current_stock_scaled: i64,
    pub min_stock_threshold_scaled: i64,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductDto {
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub unit: Option<String>,
    pub unit_price_minor: i64,
    pub cost_price_minor: Option<i64>,
    pub tax_rate_bp: Option<i64>,
    pub is_stock_tracked: Option<bool>,
    pub opening_stock_scaled: Option<i64>,
    pub min_stock_threshold_scaled: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProductDto {
    pub id: String,
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub unit: String,
    pub unit_price_minor: i64,
    pub cost_price_minor: i64,
    pub tax_rate_bp: i64,
    pub is_stock_tracked: bool,
    pub min_stock_threshold_scaled: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductFilter {
    pub search: Option<String>,
    pub category_id: Option<String>,
    pub is_active: Option<bool>,
    pub low_stock_only: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: String,
    pub tax_identifier: Option<String>,
    pub current_balance_minor: i64,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCustomerDto {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub tax_identifier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCustomerDto {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: String,
    pub tax_identifier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomerFilter {
    pub search: Option<String>,
    pub is_active: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sku_normalization() {
        assert_eq!(normalize_sku("  sku-123-abc  ").unwrap(), "SKU-123-ABC");
        assert_eq!(normalize_sku("item_01").unwrap(), "ITEM_01");
        assert!(normalize_sku("   ").is_err());
        assert!(normalize_sku("").is_err());
    }

    #[test]
    fn test_barcode_normalization_preserves_leading_zeros() {
        assert_eq!(normalize_barcode(Some(" 001234567890 ")).unwrap(), Some("001234567890".to_string()));
        assert_eq!(normalize_barcode(Some("079357318765")).unwrap(), Some("079357318765".to_string()));
        assert_eq!(normalize_barcode(Some("   ")).unwrap(), None);
        assert_eq!(normalize_barcode(None).unwrap(), None);
    }
}
