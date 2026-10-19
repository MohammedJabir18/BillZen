use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub const MAX_MONEY_MINOR: i64 = 100_000_000_000; // 10^11
pub const MAX_TOTAL_MINOR: i64 = 100_000_000_000_000; // 10^14 (< Number.MAX_SAFE_INTEGER = 9*10^15)

#[derive(Debug, Error, PartialEq, Eq, Clone, Serialize, Deserialize)]
pub enum CashbookError {
    #[error("Amount {0} exceeds maximum permissible money minor {1}")]
    AmountExceedsMaximum(i64, i64),
    #[error("Amount must be strictly positive: {0}")]
    NonPositiveAmount(i64),
    #[error("Arithmetic overflow computing cashbook balance")]
    BalanceOverflow,
    #[error("Balance {0} exceeds maximum permissible total minor {1}")]
    BalanceExceedsMaximum(i64, i64),
    #[error("Account not found: {0}")]
    AccountNotFound(String),
    #[error("Voucher not found: {0}")]
    VoucherNotFound(String),
    #[error("Voucher is already reversed: {0}")]
    VoucherAlreadyReversed(String),
    #[error("Cannot reverse a reversal voucher: {0}")]
    CannotReverseReversal(String),
    #[error("Voucher {0} cannot be reversed because it is not in posted state")]
    CannotReverseNonPosted(String),
    #[error("Idempotency key conflict: identical key used with different payload")]
    IdempotencyKeyConflict,
    #[error("Operation requires confirmation: account balance would become negative ({projected_balance_minor})")]
    RequiresConfirmation {
        current_balance_minor: i64,
        amount_minor: i64,
        projected_balance_minor: i64,
    },
    #[error("Invalid business date format (expected YYYY-MM-DD): {0}")]
    InvalidDateFormat(String),
    #[error("Database error: {0}")]
    Database(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    Cash,
    Bank,
    Wallet,
    Other,
}

impl AccountType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AccountType::Cash => "cash",
            AccountType::Bank => "bank",
            AccountType::Wallet => "wallet",
            AccountType::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "cash" => Some(AccountType::Cash),
            "bank" => Some(AccountType::Bank),
            "wallet" => Some(AccountType::Wallet),
            "other" => Some(AccountType::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CategoryType {
    Income,
    Expense,
    Both,
}

impl CategoryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CategoryType::Income => "income",
            CategoryType::Expense => "expense",
            CategoryType::Both => "both",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "income" => Some(CategoryType::Income),
            "expense" => Some(CategoryType::Expense),
            "both" => Some(CategoryType::Both),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PartyType {
    Customer,
    Supplier,
    Employee,
    Owner,
    Lender,
    Other,
}

impl PartyType {
    pub fn as_str(&self) -> &'static str {
        match self {
            PartyType::Customer => "customer",
            PartyType::Supplier => "supplier",
            PartyType::Employee => "employee",
            PartyType::Owner => "owner",
            PartyType::Lender => "lender",
            PartyType::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "customer" => Some(PartyType::Customer),
            "supplier" => Some(PartyType::Supplier),
            "employee" => Some(PartyType::Employee),
            "owner" => Some(PartyType::Owner),
            "lender" => Some(PartyType::Lender),
            "other" => Some(PartyType::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MovementDirection {
    Inflow,
    Outflow,
}

impl MovementDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            MovementDirection::Inflow => "inflow",
            MovementDirection::Outflow => "outflow",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "inflow" => Some(MovementDirection::Inflow),
            "outflow" => Some(MovementDirection::Outflow),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CashbookClassification {
    OperatingIncome,
    OperatingExpense,
    Capital,
    Loan,
    Advance,
    Refund,
    Transfer,
    OpeningBalance,
}

impl CashbookClassification {
    pub fn as_str(&self) -> &'static str {
        match self {
            CashbookClassification::OperatingIncome => "operating_income",
            CashbookClassification::OperatingExpense => "operating_expense",
            CashbookClassification::Capital => "capital",
            CashbookClassification::Loan => "loan",
            CashbookClassification::Advance => "advance",
            CashbookClassification::Refund => "refund",
            CashbookClassification::Transfer => "transfer",
            CashbookClassification::OpeningBalance => "opening_balance",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "operating_income" => Some(CashbookClassification::OperatingIncome),
            "operating_expense" => Some(CashbookClassification::OperatingExpense),
            "capital" => Some(CashbookClassification::Capital),
            "loan" => Some(CashbookClassification::Loan),
            "advance" => Some(CashbookClassification::Advance),
            "refund" => Some(CashbookClassification::Refund),
            "transfer" => Some(CashbookClassification::Transfer),
            "opening_balance" => Some(CashbookClassification::OpeningBalance),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Cash,
    Upi,
    Card,
    BankTransfer,
    Cheque,
    Other,
}

impl PaymentMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentMethod::Cash => "cash",
            PaymentMethod::Upi => "upi",
            PaymentMethod::Card => "card",
            PaymentMethod::BankTransfer => "bank_transfer",
            PaymentMethod::Cheque => "cheque",
            PaymentMethod::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "cash" => Some(PaymentMethod::Cash),
            "upi" => Some(PaymentMethod::Upi),
            "card" => Some(PaymentMethod::Card),
            "bank_transfer" => Some(PaymentMethod::BankTransfer),
            "cheque" => Some(PaymentMethod::Cheque),
            "other" => Some(PaymentMethod::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VoucherStatus {
    Draft,
    Posted,
    Reversed,
}

impl VoucherStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            VoucherStatus::Draft => "draft",
            VoucherStatus::Posted => "posted",
            VoucherStatus::Reversed => "reversed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(VoucherStatus::Draft),
            "posted" => Some(VoucherStatus::Posted),
            "reversed" => Some(VoucherStatus::Reversed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoneyAccount {
    pub id: String,
    pub account_name: String,
    pub account_type: AccountType,
    pub opening_balance_minor: i64,
    pub allow_negative_balance: bool,
    pub currency_code: String,
    pub currency_exponent: i32,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_or_routing: Option<String>,
    pub is_archived: bool,
    pub current_balance_minor: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookCategory {
    pub id: String,
    pub name: String,
    pub category_type: CategoryType,
    pub is_default: bool,
    pub is_archived: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookParty {
    pub id: String,
    pub name: String,
    pub party_type: PartyType,
    pub customer_id: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub is_archived: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookVoucher {
    pub id: String,
    pub voucher_number: String,
    pub idempotency_key: String,
    pub payload_hash: String,
    pub account_id: String,
    pub party_id: Option<String>,
    pub category_id: Option<String>,
    pub direction: MovementDirection,
    pub classification: CashbookClassification,
    pub payment_method: PaymentMethod,
    pub amount_minor: i64,
    pub business_date: String,
    pub status: VoucherStatus,
    pub is_reversal: bool,
    pub reversal_for_voucher_id: Option<String>,
    pub is_reversed: bool,
    pub reversed_by_voucher_id: Option<String>,
    pub reversed_at: Option<i64>,
    pub reference_note: Option<String>,
    pub notes: Option<String>,
    pub business_name_snap: Option<String>,
    pub business_tax_id_snap: Option<String>,
    pub business_address_snap: Option<String>,
    pub business_phone_snap: Option<String>,
    pub party_name_snap: Option<String>,
    pub party_phone_snap: Option<String>,
    pub party_tax_id_snap: Option<String>,
    pub party_address_snap: Option<String>,
    pub account_name_snap: Option<String>,
    pub currency_code_snap: Option<String>,
    pub currency_exponent_snap: i32,
    pub amount_in_words_snap: Option<String>,
    pub created_at: i64,
    pub posted_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookMovement {
    pub id: String,
    pub voucher_id: String,
    pub account_id: String,
    pub amount_minor: i64,
    pub business_date: String,
    pub sequence_number: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVoucherInput {
    pub account_id: String,
    pub direction: MovementDirection,
    pub classification: CashbookClassification,
    pub payment_method: PaymentMethod,
    pub amount_minor: i64,
    pub business_date: String,
    pub party_id: Option<String>,
    pub category_id: Option<String>,
    pub reference_note: Option<String>,
    pub notes: Option<String>,
    pub idempotency_key: String,
    pub confirmed_negative_balance: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PostVoucherResult {
    Posted(CashbookVoucher),
    RequiresConfirmation {
        current_balance_minor: i64,
        amount_minor: i64,
        projected_balance_minor: i64,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookLedgerEntry {
    pub voucher: CashbookVoucher,
    pub movement: CashbookMovement,
    pub running_balance_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashbookSummary {
    pub total_cash_minor: i64,
    pub period_inflows_minor: i64,
    pub period_outflows_minor: i64,
    pub net_operating_cash_flow_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMoneyAccountDto {
    pub account_name: String,
    pub account_type: String,
    pub opening_balance_minor: i64,
    pub allow_negative_balance: bool,
    pub currency_code: Option<String>,
    pub currency_exponent: Option<i32>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_or_routing: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMoneyAccountDto {
    pub id: String,
    pub account_name: String,
    pub allow_negative_balance: bool,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_or_routing: Option<String>,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCashbookCategoryDto {
    pub name: String,
    pub category_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCashbookPartyDto {
    pub name: String,
    pub party_type: String,
    pub customer_id: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CashbookLedgerFilter {
    pub account_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub classification: Option<String>,
    pub search: Option<String>,
}

pub fn validate_money_amount(amount: i64) -> Result<(), CashbookError> {
    if amount <= 0 {
        return Err(CashbookError::NonPositiveAmount(amount));
    }
    if amount > MAX_MONEY_MINOR {
        return Err(CashbookError::AmountExceedsMaximum(amount, MAX_MONEY_MINOR));
    }
    Ok(())
}

pub fn calculate_running_balance(opening: i64, movements: &[i64]) -> Result<i64, CashbookError> {
    if opening.abs() > MAX_MONEY_MINOR {
        return Err(CashbookError::AmountExceedsMaximum(opening.abs(), MAX_MONEY_MINOR));
    }
    let mut total: i128 = opening as i128;
    for &m in movements {
        total = total.checked_add(m as i128).ok_or(CashbookError::BalanceOverflow)?;
        if total.abs() > MAX_TOTAL_MINOR as i128 {
            return Err(CashbookError::BalanceExceedsMaximum(total as i64, MAX_TOTAL_MINOR));
        }
    }
    Ok(total as i64)
}

pub fn compute_client_intent_hash(input: &CreateVoucherInput) -> String {
    let mut hasher = Sha256::new();
    let norm = format!(
        "{{\"account_id\":\"{}\",\"amount_minor\":{},\"business_date\":\"{}\",\"category_id\":{},\"classification\":\"{}\",\"direction\":\"{}\",\"notes\":{},\"party_id\":{},\"payment_method\":\"{}\",\"reference_note\":{}}}",
        input.account_id,
        input.amount_minor,
        input.business_date,
        input.category_id.as_deref().map(|s| format!("\"{}\"", s)).unwrap_or_else(|| "null".to_string()),
        input.classification.as_str(),
        input.direction.as_str(),
        input.notes.as_deref().map(|s| format!("\"{}\"", s)).unwrap_or_else(|| "null".to_string()),
        input.party_id.as_deref().map(|s| format!("\"{}\"", s)).unwrap_or_else(|| "null".to_string()),
        input.payment_method.as_str(),
        input.reference_note.as_deref().map(|s| format!("\"{}\"", s)).unwrap_or_else(|| "null".to_string()),
    );
    hasher.update(norm.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn format_voucher_number(prefix: &str, year_month: &str, seq: i64) -> String {
    format!("{}-{}-{:05}", prefix, year_month, seq)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_money_amount_validation() {
        assert!(validate_money_amount(1).is_ok());
        assert!(validate_money_amount(MAX_MONEY_MINOR).is_ok());
        assert_eq!(validate_money_amount(0), Err(CashbookError::NonPositiveAmount(0)));
        assert_eq!(validate_money_amount(-100), Err(CashbookError::NonPositiveAmount(-100)));
        assert_eq!(
            validate_money_amount(MAX_MONEY_MINOR + 1),
            Err(CashbookError::AmountExceedsMaximum(MAX_MONEY_MINOR + 1, MAX_MONEY_MINOR))
        );
    }

    #[test]
    fn test_running_balance_calculation() {
        // Opening 5,000 + 1,000 = 6,000
        let bal = calculate_running_balance(500000, &[100000]).unwrap();
        assert_eq!(bal, 600000);

        // Opening 0 + 10,000 - 2,500 = 7,500
        let bal2 = calculate_running_balance(0, &[1000000, -250000]).unwrap();
        assert_eq!(bal2, 750000);

        // Reversal of -2,500 (+2,500) -> 10,000
        let bal3 = calculate_running_balance(0, &[1000000, -250000, 250000]).unwrap();
        assert_eq!(bal3, 1000000);
    }

    #[test]
    fn test_voucher_number_formatting() {
        assert_eq!(format_voucher_number("RCP", "202610", 1), "RCP-202610-00001");
        assert_eq!(format_voucher_number("PAY", "202610", 42), "PAY-202610-00042");
        assert_eq!(format_voucher_number("RCP-REV", "202610", 1), "RCP-REV-202610-00001");
    }

    #[test]
    fn test_client_intent_hash_stability() {
        let input1 = CreateVoucherInput {
            account_id: "acc-1".to_string(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100000,
            business_date: "2026-10-19".to_string(),
            party_id: Some("party-1".to_string()),
            category_id: Some("cat-1".to_string()),
            reference_note: Some("REF123".to_string()),
            notes: Some("Test note".to_string()),
            idempotency_key: "key-1".to_string(),
            confirmed_negative_balance: false,
        };

        let hash1 = compute_client_intent_hash(&input1);
        let hash2 = compute_client_intent_hash(&input1);
        assert_eq!(hash1, hash2, "Identical input must produce identical hash");

        let mut input2 = input1.clone();
        input2.amount_minor = 100001;
        let hash3 = compute_client_intent_hash(&input2);
        assert_ne!(hash1, hash3, "Altered amount must produce different hash");
    }
}
