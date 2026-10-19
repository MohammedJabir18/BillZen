import type { BusinessSettings } from './index';

export interface WorkspaceBackupEnvelope {
  format_version: '1.0';
  scope: 'workspace';
  app_version: string;
  generated_at: number;
  checksum_sha256: string;
  business_settings: BusinessSettings;
  categories: any[];
  category_merges: any[];
  products: any[];
  customers: any[];
  invoice_sequences: any[];
  invoice_items: any[];
  invoices: any[];
  stock_movements: any[];
  payments: any[];
  payment_allocations: any[];
  expenses: any[];
  money_accounts: any[];
  cashbook_categories: any[];
  cashbook_parties: any[];
  cashbook_sequences: any[];
  cashbook_vouchers: any[];
  cashbook_movements: any[];
  cashbook_audit_events: any[];
}

export interface RestoreBackupResult {
  success: boolean;
  message: string;
  recovery_path?: string;
  restored_tables: string[];
  record_counts: Record<string, number>;
}
