import React, { useState } from 'react';
import type { BusinessSettings, BusinessProfileDto } from '../types';
import { completeBusinessSetup } from '../adapters/tauri';
import { translations, type Language } from '../i18n';
import {
  Globe,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Store,
} from 'lucide-react';

export interface OnboardingSetupWizardProps {
  initialSettings: BusinessSettings;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onComplete: (completedSettings: BusinessSettings) => void;
}

interface CountryOption {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  exponent: number;
  locale: string;
  timezone: string;
}

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'IN', name: 'India', currencyCode: 'INR', currencySymbol: '₹', exponent: 2, locale: 'en-IN', timezone: 'Asia/Kolkata' },
  { code: 'AE', name: 'United Arab Emirates', currencyCode: 'AED', currencySymbol: 'AED', exponent: 2, locale: 'en-AE', timezone: 'Asia/Dubai' },
  { code: 'SA', name: 'Saudi Arabia', currencyCode: 'SAR', currencySymbol: 'SAR', exponent: 2, locale: 'en-SA', timezone: 'Asia/Riyadh' },
  { code: 'QA', name: 'Qatar', currencyCode: 'QAR', currencySymbol: 'QAR', exponent: 2, locale: 'en-QA', timezone: 'Asia/Qatar' },
  { code: 'KW', name: 'Kuwait', currencyCode: 'KWD', currencySymbol: 'KWD', exponent: 3, locale: 'en-KW', timezone: 'Asia/Kuwait' },
  { code: 'BH', name: 'Bahrain', currencyCode: 'BHD', currencySymbol: 'BHD', exponent: 3, locale: 'en-BH', timezone: 'Asia/Bahrain' },
  { code: 'OM', name: 'Oman', currencyCode: 'OMR', currencySymbol: 'OMR', exponent: 3, locale: 'en-OM', timezone: 'Asia/Muscat' },
];

const DRAFT_KEY = 'billzen_setup_draft';

export const OnboardingSetupWizard: React.FC<OnboardingSetupWizardProps> = ({
  initialSettings,
  currentLanguage,
  onLanguageChange,
  onComplete,
}) => {
  const t = translations[currentLanguage] || translations.en;
  const isRTL = currentLanguage === 'ar';

  const isDefaultSeed =
    initialSettings.business_name === 'My Retail Store' &&
    initialSettings.address_line1 === '123 Market Road';

  const getInitialDraft = () => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.formData) {
          return parsed;
        }
      }
    } catch {}
    return null;
  };

  const initialDraft = getInitialDraft();

  const [step, setStepState] = useState<1 | 2 | 3>(() => (initialDraft?.step as 1 | 2 | 3) || 1);
  const [selectedCountryCode, setSelectedCountryCodeState] = useState<string>(
    () => initialDraft?.selectedCountryCode || 'IN'
  );

  const [formData, setFormData] = useState<BusinessSettings>(() => {
    if (initialDraft?.formData) {
      return initialDraft.formData;
    }
    return {
      ...initialSettings,
      business_name: isDefaultSeed ? '' : (initialSettings.business_name || ''),
      phone: isDefaultSeed ? '' : (initialSettings.phone || ''),
      address_line1: isDefaultSeed ? '' : (initialSettings.address_line1 || ''),
      city: isDefaultSeed ? '' : (initialSettings.city || ''),
      state: isDefaultSeed ? '' : (initialSettings.state || ''),
      postal_code: isDefaultSeed ? '' : (initialSettings.postal_code || ''),
      country: isDefaultSeed ? 'India' : initialSettings.country,
      currency_code: isDefaultSeed ? 'INR' : initialSettings.currency_code,
      currency_symbol: isDefaultSeed ? '₹' : initialSettings.currency_symbol,
      currency_exponent: isDefaultSeed ? 2 : initialSettings.currency_exponent,
      locale: isDefaultSeed ? 'en-IN' : initialSettings.locale,
      timezone: isDefaultSeed ? 'Asia/Kolkata' : initialSettings.timezone,
      invoice_prefix: isDefaultSeed ? 'INV' : initialSettings.invoice_prefix,
    };
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const persistDraft = (nextStep: 1 | 2 | 3, nextCountry: string, nextData: BusinessSettings) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step: nextStep, selectedCountryCode: nextCountry, formData: nextData })
      );
    } catch {}
  };

  const setStep = (s: 1 | 2 | 3) => {
    setStepState(s);
    persistDraft(s, selectedCountryCode, formData);
  };

  const handleCountrySelect = (code: string) => {
    setSelectedCountryCodeState(code);
    const country = COUNTRY_OPTIONS.find((c) => c.code === code);
    if (country) {
      const nextData: BusinessSettings = {
        ...formData,
        country: country.name,
        currency_code: country.currencyCode,
        currency_symbol: country.currencySymbol,
        currency_exponent: country.exponent,
        locale: country.locale,
        timezone: country.timezone,
      };
      setFormData(nextData);
      persistDraft(step, code, nextData);
    }
  };

  const handleInputChange = (field: keyof BusinessSettings, value: string) => {
    const nextData: BusinessSettings = { ...formData, [field]: value };
    setFormData(nextData);
    persistDraft(step, selectedCountryCode, nextData);
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const isPostalCodeRequired = !['AE', 'QA', 'OM'].includes(selectedCountryCode);

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.business_name.trim()) {
      errors.business_name = t.err_name_required;
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }
    if (!formData.address_line1.trim()) {
      errors.address_line1 = 'Address line 1 is required';
    }
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }
    if (!formData.state.trim()) {
      errors.state = 'State / Province is required';
    }
    if (isPostalCodeRequired && !formData.postal_code.trim()) {
      errors.postal_code = 'Postal code is required';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextFromStep1 = () => {
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (validateStep2()) {
      setStep(3);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSaving(true);
    setServerError(null);

    const profile: BusinessProfileDto = {
      business_name: formData.business_name.trim(),
      legal_name: formData.legal_name?.trim() || null,
      tax_identifier: formData.tax_identifier?.trim() || null,
      phone: formData.phone.trim(),
      email: formData.email?.trim() || null,
      address_line1: formData.address_line1.trim(),
      address_line2: formData.address_line2?.trim() || null,
      city: formData.city.trim(),
      state: formData.state.trim(),
      postal_code: formData.postal_code.trim(),
      country: formData.country.trim(),
      currency_code: formData.currency_code,
      currency_symbol: formData.currency_symbol,
      currency_exponent: formData.currency_exponent,
      locale: formData.locale,
      timezone: formData.timezone,
      invoice_prefix: formData.invoice_prefix.trim() || 'INV',
      terms_and_conditions: formData.terms_and_conditions?.trim() || null,
    };

    try {
      const saved = await completeBusinessSetup(profile);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setIsSaving(false);
      onComplete(saved);
    } catch (err: any) {
      setIsSaving(false);
      setServerError(err?.message || 'Failed to complete business setup. Please try again.');
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        {/* Header with App Identity */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-500/10 border border-lime-500/20 mb-3 shadow-sm">
            <img
              src="/brand/billzen-icon.svg"
              alt="BillZen"
              className="w-10 h-10"
              draggable={false}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
            {t.welcome_title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
            {t.welcome_subtitle}
          </p>
        </div>

        {/* Step Progress Indicators */}
        <div className="mb-6">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 1
                    ? 'bg-lime-500 text-zinc-950'
                    : step > 1
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                }`}
              >
                {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${step === 1 ? 'text-slate-900 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400'}`}>
                {t.setup_step_lang}
              </span>
            </div>

            <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-zinc-800" />

            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 2
                    ? 'bg-lime-500 text-zinc-950'
                    : step > 2
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                }`}
              >
                {step > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${step === 2 ? 'text-slate-900 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400'}`}>
                {t.setup_step_biz}
              </span>
            </div>

            <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-zinc-800" />

            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === 3
                    ? 'bg-lime-500 text-zinc-950'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                }`}
              >
                3
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${step === 3 ? 'text-slate-900 dark:text-zinc-100 font-semibold' : 'text-slate-500 dark:text-zinc-400'}`}>
                {t.setup_step_review}
              </span>
            </div>
          </div>
        </div>

        {/* Wizard Main Card */}
        <div className="bg-white dark:bg-zinc-900 py-6 px-4 shadow-sm sm:rounded-2xl sm:px-8 border border-slate-200 dark:border-zinc-800">
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* STEP 1: REGIONAL & LANGUAGE PRESETS */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-lime-600 dark:text-lime-400" />
                  {t.setup_step_lang}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Select your primary language and store jurisdiction. Country selection sets your base currency, precision, and timezone.
                </p>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
                  Interface Language
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'en', label: 'English', sub: 'Default (LTR)' },
                    { id: 'ml', label: 'മലയാളം', sub: 'Malayalam' },
                    { id: 'ar', label: 'العربية', sub: 'Arabic (RTL)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`onboarding-lang-${item.id}`}
                      onClick={() => onLanguageChange(item.id as Language)}
                      className={`min-h-[48px] p-3 text-left rounded-xl border flex flex-col justify-center transition-all ${
                        currentLanguage === item.id
                          ? 'border-lime-500 bg-lime-50/50 dark:bg-lime-950/20 ring-1 ring-lime-500 text-slate-900 dark:text-zinc-100'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/50'
                      }`}
                    >
                      <span className="font-semibold text-sm">{item.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
                  Country & Jurisdiction
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
                  {COUNTRY_OPTIONS.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      data-testid={`onboarding-country-${c.code.toLowerCase()}`}
                      onClick={() => handleCountrySelect(c.code)}
                      className={`min-h-[48px] p-3 text-left rounded-xl border flex items-center justify-between transition-all ${
                        selectedCountryCode === c.code
                          ? 'border-lime-500 bg-lime-50/50 dark:bg-lime-950/20 ring-1 ring-lime-500 text-slate-900 dark:text-zinc-100'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/50'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm">{c.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {c.currencyCode} ({c.currencySymbol}) • {c.exponent} Decimals • {c.timezone}
                        </div>
                      </div>
                      {selectedCountryCode === c.code && (
                        <CheckCircle2 className="w-5 h-5 text-lime-600 dark:text-lime-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Lock Notice */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">{t.setup_currency_notice}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Selected base currency: <strong>{formData.currency_code} ({formData.currency_symbol})</strong> with <strong>{formData.currency_exponent} decimal places</strong> and timezone <strong>{formData.timezone}</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  data-testid="onboarding-next-step-1"
                  onClick={handleNextFromStep1}
                  className="min-h-[48px] w-full sm:w-auto px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <span>Continue to Business Profile</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS PROFILE */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Store className="w-5 h-5 text-lime-600 dark:text-lime-400" />
                  {t.setup_step_biz}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Enter your store details. These details appear on printed invoices and receipts.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                    Store / Trading Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="onboarding-input-business-name"
                    value={formData.business_name}
                    onChange={(e) => handleInputChange('business_name', e.target.value)}
                    placeholder="e.g. Zen Supermarket & Department Store"
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                      validationErrors.business_name
                        ? 'border-red-500'
                        : 'border-slate-300 dark:border-zinc-700'
                    }`}
                  />
                  {validationErrors.business_name && (
                    <p className="text-[11px] text-red-500 mt-1">{validationErrors.business_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      Legal Name (Optional)
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-input-legal-name"
                      value={formData.legal_name || ''}
                      onChange={(e) => handleInputChange('legal_name', e.target.value)}
                      placeholder="e.g. Zen Retail Private Limited"
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      Tax Identifier (GSTIN / TRN / VATIN - Optional)
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-input-tax-id"
                      value={formData.tax_identifier || ''}
                      onChange={(e) => handleInputChange('tax_identifier', e.target.value)}
                      placeholder="e.g. 32AAAAA0000A1Z5 or 100000000000003"
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm font-mono text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      data-testid="onboarding-input-phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+91 9876543210"
                      className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                        validationErrors.phone
                          ? 'border-red-500'
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}
                    />
                    {validationErrors.phone && (
                      <p className="text-[11px] text-red-500 mt-1">{validationErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      data-testid="onboarding-input-email"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="billing@zenretail.com"
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                    Street Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="onboarding-input-address1"
                    value={formData.address_line1}
                    onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    placeholder="Shop No. 4, Market Junction"
                    className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                      validationErrors.address_line1
                        ? 'border-red-500'
                        : 'border-slate-300 dark:border-zinc-700'
                    }`}
                  />
                  {validationErrors.address_line1 && (
                    <p className="text-[11px] text-red-500 mt-1">{validationErrors.address_line1}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-input-city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="e.g. Kochi"
                      className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                        validationErrors.city
                          ? 'border-red-500'
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}
                    />
                    {validationErrors.city && (
                      <p className="text-[11px] text-red-500 mt-1">{validationErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      State / Province <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-input-state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="e.g. Kerala"
                      className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                        validationErrors.state
                          ? 'border-red-500'
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}
                    />
                    {validationErrors.state && (
                      <p className="text-[11px] text-red-500 mt-1">{validationErrors.state}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-1">
                      {isPostalCodeRequired ? (
                        <>
                          Postal Code <span className="text-red-500">*</span>
                        </>
                      ) : (
                        'Postal Code (Optional)'
                      )}
                    </label>
                    <input
                      type="text"
                      data-testid="onboarding-input-postal"
                      value={formData.postal_code}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      placeholder={isPostalCodeRequired ? 'e.g. 682001' : 'e.g. 00000 or leave blank'}
                      className={`w-full min-h-[44px] px-3.5 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-lime-500 focus:outline-none ${
                        validationErrors.postal_code
                          ? 'border-red-500'
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}
                    />
                    {validationErrors.postal_code && (
                      <p className="text-[11px] text-red-500 mt-1">{validationErrors.postal_code}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid="onboarding-back-to-step-1"
                  onClick={() => setStep(1)}
                  className="min-h-[48px] w-full sm:w-auto px-5 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Regional Setup</span>
                </button>

                <button
                  type="button"
                  data-testid="onboarding-next-step-2"
                  onClick={handleNextFromStep2}
                  className="min-h-[48px] w-full sm:w-auto px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <span>Review & Complete</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & ATOMIC SAVE */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  {t.setup_step_review}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Please review your store profile before opening. These settings will be committed to your local SQLite database.
                </p>
              </div>

              {/* Review Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Store Identity
                  </h3>
                  <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {formData.business_name}
                  </div>
                  {formData.legal_name && (
                    <div className="text-xs text-slate-600 dark:text-zinc-400">
                      Legal: {formData.legal_name}
                    </div>
                  )}
                  {formData.tax_identifier && (
                    <div className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                      Tax ID: {formData.tax_identifier}
                    </div>
                  )}
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Phone: {formData.phone}
                  </div>
                  {formData.email && (
                    <div className="text-xs text-slate-600 dark:text-zinc-400">
                      Email: {formData.email}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Regional & Currency
                  </h3>
                  <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>{formData.country}</span>
                    <span className="text-xs font-mono text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-950/40 px-2 py-0.5 rounded-full border border-lime-200 dark:border-lime-900">
                      {formData.currency_code} ({formData.currency_symbol})
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Precision: {formData.currency_exponent} Decimal Places
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Timezone: {formData.timezone}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">
                    Address: {formData.address_line1}, {formData.city}, {formData.state} - {formData.postal_code}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-lime-50/70 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-900/50 rounded-xl text-xs text-slate-700 dark:text-zinc-300">
                <p className="font-semibold text-lime-900 dark:text-lime-400 mb-1">
                  Ready to launch BillZen
                </p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Saving will complete your first-use setup, persist your store profile in SQLite with WAL durability, and unlock the full product catalog and inventory ledger.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid="onboarding-back-to-step-2"
                  disabled={isSaving}
                  onClick={() => setStep(2)}
                  className="min-h-[48px] w-full sm:w-auto px-5 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Profile</span>
                </button>

                <button
                  type="button"
                  data-testid="onboarding-submit-button"
                  disabled={isSaving}
                  onClick={handleFinalSubmit}
                  className="min-h-[48px] w-full sm:w-auto px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>{t.setup_saving}</span>
                  ) : (
                    <>
                      <span>{t.setup_complete_button}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
