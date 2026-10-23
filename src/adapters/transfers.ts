import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauri';
import type { CreateTransferInput, ReverseTransferInput, TransferResult, CashbookTransfer, TransferFilter } from '../types/transfers';

export async function postCashbookTransfer(input: CreateTransferInput): Promise<TransferResult> {
  return isTauriEnvironment() ? invoke('post_cashbook_transfer', { input }) :
    (await import('./web_transfers')).postWebTransfer(input);
}
export async function reverseCashbookTransfer(input: ReverseTransferInput): Promise<TransferResult> {
  return isTauriEnvironment() ? invoke('reverse_cashbook_transfer', { input }) :
    (await import('./web_transfers')).reverseWebTransfer(input);
}
export async function getCashbookTransfers(filter: TransferFilter = {}): Promise<CashbookTransfer[]> {
  return isTauriEnvironment() ? invoke('get_cashbook_transfers', { filter }) :
    (await import('./web_transfers')).getWebTransfers(filter);
}
