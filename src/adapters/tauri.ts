import { invoke } from '@tauri-apps/api/core';
import type { BusinessSettings, PrintSupportInfo } from '../types';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    try {
      const stored = localStorage.getItem('billzen_browser_settings');
      if (stored) {
        return JSON.parse(stored);
      }
      const isFresh = localStorage.getItem('billzen_mock_fresh_user') === 'true';
      return {
        id: 'default',
        business_name: isFresh ? '' : 'BillZen Store (Browser Preview)',
        legal_name: null,
        tax_identifier: isFresh ? null : '32AAAAA0000A1Z5',
        phone: isFresh ? '' : '+91 9876543210',
        email: isFresh ? null : 'store@billzen.local',
        address_line1: isFresh ? '' : '123 Market Road',
        address_line2: null,
        city: isFresh ? '' : 'Kochi',
        state: isFresh ? '' : 'Kerala',
        postal_code: isFresh ? '' : '682001',
        country: 'IND',
        currency_code: 'INR',
        currency_symbol: '₹',
        currency_exponent: 2,
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        invoice_prefix: 'INV',
        terms_and_conditions: 'Thank you for your business!',
        is_setup_completed: !isFresh,
        appearance_preference: (localStorage.getItem('billzen_appearance_pref') as 'system' | 'light' | 'dark') || 'system',
        guide_status: (localStorage.getItem('billzen_guide_status') as 'unseen' | 'completed' | 'skipped') || 'unseen',
        guide_version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    } catch {
      // Fallback
    }
  }
  return await invoke<BusinessSettings>('get_business_settings');
}

export async function updateBusinessSettings(
  settings: BusinessSettings
): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    const updated = { ...settings, updated_at: Date.now() };
    try {
      localStorage.setItem('billzen_browser_settings', JSON.stringify(updated));
    } catch {}
    return updated;
  }
  return await invoke<BusinessSettings>('update_business_settings', { settings });
}

export async function updateBusinessProfile(
  profile: import('../types').BusinessProfileDto
): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    const current = await getBusinessSettings();
    const updated: BusinessSettings = {
      ...current,
      ...profile,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem('billzen_browser_settings', JSON.stringify(updated));
    } catch {}
    return updated;
  }
  return await invoke<BusinessSettings>('update_business_profile', { profile });
}

export async function completeBusinessSetup(
  profile: import('../types').BusinessProfileDto
): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    const current = await getBusinessSettings();
    const updated: BusinessSettings = {
      ...current,
      ...profile,
      is_setup_completed: true,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem('billzen_browser_settings', JSON.stringify(updated));
      localStorage.setItem('billzen_mock_fresh_user', 'false');
    } catch {}
    return updated;
  }
  return await invoke<BusinessSettings>('complete_business_setup', { profile });
}

export async function updateAppearancePreference(
  preference: 'system' | 'light' | 'dark'
): Promise<string> {
  try {
    localStorage.setItem('billzen_appearance_pref', preference);
  } catch {}
  if (!isTauriEnvironment()) {
    try {
      const stored = localStorage.getItem('billzen_browser_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.appearance_preference = preference;
        localStorage.setItem('billzen_browser_settings', JSON.stringify(parsed));
      }
    } catch {}
    return preference;
  }
  return await invoke<string>('update_appearance_preference', { preference });
}

export async function updateGuideStatus(
  status: 'unseen' | 'completed' | 'skipped',
  version: number
): Promise<string> {
  try {
    localStorage.setItem('billzen_guide_status', status);
  } catch {}
  if (!isTauriEnvironment()) {
    try {
      const stored = localStorage.getItem('billzen_browser_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.guide_status = status;
        parsed.guide_version = version;
        localStorage.setItem('billzen_browser_settings', JSON.stringify(parsed));
      }
    } catch {}
    return status;
  }
  return await invoke<string>('update_guide_status', { status, version });
}

export async function checkPrintSupport(): Promise<PrintSupportInfo> {
  if (!isTauriEnvironment()) {
    return {
      platform: 'browser',
      native_dialog_available: false,
      cups_detected: false,
      in_app_preview_supported: true,
      empirical_status: 'unverified (browser preview)',
      notes: 'Browser development environment. Using standard browser print dialog.',
    };
  }
  return await invoke<PrintSupportInfo>('check_print_support');
}

export async function pingBackend(): Promise<string> {
  if (!isTauriEnvironment()) {
    return 'browser-mock-pong';
  }
  return await invoke<string>('ping');
}

// In-memory mocks for browser preview
let mockProducts: import('../types').Product[] = [];
let mockCustomers: import('../types').Customer[] = [];
let mockCategories: import('../types').Category[] = [];

// Products
export async function getProducts(filter: import('../types').ProductFilter = {}): Promise<import('../types').Product[]> {
  if (!isTauriEnvironment()) {
    return mockProducts.filter((p) => {
      if (filter.is_active !== undefined && filter.is_active !== null && p.is_active !== filter.is_active) return false;
      if (filter.category_id && p.category_id !== filter.category_id) return false;
      if (filter.low_stock_only && (!p.is_stock_tracked || p.current_stock_scaled > p.min_stock_threshold_scaled)) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s));
      }
      return true;
    });
  }
  return await invoke<import('../types').Product[]>('get_products', { filter });
}

export async function createProduct(dto: import('../types').CreateProductDto): Promise<import('../types').Product> {
  if (!isTauriEnvironment()) {
    const prod: import('../types').Product = {
      id: `prod_${Date.now()}`,
      sku: dto.sku.trim().toUpperCase(),
      barcode: dto.barcode ? dto.barcode.trim() : null,
      name: dto.name.trim(),
      description: dto.description || null,
      category_id: dto.category_id || null,
      category_name: null,
      unit: dto.unit || 'unit',
      unit_price_minor: dto.unit_price_minor,
      cost_price_minor: dto.cost_price_minor || 0,
      tax_rate_bp: dto.tax_rate_bp || 0,
      is_stock_tracked: dto.is_stock_tracked ?? true,
      current_stock_scaled: dto.opening_stock_scaled || 0,
      min_stock_threshold_scaled: dto.min_stock_threshold_scaled || 0,
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockProducts.push(prod);
    return prod;
  }
  return await invoke<import('../types').Product>('create_product', { dto });
}

export async function updateProduct(dto: import('../types').UpdateProductDto): Promise<import('../types').Product> {
  if (!isTauriEnvironment()) {
    const idx = mockProducts.findIndex((p) => p.id === dto.id);
    if (idx === -1) throw new Error('Product not found');
    mockProducts[idx] = {
      ...mockProducts[idx],
      sku: dto.sku.trim().toUpperCase(),
      barcode: dto.barcode ? dto.barcode.trim() : null,
      name: dto.name.trim(),
      description: dto.description || null,
      category_id: dto.category_id || null,
      unit: dto.unit,
      unit_price_minor: dto.unit_price_minor,
      cost_price_minor: dto.cost_price_minor,
      tax_rate_bp: dto.tax_rate_bp,
      is_stock_tracked: dto.is_stock_tracked,
      min_stock_threshold_scaled: dto.min_stock_threshold_scaled,
      updated_at: Date.now(),
    };
    return mockProducts[idx];
  }
  return await invoke<import('../types').Product>('update_product', { dto });
}

export async function archiveProduct(id: string): Promise<void> {
  if (!isTauriEnvironment()) {
    const p = mockProducts.find((p) => p.id === id);
    if (p) p.is_active = false;
    return;
  }
  return await invoke<void>('archive_product', { id });
}

export async function restoreProduct(id: string): Promise<void> {
  if (!isTauriEnvironment()) {
    const p = mockProducts.find((p) => p.id === id);
    if (p) p.is_active = true;
    return;
  }
  return await invoke<void>('restore_product', { id });
}

// Customers
export async function getCustomers(filter: import('../types').CustomerFilter = {}): Promise<import('../types').Customer[]> {
  if (!isTauriEnvironment()) {
    return mockCustomers.filter((c) => {
      if (filter.is_active !== undefined && filter.is_active !== null && c.is_active !== filter.is_active) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        return c.name.toLowerCase().includes(s) || (c.phone && c.phone.includes(s)) || (c.tax_identifier && c.tax_identifier.includes(s));
      }
      return true;
    });
  }
  return await invoke<import('../types').Customer[]>('get_customers', { filter });
}

export async function createCustomer(dto: import('../types').CreateCustomerDto): Promise<import('../types').Customer> {
  if (!isTauriEnvironment()) {
    const cust: import('../types').Customer = {
      id: `cust_${Date.now()}`,
      name: dto.name.trim(),
      phone: dto.phone || null,
      email: dto.email || null,
      address_line1: dto.address_line1 || null,
      address_line2: dto.address_line2 || null,
      city: dto.city || null,
      state: dto.state || null,
      postal_code: dto.postal_code || null,
      country: dto.country || 'India',
      tax_identifier: dto.tax_identifier || null,
      current_balance_minor: 0,
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockCustomers.push(cust);
    return cust;
  }
  return await invoke<import('../types').Customer>('create_customer', { dto });
}

export async function updateCustomer(dto: import('../types').UpdateCustomerDto): Promise<import('../types').Customer> {
  if (!isTauriEnvironment()) {
    const idx = mockCustomers.findIndex((c) => c.id === dto.id);
    if (idx === -1) throw new Error('Customer not found');
    mockCustomers[idx] = {
      ...mockCustomers[idx],
      name: dto.name.trim(),
      phone: dto.phone || null,
      email: dto.email || null,
      address_line1: dto.address_line1 || null,
      address_line2: dto.address_line2 || null,
      city: dto.city || null,
      state: dto.state || null,
      postal_code: dto.postal_code || null,
      country: dto.country,
      tax_identifier: dto.tax_identifier || null,
      updated_at: Date.now(),
    };
    return mockCustomers[idx];
  }
  return await invoke<import('../types').Customer>('update_customer', { dto });
}

export async function archiveCustomer(id: string): Promise<void> {
  if (!isTauriEnvironment()) {
    const c = mockCustomers.find((c) => c.id === id);
    if (c) c.is_active = false;
    return;
  }
  return await invoke<void>('archive_customer', { id });
}

export async function restoreCustomer(id: string): Promise<void> {
  if (!isTauriEnvironment()) {
    const c = mockCustomers.find((c) => c.id === id);
    if (c) c.is_active = true;
    return;
  }
  return await invoke<void>('restore_customer', { id });
}

// Categories
export async function getCategories(): Promise<import('../types').Category[]> {
  if (!isTauriEnvironment()) {
    return mockCategories;
  }
  return await invoke<import('../types').Category[]>('get_categories');
}

export async function createCategory(dto: import('../types').CreateCategoryDto): Promise<import('../types').Category> {
  if (!isTauriEnvironment()) {
    const cat: import('../types').Category = {
      id: `cat_${Date.now()}`,
      name: dto.name.trim(),
      description: dto.description || null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockCategories.push(cat);
    return cat;
  }
  return await invoke<import('../types').Category>('create_category', { dto });
}

// Workspace Backup & Restore
export async function exportWorkspaceBackup(): Promise<import('../types/backup').WorkspaceBackupEnvelope> {
  if (!isTauriEnvironment()) {
    const settings = await getBusinessSettings();
    const products = await getProducts();
    const customers = await getCustomers();
    const categories = await getCategories();
    const cashbookModule = await import('./cashbook');
    const money_accounts = await cashbookModule.getMoneyAccounts();
    const cashbook_categories = await cashbookModule.getCashbookCategories();
    const cashbook_parties = await cashbookModule.getCashbookParties();
    const { entries } = await cashbookModule.getCashbookLedger({});
    const cashbook_vouchers = entries.map((e) => e.voucher);
    const cashbook_movements = entries.map((e) => e.movement);

    const payload: Record<string, any> = {
      format_version: '1.0',
      scope: 'workspace',
      app_version: '0.1.0',
      generated_at: Date.now(),
      business_settings: settings,
      categories,
      category_merges: [],
      products,
      customers,
      invoice_sequences: [],
      invoice_items: [],
      invoices: [],
      stock_movements: [],
      payments: [],
      payment_allocations: [],
      expenses: [],
      money_accounts,
      cashbook_categories,
      cashbook_parties,
      cashbook_sequences: [],
      cashbook_vouchers,
      cashbook_movements,
      cashbook_audit_events: [],
    };

    const { computePayloadChecksum } = await import('../domain/backup_crypto');
    const checksum = await computePayloadChecksum(payload);
    return {
      checksum_sha256: checksum,
      ...payload,
    } as import('../types/backup').WorkspaceBackupEnvelope;
  }
  return await invoke<import('../types/backup').WorkspaceBackupEnvelope>('export_workspace_backup');
}

export async function restoreWorkspaceBackup(
  backupEnvelope: import('../types/backup').WorkspaceBackupEnvelope
): Promise<import('../types/backup').RestoreBackupResult> {
  if (!isTauriEnvironment()) {
    const { verifyBackupEnvelope } = await import('../domain/backup_crypto');
    const check = await verifyBackupEnvelope(backupEnvelope);
    if (!check.valid) {
      throw new Error(check.error || 'Invalid backup checksum');
    }
    if (backupEnvelope.business_settings) {
      localStorage.setItem('billzen_browser_settings', JSON.stringify(backupEnvelope.business_settings));
    }
    return {
      success: true,
      message: 'Workspace restored successfully in browser preview.',
      restored_tables: Object.keys(backupEnvelope).filter((k) => k !== 'checksum_sha256'),
      record_counts: {},
    };
  }
  return await invoke<import('../types/backup').RestoreBackupResult>('restore_workspace_backup', {
    backupJson: backupEnvelope,
  });
}

