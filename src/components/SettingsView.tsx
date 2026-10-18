import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBusinessSettings, updateBusinessSettings } from '../adapters/tauri';
import type { BusinessSettings } from '../types';
import { Building2, Save, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface CurrencyPreset {
  code: string;
  symbol: string;
  exponent: number;
  country: string;
  defaultLocale: string;
  name: string;
}

const REGIONAL_CURRENCIES: CurrencyPreset[] = [
  { code: 'INR', symbol: '₹', exponent: 2, country: 'India', defaultLocale: 'en-IN', name: 'Indian Rupee (₹ - 2 decimals)' },
  { code: 'AED', symbol: 'AED', exponent: 2, country: 'United Arab Emirates', defaultLocale: 'en-AE', name: 'UAE Dirham (AED - 2 decimals)' },
  { code: 'SAR', symbol: 'SAR', exponent: 2, country: 'Saudi Arabia', defaultLocale: 'en-SA', name: 'Saudi Riyal (SAR - 2 decimals)' },
  { code: 'QAR', symbol: 'QAR', exponent: 2, country: 'Qatar', defaultLocale: 'en-QA', name: 'Qatari Riyal (QAR - 2 decimals)' },
  { code: 'KWD', symbol: 'KWD', exponent: 3, country: 'Kuwait', defaultLocale: 'en-KW', name: 'Kuwaiti Dinar (KWD - 3 decimals)' },
  { code: 'BHD', symbol: 'BHD', exponent: 3, country: 'Bahrain', defaultLocale: 'en-BH', name: 'Bahraini Dinar (BHD - 3 decimals)' },
  { code: 'OMR', symbol: 'OMR', exponent: 3, country: 'Oman', defaultLocale: 'en-OM', name: 'Omani Rial (OMR - 3 decimals)' },
];

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BusinessSettings | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['business_settings'],
    queryFn: getBusinessSettings,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateBusinessSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['business_settings'], updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading business profile...
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
        <AlertCircle className="w-5 h-5 mr-2" /> Failed to load business settings.
      </div>
    );
  }

  const handleChange = (field: keyof BusinessSettings, value: string) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleCurrencyChange = (code: string) => {
    const preset = REGIONAL_CURRENCIES.find((p) => p.code === code);
    if (preset) {
      setFormData((prev) =>
        prev
          ? {
              ...prev,
              currency_code: preset.code,
              currency_symbol: preset.symbol,
              currency_exponent: preset.exponent,
              locale: preset.defaultLocale,
              country: preset.country,
            }
          : prev
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      mutation.mutate(formData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-800" /> Business Profile & Settings
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure your store identity, tax registration, and invoice defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {saveSuccess && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center text-sm">
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
          Settings successfully saved and persisted to local SQLite database.
        </div>
      )}

      {mutation.isError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
          Failed to save settings: {String(mutation.error)}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Store Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Business Trading Name *
              </label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => handleChange('business_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Legal Registered Name
              </label>
              <input
                type="text"
                value={formData.legal_name || ''}
                onChange={(e) => handleChange('legal_name', e.target.value)}
                placeholder="Optional legal entity name"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tax Identifier (GSTIN / VAT)
              </label>
              <input
                type="text"
                value={formData.tax_identifier || ''}
                onChange={(e) => handleChange('tax_identifier', e.target.value)}
                placeholder="e.g. 32AAAAA0000A1Z5"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Address Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                required
                value={formData.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Postal Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Billing & Format Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Regional Currency
              </label>
              <select
                value={formData.currency_code}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 font-medium focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                {REGIONAL_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Exponent: {formData.currency_exponent} decimals | Locale: {formData.locale}
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Timezone
              </label>
              <input
                type="text"
                disabled
                value={formData.timezone}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={formData.invoice_prefix}
                onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Invoice Terms & Notes
            </label>
            <textarea
              rows={3}
              value={formData.terms_and_conditions || ''}
              onChange={(e) => handleChange('terms_and_conditions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-sm flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Saving to Database...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
