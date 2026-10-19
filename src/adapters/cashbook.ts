import { invoke } from '@tauri-apps/api/core';
import type {
  MoneyAccount,
  CreateMoneyAccountDto,
  UpdateMoneyAccountDto,
  CashbookCategory,
  CreateCashbookCategoryDto,
  CashbookParty,
  CreateCashbookPartyDto,
  CashbookLedgerEntry,
  CashbookSummary,
  CreateVoucherInput,
  PostVoucherResult,
  CashbookLedgerFilter,
} from '../types/cashbook';
import { isTauriEnvironment } from './tauri';
import {
  getWebMoneyAccounts,
  createWebMoneyAccount,
  updateWebMoneyAccount,
  getWebCashbookCategories,
  createWebCashbookCategory,
  getWebCashbookParties,
  createWebCashbookParty,
  postWebCashbookVoucher,
  reverseWebCashbookVoucher,
  getWebCashbookLedger,
} from './web_cashbook_db';

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Adapter Interface Methods
// ---------------------------------------------------------------------------

export async function getMoneyAccounts(): Promise<MoneyAccount[]> {
  if (!isTauriEnvironment()) {
    return await getWebMoneyAccounts();
  }
  return await invoke<MoneyAccount[]>('get_money_accounts');
}

export async function createMoneyAccount(dto: CreateMoneyAccountDto): Promise<MoneyAccount> {
  if (!isTauriEnvironment()) {
    return await createWebMoneyAccount(dto);
  }
  return await invoke<MoneyAccount>('create_money_account', { dto });
}

export async function updateMoneyAccount(dto: UpdateMoneyAccountDto): Promise<MoneyAccount> {
  if (!isTauriEnvironment()) {
    return await updateWebMoneyAccount(dto);
  }
  return await invoke<MoneyAccount>('update_money_account', { dto });
}

export async function getCashbookCategories(): Promise<CashbookCategory[]> {
  if (!isTauriEnvironment()) {
    return await getWebCashbookCategories();
  }
  return await invoke<CashbookCategory[]>('get_cashbook_categories');
}

export async function createCashbookCategory(dto: CreateCashbookCategoryDto): Promise<CashbookCategory> {
  if (!isTauriEnvironment()) {
    return await createWebCashbookCategory(dto);
  }
  return await invoke<CashbookCategory>('create_cashbook_category', { dto });
}

export async function getCashbookParties(): Promise<CashbookParty[]> {
  if (!isTauriEnvironment()) {
    return await getWebCashbookParties();
  }
  return await invoke<CashbookParty[]>('get_cashbook_parties');
}

export async function createCashbookParty(dto: CreateCashbookPartyDto): Promise<CashbookParty> {
  if (!isTauriEnvironment()) {
    return await createWebCashbookParty(dto);
  }
  return await invoke<CashbookParty>('create_cashbook_party', { dto });
}

export async function postCashbookVoucher(input: CreateVoucherInput): Promise<PostVoucherResult> {
  if (!isTauriEnvironment()) {
    return await postWebCashbookVoucher(input);
  }
  return await invoke<PostVoucherResult>('post_cashbook_voucher', { input });
}

export async function reverseCashbookVoucher(
  voucherId: string,
  confirmedNegativeBalance: boolean = false
): Promise<PostVoucherResult> {
  if (!isTauriEnvironment()) {
    return await reverseWebCashbookVoucher(voucherId, confirmedNegativeBalance);
  }
  return await invoke<PostVoucherResult>('reverse_cashbook_voucher', {
    voucherId,
    confirmedNegativeBalance,
  });
}

export async function getCashbookLedger(
  filter: CashbookLedgerFilter
): Promise<{ entries: CashbookLedgerEntry[]; summary: CashbookSummary }> {
  if (!isTauriEnvironment()) {
    return await getWebCashbookLedger(filter);
  }
  const rawTuple = await invoke<[CashbookLedgerEntry[], CashbookSummary]>('get_cashbook_ledger', {
    filter,
  });
  return { entries: rawTuple[0], summary: rawTuple[1] };
}
