import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SettingsView } from './components/SettingsView';
import { PrintFeasibilityProbe } from './components/PrintFeasibilityProbe';
import { PrintableInvoiceDocument } from './components/PrintableInvoiceDocument';
import { pingBackend, isTauriEnvironment } from './adapters/tauri';
import { getInvoiceForScenario } from './domain/test_scenarios';
import { Building2, Printer, ShieldCheck, Database, Laptop } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

type ActiveTab = 'settings' | 'print';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('settings');
  const isTauri = isTauriEnvironment();

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const scenario = urlParams?.get('scenario') || null;
  const activeInvoice = React.useMemo(() => getInvoiceForScenario(scenario), [scenario]);

  const { data: pingStatus } = useQuery({
    queryKey: ['backend_ping'],
    queryFn: pingBackend,
    refetchInterval: 10000,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Application Bar (no-print) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              BZ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">BillZen</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  v0.1.0-alpha
                </span>
              </div>
              <p className="text-xs text-slate-500">Offline Desktop Billing System</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-4 h-4 text-slate-600" />
              Store Settings
            </button>
            <button
              onClick={() => setActiveTab('print')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'print'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print & Layout Probe
            </button>
          </nav>

          {/* Environment & Backend Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {isTauri ? 'Desktop (Tauri 2)' : 'Browser Mode'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'print' && <PrintFeasibilityProbe invoice={activeInvoice} />}
      </main>

      {/* Global Printable Document Container: Isolated and formatted exclusively for print media */}
      <div className="hidden print:block">
        <PrintableInvoiceDocument invoice={activeInvoice} />
      </div>

      {/* Bottom Status Bar (no-print) */}
      <footer className="bg-white border-t border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
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
            Milestones M1–M2 Complete • Ready for M3 Catalog
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
