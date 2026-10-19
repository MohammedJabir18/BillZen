// TypeScript Cashbook Type Definitions matching Rust domain contracts

export type AccountType = 'cash' | 'bank' | 'wallet' | 'other';

export interface MoneyAccount {
  id: string;
  account_name: string;
  account_type: AccountType;
  opening_balance_minor: number;
  allow_negative_balance: boolean;
  currency_code: string;
  currency_exponent: number;
  bank_name: string | null;
  account_number: string | null;
  ifsc_or_routing: string | null;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
}

export type CategoryType = 'income' | 'expense' | 'both';

export interface CashbookCategory {
  id: string;
  name: string;
  category_type: CategoryType;
  is_default: boolean;
  is_archived: boolean;
  created_at: number;
}

export type PartyType =
  | 'customer'
  | 'supplier'
  | 'employee'
  | 'owner'
  | 'lender'
  | 'other';

export interface CashbookParty {
  id: string;
  name: string;
  party_type: PartyType;
  customer_id: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  address: string | null;
  is_archived: boolean;
  created_at: number;
  updated_at: number;
}

export type MovementDirection = 'inflow' | 'outflow';

export type CashbookClassification =
  | 'operating_income'
  | 'operating_expense'
  | 'capital'
  | 'loan'
  | 'advance'
  | 'refund'
  | 'transfer'
  | 'opening_balance';

export type PaymentMethod =
  | 'cash'
  | 'upi'
  | 'card'
  | 'bank_transfer'
  | 'cheque'
  | 'other';

export type VoucherStatus = 'draft' | 'posted' | 'reversed';

export interface CashbookVoucher {
  id: string;
  voucher_number: string;
  idempotency_key: string;
  payload_hash: string;
  account_id: string;
  party_id: string | null;
  category_id: string | null;
  direction: MovementDirection;
  classification: CashbookClassification;
  payment_method: PaymentMethod;
  amount_minor: number;
  business_date: string;
  status: VoucherStatus;
  is_reversal: boolean;
  reversal_for_voucher_id: string | null;
  is_reversed: boolean;
  reversed_by_voucher_id: string | null;
  reversed_at: number | null;
  reference_note: string | null;
  notes: string | null;
  business_name_snap: string | null;
  business_tax_id_snap: string | null;
  business_address_snap: string | null;
  business_phone_snap: string | null;
  party_name_snap: string | null;
  party_phone_snap: string | null;
  party_tax_id_snap: string | null;
  party_address_snap: string | null;
  account_name_snap: string | null;
  currency_code_snap: string | null;
  currency_exponent_snap: number;
  amount_in_words_snap: string | null;
  created_at: number;
  posted_at: number;
}

export interface CashbookMovement {
  id: string;
  voucher_id: string;
  account_id: string;
  amount_minor: number;
  business_date: string;
  sequence_number: number;
  created_at: number;
}

export interface CashbookLedgerEntry {
  voucher: CashbookVoucher;
  movement: CashbookMovement;
  running_balance_minor: number;
}

export interface CashbookSummary {
  total_cash_minor: number;
  active_cash_minor: number;
  period_inflows_minor: number;
  period_outflows_minor: number;
  net_operating_cash_flow_minor: number;
  opening_balance_minor: number;
  closing_balance_minor: number;
  matching_inflows_minor?: number | null;
  matching_outflows_minor?: number | null;
  matching_count?: number | null;
}

export type PostVoucherResult =
  | ({ status: 'posted' } & CashbookVoucher)
  | {
      status: 'requires_confirmation';
      current_balance_minor: number;
      amount_minor: number;
      projected_balance_minor: number;
      message: string;
    };

export interface CreateMoneyAccountDto {
  account_name: string;
  account_type: string;
  opening_balance_minor: number;
  allow_negative_balance: boolean;
  currency_code?: string | null;
  currency_exponent?: number | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_or_routing?: string | null;
}

export interface UpdateMoneyAccountDto {
  id: string;
  account_name: string;
  allow_negative_balance: boolean;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_or_routing?: string | null;
  is_archived?: boolean | null;
}

export interface CreateCashbookCategoryDto {
  name: string;
  category_type: CategoryType;
}

export interface CreateCashbookPartyDto {
  name: string;
  party_type: PartyType;
  customer_id?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  address?: string | null;
}

export interface CreateVoucherInput {
  account_id: string;
  direction: MovementDirection;
  classification: CashbookClassification;
  payment_method: PaymentMethod;
  amount_minor: number;
  business_date: string;
  party_id?: string | null;
  category_id?: string | null;
  reference_note?: string | null;
  notes?: string | null;
  idempotency_key: string;
  confirmed_negative_balance?: boolean | null;
}

export interface CashbookLedgerFilter {
  account_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  classification?: string | null;
  search?: string | null;
  include_archived?: boolean | null;
}

export interface ReportPrintData {
  summary: CashbookSummary;
  entries: CashbookLedgerEntry[];
  periodTitle: string;
  dateRangeText: string;
  accountName?: string;
  filterSummary?: string;
  businessName?: string;
  taxIdentifier?: string | null;
  phone?: string | null;
  currencyCode?: string;
  currencyExponent?: number;
  timezone?: string;
  generatedAt?: string;
}
