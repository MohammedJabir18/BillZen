import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SettingsView } from './components/SettingsView';
import { PrintFeasibilityProbe } from './components/PrintFeasibilityProbe';
import { PrintableInvoiceDocument } from './components/PrintableInvoiceDocument';
import { ProductCatalogView } from './components/ProductCatalogView';
import { CustomerCatalogView } from './components/CustomerCatalogView';
import { pingBackend, getBusinessSettings, isTauriEnvironment } from './adapters/tauri';
import { getInvoiceForScenario } from './domain/test_scenarios';
import { translations, Language } from './i18n';
import {
  Building2,
  Printer,
  ShieldCheck,
  Database,
  Laptop,
  Package,
  Users,
  Globe,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

type ActiveTab = 'products' | 'customers' | 'settings' | 'print';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [language, setLanguage] = useState<Language>('en');
  const isTauri = isTauriEnvironment();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const scenario = urlParams?.get('scenario') || null;
  const tabParam = urlParams?.get('tab') as ActiveTab | null;

  React.useEffect(() => {
    if (tabParam && ['products', 'customers', 'settings', 'print'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const activeInvoice = React.useMemo(() => getInvoiceForScenario(scenario), [scenario]);

  const { data: pingStatus } = useQuery({
    queryKey: ['backend_ping'],
    queryFn: pingBackend,
    refetchInterval: 10000,
  });

  const { data: settings } = useQuery({
    queryKey: ['business_settings'],
    queryFn: getBusinessSettings,
  });

  const fallbackSettings = {
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
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const activeSettings = settings || fallbackSettings;

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Application Bar (no-print) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 no-print shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <img
              src="/brand/billzen-icon.svg"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="w-9 h-9 shrink-0"
              draggable={false}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">BillZen</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-200">
                  v0.1.0-alpha
                </span>
              </div>
              <p className="text-xs text-slate-500">Offline Desktop Billing System</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('products')}
              data-testid="tab-products"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'products'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-4 h-4 text-slate-600" />
              {t.tab_products}
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              data-testid="tab-customers"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'customers'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 text-slate-600" />
              {t.tab_customers}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              data-testid="tab-settings"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-4 h-4 text-slate-600" />
              {t.tab_settings}
            </button>

            <button
              onClick={() => setActiveTab('print')}
              data-testid="tab-print"
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'print'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Printer className="w-4 h-4 text-slate-600" />
              {t.tab_print_probe}
            </button>
          </nav>

          {/* Right Controls: Language Selector & Environment Status */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <Globe className="w-4 h-4 text-slate-500 ml-1.5" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                data-testid="language-select"
                className="text-xs bg-transparent border-none text-slate-700 font-medium focus:outline-none pr-1 cursor-pointer"
              >
                <option value="en">English (EN)</option>
                <option value="ml">മലയാളം (ML)</option>
                <option value="ar">العربية (AR)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {isTauri ? 'Desktop (Tauri 2)' : 'Browser Mode'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full mx-auto py-6">
        {activeTab === 'products' && (
          <ProductCatalogView settings={activeSettings} language={language} />
        )}
        {activeTab === 'customers' && (
          <CustomerCatalogView settings={activeSettings} language={language} />
        )}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'print' && <PrintFeasibilityProbe invoice={activeInvoice} />}
      </main>

      {/* Global Printable Document Container: Isolated and formatted exclusively for print media */}
      <div className="hidden print:block">
        <PrintableInvoiceDocument invoice={activeInvoice} />
      </div>

      {/* Bottom Status Bar (no-print) */}
      <footer className="bg-white border-t border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 no-print">
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
          <div className="text-slate-400">
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
      <AppContent />
    </QueryClientProvider>
  );
}
