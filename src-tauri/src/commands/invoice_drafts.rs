use crate::{db::worker::DbWorkerHandle, domain::invoice_drafts::*};
use tauri::State;
#[tauri::command]
pub async fn create_invoice_draft(
    worker: State<'_, DbWorkerHandle>,
    request: CreateDraftInvoiceRequest,
) -> Result<InvoiceDraftDetailDto, String> {
    worker.create_invoice_draft(request).await
}
#[tauri::command]
pub async fn update_invoice_draft(
    worker: State<'_, DbWorkerHandle>,
    request: UpdateDraftInvoiceRequest,
) -> Result<InvoiceDraftDetailDto, String> {
    worker.update_invoice_draft(request).await
}
#[tauri::command]
pub async fn get_invoice_draft(
    worker: State<'_, DbWorkerHandle>,
    id: String,
) -> Result<InvoiceDraftDetailDto, String> {
    worker.get_invoice_draft(id).await
}
#[tauri::command]
pub async fn list_invoice_drafts(
    worker: State<'_, DbWorkerHandle>,
) -> Result<Vec<InvoiceDraftSummaryDto>, String> {
    worker.list_invoice_drafts().await
}
#[tauri::command]
pub async fn delete_invoice_draft(
    worker: State<'_, DbWorkerHandle>,
    id: String,
    expected_version: i64,
) -> Result<(), String> {
    worker.delete_invoice_draft(id, expected_version).await
}
#[tauri::command]
pub fn calculate_draft_totals(
    mut items: Vec<DraftItemInput>,
) -> Result<crate::domain::financial::InvoiceTotalsCalculation, String> {
    normalize_items(&mut items)?;
    Ok(calculate_draft(&items)?.1)
}
