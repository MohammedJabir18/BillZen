import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauri';
import type { CashbookParty, CustomerCashHistory, CustomerCashHistoryFilter } from '../types/cashbook';

export async function ensureCustomerCashbookParty(input: {
  customer_id: string; existing_party_id?: string;
}): Promise<CashbookParty> {
  if (!isTauriEnvironment()) {
    const { ensureWebCustomerCashbookParty } = await import('./web_customer_cashbook');
    return ensureWebCustomerCashbookParty(input);
  }
  return invoke<CashbookParty>('ensure_customer_cashbook_party', { input });
}

export async function getCustomerCashHistory(filter: CustomerCashHistoryFilter): Promise<CustomerCashHistory> {
  if (!isTauriEnvironment()) {
    const { getWebCustomerCashHistory } = await import('./web_customer_cashbook');
    return getWebCustomerCashHistory(filter);
  }
  return invoke<CustomerCashHistory>('get_customer_cash_history', { filter });
}

export function customerPartyError(error: unknown): { code?: string; message: string } {
  let value = error instanceof Error ? error.message : error;
  const plain = typeof value === 'string' ? value : '';
  const coded = /^([A-Z][A-Z_]+)(?::\s*(.*))?$/.exec(plain);
  if (coded) return { code: coded[1], message: coded[2] || coded[1] };
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return { message: value as string }; }
  }
  if (value && typeof value === 'object') {
    const detail = value as { code?: string; message?: string };
    return { code: detail.code, message: detail.message || String(error) };
  }
  return { message: String(error) };
}
