import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBusinessSettings, updateBusinessProfile } from '../adapters/tauri';
import type { BusinessSettings, BusinessProfileDto } from '../types';
import { useTheme, type AppearanceMode } from '../contexts/ThemeContext';
import { translations, type Language } from '../i18n';
import {
  Building2,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

interface CurrencyPreset {
  code: string;
  symbol: string;
  exponent: number;
  country: string;
  defaultLocale: string;
  name: string;
  timezone: string;
}

export const REGIONAL_CURRENCIES: CurrencyPreset[] = [
  { code: 'INR', symbol: '₹', exponent: 2, country: 'India', defaultLocale: 'en-IN', name: 'Indian Rupee (₹ - 2 decimals)', timezone: 'Asia/Kolkata' },
  { code: 'AED', symbol: 'AED', exponent: 2, country: 'United Arab Emirates', defaultLocale: 'en-AE', name: 'UAE Dirham (AED - 2 decimals)', timezone: 'Asia/Dubai' },
  { code: 'SAR', symbol: 'SAR', exponent: 2, country: 'Saudi Arabia', defaultLocale: 'en-SA', name: 'Saudi Riyal (SAR - 2 decimals)', timezone: 'Asia/Riyadh' },
  { code: 'QAR', symbol: 'QAR', exponent: 2, country: 'Qatar', defaultLocale: 'en-QA', name: 'Qatari Riyal (QAR - 2 decimals)', timezone: 'Asia/Qatar' },
  { code: 'KWD', symbol: 'KWD', exponent: 3, country: 'Kuwait', defaultLocale: 'en-KW', name: 'Kuwaiti Dinar (KWD - 3 decimals)', timezone: 'Asia/Kuwait' },
  { code: 'BHD', symbol: 'BHD', exponent: 3, country: 'Bahrain', defaultLocale: 'en-BH', name: 'Bahraini Dinar (BHD - 3 decimals)', timezone: 'Asia/Bahrain' },
  { code: 'OMR', symbol: 'OMR', exponent: 3, country: 'Oman', defaultLocale: 'en-OM', name: 'Omani Rial (OMR - 3 decimals)', timezone: 'Asia/Muscat' },
];

export interface SettingsViewProps {
  currentLanguage?: Language;
  onViewGuide?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentLanguage = 'en',
  onViewGuide,
}) => {
  const queryClient = useQueryClient();
  const { appearance, resolvedTheme, setAppearance, persistenceError, clearPersistenceError } = useTheme();
  const t = translations[currentLanguage] || translations.en;

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
    mutationFn: (profile: BusinessProfileDto) => updateBusinessProfile(profile),
    onSuccess: (updated) => {
      queryClient.setQueryData(['business_settings'], updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 dark:text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading business profile...
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-400 flex items-center">
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
              timezone: preset.timezone,
            }
          : prev
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      const profile: BusinessProfileDto = {
        business_name: formData.business_name,
        legal_name: formData.legal_name || null,
        tax_identifier: formData.tax_identifier || null,
        phone: formData.phone,
        email: formData.email || null,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || null,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country: formData.country,
        currency_code: formData.currency_code,
        currency_symbol: formData.currency_symbol,
        currency_exponent: formData.currency_exponent,
        locale: formData.locale,
        timezone: formData.timezone,
        invoice_prefix: formData.invoice_prefix,
        terms_and_conditions: formData.terms_and_conditions || null,
      };
      mutation.mutate(profile);
    }
  };

  const appearanceOptions: {
    mode: AppearanceMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: 'system',
      label: t.theme_system,
      desc: t.theme_system_desc,
      icon: <Laptop className="w-5 h-5" />,
    },
    {
      mode: 'light',
      label: t.theme_light,
      desc: t.theme_light_desc,
      icon: <Sun className="w-5 h-5" />,
    },
    {
      mode: 'dark',
      label: t.theme_dark,
      desc: t.theme_dark_desc,
      icon: <Moon className="w-5 h-5" />,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24 lg:pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-lime-600 dark:text-lime-400" />
            {t.tab_settings}
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
            Configure appearance, store identity, and regional billing preferences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 min-h-[44px] self-stretch sm:self-auto justify-center"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {saveSuccess && (
        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg flex items-center text-sm">
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Settings successfully saved and persisted to local SQLite database.
        </div>
      )}

      {persistenceError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 text-red-600 dark:text-red-400 shrink-0" />
            Appearance error: {persistenceError}
          </div>
          <button
            type="button"
            onClick={clearPersistenceError}
            className="text-xs font-semibold underline ml-2 text-red-800 dark:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {mutation.isError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2 text-red-600 dark:text-red-400 shrink-0" />
          Failed to save settings: {String(mutation.error)}
        </div>
      )}

      {/* 1. APPEARANCE SETTINGS (Strictly in Settings, no header/bottom toggles) */}
      <div className="mt-6 bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            {resolvedTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-lime-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            {t.appearance_title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            {t.appearance_desc} (Currently resolved as: <span className="font-semibold capitalize text-gray-700 dark:text-zinc-200">{resolvedTheme}</span>)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {appearanceOptions.map((opt) => {
            const isSelected = appearance === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                data-testid={`appearance-option-${opt.mode}`}
                onClick={() => setAppearance(opt.mode)}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[96px] ${
                  isSelected
                    ? 'border-lime-500 bg-lime-50/50 dark:bg-lime-950/20 ring-2 ring-lime-500/20'
                    : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-lime-500 text-zinc-950 font-semibold'
                        : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-lime-500/20 text-lime-700 dark:text-lime-300 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {opt.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STORE INFORMATION FORM */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Store Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Business Trading Name *
              </label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => handleChange('business_name', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Legal Registered Name
              </label>
              <input
                type="text"
                value={formData.legal_name || ''}
                onChange={(e) => handleChange('legal_name', e.target.value)}
                placeholder="Optional legal entity name"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Tax Identifier (GSTIN / VAT / TRN)
              </label>
              <input
                type="text"
                value={formData.tax_identifier || ''}
                onChange={(e) => handleChange('tax_identifier', e.target.value)}
                placeholder="e.g. 32AAAAA0000A1Z5"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-mono text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 ... or +971 ..."
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-mono text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          </div>
        </div>

        {/* 3. ADDRESS DETAILS */}
        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Address Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-mono text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. BILLING & REGIONAL PREFERENCES */}
        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Billing & Regional Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Regional Currency
              </label>
              <select
                value={formData.currency_code}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 font-medium focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              >
                {REGIONAL_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 block">
                Exponent: {formData.currency_exponent} decimals | Locale: {formData.locale}
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Timezone
              </label>
              <input
                type="text"
                disabled
                value={formData.timezone}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-500 dark:text-zinc-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={formData.invoice_prefix}
                onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-mono text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Invoice Terms & Notes
            </label>
            <textarea
              rows={3}
              value={formData.terms_and_conditions || ''}
              onChange={(e) => handleChange('terms_and_conditions', e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
            />
          </div>
        </div>

        {/* 5. HELP & GETTING STARTED SECTION */}
        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-lime-600 dark:text-lime-400" />
                {t.settings_help_title}
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                {t.settings_help_desc}
              </p>
            </div>
            {onViewGuide && (
              <button
                type="button"
                data-testid="button-view-guide"
                onClick={onViewGuide}
                className="px-4 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 rounded-lg font-medium text-sm flex items-center gap-2 min-h-[44px]"
              >
                <BookOpen className="w-4 h-4 text-lime-600 dark:text-lime-400" />
                {t.settings_view_guide}
              </button>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full sm:w-auto min-h-[48px] justify-center px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Saving to Database...' : t.action_save}
          </button>
        </div>
      </form>
    </div>
  );
};
