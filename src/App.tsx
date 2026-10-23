import { DesktopNavigation, MobileNavigation, type AppTab } from './components/AppNavigation';
import {useUpdateStartupCheck} from './hooks/useUpdateStartupCheck';
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsView } from './components/SettingsView';
import { PrintableInvoiceDocument } from './components/PrintableInvoiceDocument';
import { PrintableVoucherDocument } from './components/PrintableVoucherDocument';
import { ProductCatalogView } from './components/ProductCatalogView';
import { CustomerCatalogView } from './components/CustomerCatalogView';
import { CashbookView } from './components/CashbookView';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { PrintableReportDocument } from './components/PrintableReportDocument';
import { OnboardingSetupWizard } from './components/OnboardingSetupWizard';
import { GettingStartedGuide } from './components/GettingStartedGuide';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { getBusinessSettings } from './adapters/tauri';
import { getInvoiceForScenario } from './domain/test_scenarios';
import type { Language } from './i18n';
import type { CustomerReceiptIntent, CustomerReportFilter } from './types/cashbook';
import type { BusinessSettings, ActivePrintDocument } from './types';
import { preparePrintStyles, cleanupPrintStyles } from './utils/print';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

type ActiveTab = AppTab;

const AppContent: React.FC = () => {
  useUpdateStartupCheck();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [cashbookInitialModal, setCashbookInitialModal] = useState<'inflow' | 'outflow' | null>(null);
  const [customerReceiptIntent, setCustomerReceiptIntent] = useState<CustomerReceiptIntent | null>(null);
  const [reportFilter, setReportFilter] = useState<CustomerReportFilter | undefined>();
  const [reportPartyId, setReportPartyId] = useState<string>('');
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
  const isRTL = language === 'ar';
  React.useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const scenario = urlParams?.get('scenario') || null;
  const tabParam = urlParams?.get('tab') as ActiveTab | null;

  React.useEffect(() => {
    if (tabParam && ['dashboard', 'reports', 'cashbook', 'products', 'customers', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const activeInvoice = React.useMemo(() => scenario ? getInvoiceForScenario(scenario) : null, [scenario]);
 
  React.useEffect(() => {
    // Explicit synthetic invoice fixtures keep automated PDF checks independent of navigation.
    if (activeInvoice) {
      setActivePrintDocument({ type: 'invoice', invoice: activeInvoice, format: 'a4' });
      preparePrintStyles('a4');
    } else {
      setActivePrintDocument((prev) => (prev?.type === 'invoice' ? null : prev));
      cleanupPrintStyles();
    }
  }, [activeInvoice]);

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


  return (
    <div className={`min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)] flex flex-col font-sans transition-colors ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Application Bar (no-print) */}
      <header
        className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] sticky top-0 z-20 no-print shadow-sm transition-colors"
        style={{
          paddingTop: isAndroid
            ? 'max(24px, env(safe-area-inset-top, 0px), var(--sat, 0px))'
            : 'max(0px, env(safe-area-inset-top, 0px), var(--sat, 0px))',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2 flex items-center justify-between gap-2 sm:gap-4">
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
                <h1 className="text-base sm:text-lg font-bold text-[var(--text-main)] tracking-tight">BillZen</h1>
                <span className="hidden min-[400px]:inline text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-[#ceeaa0] text-[#142811] dark:bg-[#1e3518] dark:text-[#ceeaa0] dark:border dark:border-[#7cb342]/40 font-bold shrink-0">
                  beta
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate font-medium">Offline Business Suite</p>
            </div>
          </div>

        </div>
        <DesktopNavigation activeTab={activeTab} language={language} onNavigate={setActiveTab} />
      </header>

      {/* Main Content Area with bottom padding on mobile for thumb bar */}
      <main
        className="app-main flex-1 min-w-0 w-full mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8"
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            settings={activeSettings}
            language={language}
            onNavigateToReports={() => setActiveTab('reports')}
            onNavigateToCashbook={(filter) => {
              if (filter?.direction) setCashbookInitialModal(filter.direction);
              setActiveTab('cashbook');
            }}
            onOpenReceiptModal={() => {
              setCashbookInitialModal('inflow');
              setActiveTab('cashbook');
            }}
            onOpenPaymentModal={() => {
              setCashbookInitialModal('outflow');
              setActiveTab('cashbook');
            }}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsView
            initialPartyId={reportPartyId}
            initialStartDate={reportFilter?.start_date}
            initialEndDate={reportFilter?.end_date}
            initialAccountId={reportFilter?.account_id}
            settings={activeSettings}
            language={language}
            onPrintReport={(reportData) => {
              setActivePrintDocument({ type: 'report', reportData, format: 'a4' });
              preparePrintStyles('a4');
              setTimeout(() => {
                window.print();
              }, 100);
            }}
          />
        )}
        {activeTab === 'cashbook' && (
          <CashbookView
            settings={activeSettings}
            language={language}
            onSetActivePrintDocument={setActivePrintDocument}
            customerReceiptIntent={customerReceiptIntent}
            initialModal={cashbookInitialModal}
            onClearInitialModal={() => { setCashbookInitialModal(null); setCustomerReceiptIntent(null); }}
          />
        )}
        {activeTab === 'products' && (
          <ProductCatalogView settings={activeSettings} language={language} />
        )}
        {activeTab === 'customers' && (
          <CustomerCatalogView settings={activeSettings} language={language}
            onReceiveMoney={intent => { setCustomerReceiptIntent(intent); setCashbookInitialModal('inflow'); setActiveTab('cashbook'); }}
            onViewReport={(partyId, filter) => { setReportPartyId(partyId); setReportFilter(filter); setActiveTab('reports'); }} />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            currentLanguage={language}
            onLanguageChange={setLanguage}
            onViewGuide={() => {
              setIsGuideReplay(true);
              setShowGuide(true);
            }}
          />
        )}
      </main>

      <MobileNavigation activeTab={activeTab} language={language} onNavigate={setActiveTab} />

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
          {activePrintDocument.type === 'report' && (
            <PrintableReportDocument
              reportData={activePrintDocument.reportData}
              isPrintTarget={true}
            />
          )}
        </div>
      )}


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
