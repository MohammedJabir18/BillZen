export interface CreateTransferInput {
  idempotency_key: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: number;
  business_date: string;
  reference_note?: string | null;
  notes?: string | null;
  confirmed_negative_balance?: boolean;
}
export interface ReverseTransferInput { transfer_id: string; confirmed_negative_balance?: boolean }
export interface CashbookTransfer {
  id: string; transfer_number: string; idempotency_key: string; payload_hash: string;
  from_account_id: string; to_account_id: string; amount_minor: number; business_date: string;
  out_voucher_id: string; in_voucher_id: string; reference_note: string | null; notes: string | null;
  currency_code_snap: string; currency_exponent_snap: number; created_at: number; posted_at: number;
  is_reversal: boolean; reversal_for_transfer_id: string | null; is_reversed: boolean;
  reversed_by_transfer_id: string | null; reversed_at: number | null;
}
export type TransferResult = { status: 'posted'; transfer: CashbookTransfer } | {
  status: 'requires_confirmation'; account_id: string; current_balance_minor: number;
  projected_balance_minor: number; amount_minor: number; message: string;
};

export interface TransferFilter { account_id?: string | null; start_date?: string | null; end_date?: string | null }
