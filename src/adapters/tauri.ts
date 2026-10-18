import { invoke } from '@tauri-apps/api/core';
import type { BusinessSettings, PrintSupportInfo } from '../types';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    // Return mock for development in plain browser
    return {
      id: 'default',
      business_name: 'BillZen Store (Browser Preview)',
      legal_name: null,
      tax_identifier: '32AAAAA0000A1Z5',
      phone: '+91 9876543210',
      email: 'store@billzen.local',
      address_line1: '123 Market Road',
      address_line2: null,
      city: 'Kochi',
      state: 'Kerala',
      postal_code: '682001',
      country: 'IND',
      currency_code: 'INR',
      currency_symbol: '₹',
      currency_exponent: 2,
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      invoice_prefix: 'INV',
      terms_and_conditions: 'Thank you for your business!',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
  }
  return await invoke<BusinessSettings>('get_business_settings');
}

export async function updateBusinessSettings(
  settings: BusinessSettings
): Promise<BusinessSettings> {
  if (!isTauriEnvironment()) {
    return { ...settings, updated_at: Date.now() };
  }
  return await invoke<BusinessSettings>('update_business_settings', { settings });
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
