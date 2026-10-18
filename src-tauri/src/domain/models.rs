use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BusinessSettings {
    pub id: String, // 'default'
    pub business_name: String,
    pub legal_name: Option<String>,
    pub tax_identifier: Option<String>,
    pub phone: String,
    pub email: Option<String>,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub country: String,
    pub currency_code: String,
    pub currency_symbol: String,
    pub currency_exponent: i32,
    pub locale: String,
    pub timezone: String,
    pub invoice_prefix: String,
    pub terms_and_conditions: Option<String>,
    pub is_setup_completed: bool,
    pub appearance_preference: String,
    pub guide_status: String,
    pub guide_version: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for BusinessSettings {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            id: "default".to_string(),
            business_name: "My Retail Store".to_string(),
            legal_name: None,
            tax_identifier: None,
            phone: "+91 9876543210".to_string(),
            email: None,
            address_line1: "123 Market Road".to_string(),
            address_line2: None,
            city: "Kochi".to_string(),
            state: "Kerala".to_string(),
            postal_code: "682001".to_string(),
            country: "IND".to_string(),
            currency_code: "INR".to_string(),
            currency_symbol: "₹".to_string(),
            currency_exponent: 2,
            locale: "en-IN".to_string(),
            timezone: "Asia/Kolkata".to_string(),
            invoice_prefix: "INV".to_string(),
            terms_and_conditions: Some("Thank you for your business!".to_string()),
            is_setup_completed: false,
            appearance_preference: "system".to_string(),
            guide_status: "unseen".to_string(),
            guide_version: 1,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BusinessProfileDto {
    pub business_name: String,
    pub legal_name: Option<String>,
    pub tax_identifier: Option<String>,
    pub phone: String,
    pub email: Option<String>,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub country: String,
    pub currency_code: String,
    pub currency_symbol: String,
    pub currency_exponent: i32,
    pub locale: String,
    pub timezone: String,
    pub invoice_prefix: String,
    pub terms_and_conditions: Option<String>,
}

