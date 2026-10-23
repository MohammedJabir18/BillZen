use crate::db::worker::DbWorkerHandle;
use crate::domain::cashbook::*;
use tauri::State;

#[tauri::command]
pub async fn get_money_accounts(
    worker: State<'_, DbWorkerHandle>,
) -> Result<Vec<MoneyAccount>, String> {
    worker.get_money_accounts().await
}

#[tauri::command]
pub async fn create_money_account(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateMoneyAccountDto,
) -> Result<MoneyAccount, String> {
    worker.create_money_account(dto).await
}

#[tauri::command]
pub async fn update_money_account(
    worker: State<'_, DbWorkerHandle>,
    dto: UpdateMoneyAccountDto,
) -> Result<MoneyAccount, String> {
    worker.update_money_account(dto).await
}

#[tauri::command]
pub async fn get_cashbook_categories(
    worker: State<'_, DbWorkerHandle>,
) -> Result<Vec<CashbookCategory>, String> {
    worker.get_cashbook_categories().await
}

#[tauri::command]
pub async fn create_cashbook_category(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateCashbookCategoryDto,
) -> Result<CashbookCategory, String> {
    worker.create_cashbook_category(dto).await
}

#[tauri::command]
pub async fn get_cashbook_parties(
    worker: State<'_, DbWorkerHandle>,
) -> Result<Vec<CashbookParty>, String> {
    worker.get_cashbook_parties().await
}

#[tauri::command]
pub async fn create_cashbook_party(
    worker: State<'_, DbWorkerHandle>,
    dto: CreateCashbookPartyDto,
) -> Result<CashbookParty, String> {
    worker.create_cashbook_party(dto).await
}

#[tauri::command]
pub async fn post_cashbook_voucher(
    worker: State<'_, DbWorkerHandle>,
    input: CreateVoucherInput,
) -> Result<PostVoucherResult, String> {
    worker.post_cashbook_voucher(input).await
}

#[tauri::command]
pub async fn reverse_cashbook_voucher(
    worker: State<'_, DbWorkerHandle>,
    voucher_id: String,
    confirmed_negative_balance: bool,
) -> Result<PostVoucherResult, String> {
    worker.reverse_cashbook_voucher(voucher_id, confirmed_negative_balance).await
}

#[tauri::command]
pub async fn get_cashbook_ledger(
    worker: State<'_, DbWorkerHandle>,
    filter: CashbookLedgerFilter,
) -> Result<(Vec<CashbookLedgerEntry>, CashbookSummary), String> {
    worker.get_cashbook_ledger(filter).await
}

#[tauri::command]
pub async fn ensure_customer_cashbook_party(worker: State<'_, DbWorkerHandle>, input: EnsureCustomerCashbookPartyInput) -> Result<CashbookParty, String> {
    worker.ensure_customer_cashbook_party(input).await
}

#[tauri::command]
pub async fn get_customer_cash_history(worker: State<'_, DbWorkerHandle>, filter: CustomerCashHistoryFilter) -> Result<CustomerCashHistory, String> {
    worker.get_customer_cash_history(filter).await
}
