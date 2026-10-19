import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsView } from './components/SettingsView';
import { PrintFeasibilityProbe } from './components/PrintFeasibilityProbe';
import { PrintableInvoiceDocument } from './components/PrintableInvoiceDocument';
import { PrintableVoucherDocument } from './components/PrintableVoucherDocument';
import { ProductCatalogView } from './components/ProductCatalogView';
import { CustomerCatalogView } from './components/CustomerCatalogView';
import { CashbookView } from './components/CashbookView';
import { OnboardingSetupWizard } from './components/OnboardingSetupWizard';
import { GettingStartedGuide } from './components/GettingStartedGuide';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { pingBackend, getBusinessSettings, isTauriEnvironment } from './adapters/tauri';
import { getInvoiceForScenario } from './domain/test_scenarios';
import { translations, Language } from './i18n';
import type { BusinessSettings, ActivePrintDocument } from './types';
import { preparePrintStyles, cleanupPrintStyles } from './utils/print';
import {
  Building2,
  Printer,
  ShieldCheck,
  Database,
  Laptop,
  Package,
  Users,
  Globe,
  Wallet,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

type ActiveTab = 'cashbook' | 'products' | 'customers' | 'settings' | 'print';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cashbook');
  const [activePrintDocument, setActivePrintDocument] = useState<ActivePrintDocument>(null);
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('billzen_ui_language');
      if (stored === 'en' || stored === 'ml' || stored === 'ar') {
        return stored;
      }
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('billzen_ui_language', lang);
    } catch {}
  };

  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [isGuideReplay, setIsGuideReplay] = useState<boolean>(false);
  const hasAutoPromptedGuide = React.useRef(false);

  const { reconcilePreference } = useTheme();

  const client = useQueryClient();
  const isTauri = isTauriEnvironment();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const scenario = urlParams?.get('scenario') || null;
  const tabParam = urlParams?.get('tab') as ActiveTab | null;

  React.useEffect(() => {
    if (tabParam && ['cashbook', 'products', 'customers', 'settings', 'print'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const activeInvoice = React.useMemo(() => getInvoiceForScenario(scenario), [scenario]);
 
  React.useEffect(() => {
    if (activeTab === 'print') {
      setActivePrintDocument({ type: 'invoice', invoice: activeInvoice, format: 'a4' });
      preparePrintStyles('a4');
    } else {
      setActivePrintDocument((prev) => (prev?.type === 'invoice' ? null : prev));
      cleanupPrintStyles();
    }
  }, [activeTab, activeInvoice]);

  const { data: pingStatus } = useQuery({
    queryKey: ['backend_ping'],
    queryFn: pingBackend,
    refetchInterval: 10000,
  });

  const { data: settings } = useQuery({
    queryKey: ['business_settings'],
    queryFn: getBusinessSettings,
  });

  // Reconcile appearance preference from native SQLite store
  React.useEffect(() => {
    if (settings?.appearance_preference) {
      reconcilePreference(settings.appearance_preference as any);
    }
  }, [settings?.appearance_preference, reconcilePreference]);

  // Offer unseen guide after restart if setup is completed and guide is unseen
  React.useEffect(() => {
    if (!hasAutoPromptedGuide.current && settings?.is_setup_completed && settings?.guide_status === 'unseen') {
      hasAutoPromptedGuide.current = true;
      setIsGuideReplay(false);
      setShowGuide(true);
    }
  }, [settings?.is_setup_completed, settings?.guide_status]);

  const fallbackSettings: BusinessSettings = {
    id: 'default',
    business_name: 'BillZen Retail',
    legal_name: null,
    tax_identifier: '32AAAAA0000A1Z5',
    phone: '+91 9876543210',
    email: 'store@billzen.local',
    address_line1: '123 Market Road',
    address_line2: null,
    city: 'Kochi',
    state: 'Kerala',
    postal_code: '682001',
    country: 'India',
    currency_code: 'INR',
    currency_symbol: '₹',
    currency_exponent: 2,
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    invoice_prefix: 'INV',
    terms_and_conditions: 'Thank you for your business!',
    is_setup_completed: true,
    appearance_preference: 'system',
    guide_status: 'completed',
    guide_version: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const activeSettings = settings || fallbackSettings;

  // First-use Onboarding Wizard Gate
  if (settings && !settings.is_setup_completed) {
    return (
      <OnboardingSetupWizard
        initialSettings={settings}
        currentLanguage={language}
        onLanguageChange={setLanguage}
        onComplete={(completedSettings) => {
          client.setQueryData(['business_settings'], completedSettings);
          if (completedSettings.guide_status === 'unseen') {
            setIsGuideReplay(false);
            setShowGuide(true);
          }
        }}
      />
    );
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const environmentLabel = isTauri
    ? isAndroid
      ? 'Android (Tauri 2)'
      : 'Desktop (Tauri 2)'
    : 'Browser Mode';

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Application Bar (no-print) */}
      <header
        className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-20 no-print shadow-sm transition-colors"
        style={{
          paddingTop: isAndroid
            ? 'max(24px, env(safe-area-inset-top, 0px), var(--sat, 0px))'
            : 'max(0px, env(safe-area-inset-top, 0px), var(--sat, 0px))',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <img
              src="/brand/billzen-icon.svg"
              alt="BillZen"
              aria-hidden="true"
              width={36}
              height={36}
              className="w-8 h-8 sm:w-9 sm:h-9 shrink-0"
              draggable={false}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight">BillZen</h1>
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800 shrink-0">
                  beta
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 truncate">Offline Billing System</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (hidden on mobile/tablet, shown on lg and above) */}
          <nav className="hidden lg:flex space-x-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('cashbook')}
              data-testid="tab-cashbook"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'cashbook'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-lime-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Wallet className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              {t.tab_cashbook}
            </button>

            <button
              onClick={() => setActiveTab('products')}
              data-testid="tab-products"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'products'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-lime-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Package className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              {t.tab_products}
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              data-testid="tab-customers"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'customers'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-lime-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Users className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              {t.tab_customers}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              data-testid="tab-settings"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-lime-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Building2 className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              {t.tab_settings}
            </button>

            <button
              onClick={() => setActiveTab('print')}
              data-testid="tab-print"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'print'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-lime-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
              {t.tab_print_probe}
            </button>
          </nav>

          {/* Right Controls: Language Selector & Environment Status */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-zinc-400 ml-1" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                data-testid="language-select"
                aria-label="Select Language"
                className="text-xs bg-transparent border-none text-slate-700 dark:text-zinc-200 font-medium focus:outline-none pr-1 cursor-pointer"
              >
                <option value="en" className="dark:bg-zinc-900">English (EN)</option>
                <option value="ml" className="dark:bg-zinc-900">മലയാളം (ML)</option>
                <option value="ar" className="dark:bg-zinc-900">العربية (AR)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 sm:px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-850">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{environmentLabel}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area with bottom padding on mobile for thumb bar */}
      <main
        className="flex-1 w-full mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8 pb-28 lg:pb-6"
        style={{
          paddingBottom: 'calc(4.5rem + max(0.5rem, env(safe-area-inset-bottom, 0px), var(--sab, 0px)))',
        }}
      >
        {activeTab === 'cashbook' && (
          <CashbookView
            settings={activeSettings}
            language={language}
            onSetActivePrintDocument={setActivePrintDocument}
          />
        )}
        {activeTab === 'products' && (
          <ProductCatalogView settings={activeSettings} language={language} />
        )}
        {activeTab === 'customers' && (
          <CustomerCatalogView settings={activeSettings} language={language} />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            currentLanguage={language}
            onViewGuide={() => {
              setIsGuideReplay(true);
              setShowGuide(true);
            }}
          />
        )}
        {activeTab === 'print' && <PrintFeasibilityProbe invoice={activeInvoice} />}
      </main>

      {/* Mobile Bottom Navigation Bar (no-print, <lg only) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 shadow-lg px-2 flex justify-around items-center no-print transition-colors"
        style={{
          paddingBottom: isAndroid
            ? 'max(1.5rem, env(safe-area-inset-bottom, 0px), var(--sab, 0px))'
            : 'max(0.5rem, env(safe-area-inset-bottom, 0px), var(--sab, 0px))',
          paddingTop: '0.25rem',
        }}
      >
        <button
          onClick={() => setActiveTab('cashbook')}
          data-testid="mobile-tab-cashbook"
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'cashbook'
              ? 'text-indigo-600 dark:text-lime-400 font-semibold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Wallet className={`w-5 h-5 mb-0.5 ${activeTab === 'cashbook' ? 'text-indigo-600 dark:text-lime-400' : 'text-slate-400 dark:text-zinc-500'}`} />
          <span>{t.tab_cashbook}</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          data-testid="mobile-tab-products"
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'products'
              ? 'text-indigo-600 dark:text-lime-400 font-semibold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Package className={`w-5 h-5 mb-0.5 ${activeTab === 'products' ? 'text-indigo-600 dark:text-lime-400' : 'text-slate-400 dark:text-zinc-500'}`} />
          <span>{t.tab_products}</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          data-testid="mobile-tab-customers"
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'customers'
              ? 'text-indigo-600 dark:text-lime-400 font-semibold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Users className={`w-5 h-5 mb-0.5 ${activeTab === 'customers' ? 'text-indigo-600 dark:text-lime-400' : 'text-slate-400 dark:text-zinc-500'}`} />
          <span>{t.tab_customers}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          data-testid="mobile-tab-settings"
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-indigo-600 dark:text-lime-400 font-semibold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Building2 className={`w-5 h-5 mb-0.5 ${activeTab === 'settings' ? 'text-indigo-600 dark:text-lime-400' : 'text-slate-400 dark:text-zinc-500'}`} />
          <span>{t.tab_settings}</span>
        </button>

        <button
          onClick={() => setActiveTab('print')}
          data-testid="mobile-tab-print"
          aria-label={t.tab_print_probe}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'print'
              ? 'text-indigo-600 dark:text-lime-400 font-semibold'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Printer className={`w-5 h-5 mb-0.5 ${activeTab === 'print' ? 'text-indigo-600 dark:text-lime-400' : 'text-slate-400 dark:text-zinc-500'}`} />
          <span className="truncate max-w-[76px] text-[11px] leading-tight text-center">{t.tab_print_probe_short}</span>
        </button>
      </nav>

      {/* Getting-Started Guide Modal */}
      <GettingStartedGuide
        currentLanguage={language}
        isOpen={showGuide}
        isReplay={isGuideReplay}
        onClose={() => setShowGuide(false)}
      />

      {/* Global Active Printable Document Container: Isolated and formatted exclusively for print media */}
      {activePrintDocument && (
        <div id="active-printable-container" className="hidden print:block">
          {activePrintDocument.type === 'invoice' && (
            <PrintableInvoiceDocument invoice={activePrintDocument.invoice} />
          )}
          {activePrintDocument.type === 'voucher' && (
            <PrintableVoucherDocument
              voucher={activePrintDocument.voucher}
              format={activePrintDocument.format}
              isPrintTarget={true}
            />
          )}
        </div>
      )}

      {/* Desktop Bottom Status Bar (no-print, hidden on mobile) */}
      <footer className="hidden md:block bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-zinc-400 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              SQLite WAL (synchronous=FULL)
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Single-Instance Lock Active
            </span>
            <span className="flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              IPC: {pingStatus ? `Active (${pingStatus})` : 'Connecting...'}
            </span>
          </div>
          <div className="text-slate-400 dark:text-zinc-500">
            Milestones M1–M3 Complete • Offline-First Multi-Regional Engine
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
