import { useEffect, useRef, useState } from 'react';
import { Building2, FileText, LayoutDashboard, MoreHorizontal, Package, Printer, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { translations, type Language } from '../i18n';
import { useBackHandler } from '../hooks/useBackHandler';

export type AppTab = 'dashboard' | 'reports' | 'cashbook' | 'products' | 'customers' | 'settings' | 'print';
interface NavigationProps { activeTab: AppTab; language: Language; onNavigate: (tab: AppTab) => void }
interface Destination { id: AppTab; label: string; icon: LucideIcon }

function destinations(language: Language): Destination[] {
  const t = translations[language];
  return [
    { id: 'dashboard', label: t.tab_dashboard, icon: LayoutDashboard },
    { id: 'cashbook', label: t.tab_cashbook, icon: Wallet },
    { id: 'reports', label: t.tab_reports, icon: FileText },
    { id: 'products', label: t.tab_products, icon: Package },
    { id: 'customers', label: t.tab_customers, icon: Users },
    { id: 'settings', label: t.tab_settings, icon: Building2 },
    { id: 'print', label: t.tab_print_probe, icon: Printer },
  ];
}

export function DesktopNavigation({ activeTab, language, onNavigate }: NavigationProps) {
  return (
    <nav aria-label="Main Navigation" className="hidden lg:block border-t border-[#e5e9df] dark:border-[#242c26] bg-[#f8f9f6] dark:bg-[#0c0f0d] no-print transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-7 gap-1 px-4 py-1.5">
        {destinations(language).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" data-testid={'tab-' + id} aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={`min-w-0 min-h-11 flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f3d23] dark:focus-visible:ring-[#ceeaa0] ${activeTab === id
              ? 'bg-[#1f3d23] text-white shadow-sm dark:bg-[#2e5733] dark:text-[#ceeaa0]'
              : 'text-[#576356] dark:text-[#9eaba0] hover:bg-[#f2f4ef] dark:hover:bg-[#1e261f] hover:text-[#141915] dark:hover:text-[#f0f3ee]'}`}>
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function MobileNavigation({ activeTab, language, onNavigate }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useBackHandler(open, () => setOpen(false));
  const t = translations[language];
  const items = destinations(language);
  const primary = items.slice(0, 3);
  const secondary = items.slice(3);
  const secondaryActive = secondary.some(item => item.id === activeTab);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (breakpoint.matches) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    breakpoint.addEventListener('change', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      breakpoint.removeEventListener('change', onResize);
      window.removeEventListener('keydown', onKey);
      if (trigger.current?.getClientRects().length) trigger.current.focus();
    };
  }, [open]);

  const select = (tab: AppTab) => { setOpen(false); onNavigate(tab); };
  const itemClass = (active: boolean) => `min-w-0 min-h-[60px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[11px] leading-snug font-semibold transition-all active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f3d23] dark:focus-visible:ring-[#ceeaa0] ${active
    ? 'text-[#1f3d23] dark:text-[#ceeaa0] bg-[#eef8f0] dark:bg-[#1e261f] border border-[#1f3d23]/20 dark:border-[#ceeaa0]/25'
    : 'text-[#576356] dark:text-[#9eaba0] hover:bg-[#f2f4ef] dark:hover:bg-[#1e261f]'}`;

  return (
    <>
      <nav aria-label="Mobile Navigation" className="app-mobile-nav lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#ffffff] dark:bg-[#141915] border-t border-[#e5e9df] dark:border-[#242c26] shadow-lg px-2 pt-1 grid grid-cols-4 gap-1 no-print transition-colors">
        {primary.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" data-testid={'mobile-tab-' + id} aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => select(id)} className={itemClass(activeTab === id)}>
            <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="w-full [overflow-wrap:anywhere] text-center">{label}</span>
          </button>
        ))}
        <button ref={trigger} type="button" id="mobile-nav-more" data-testid="mobile-nav-more" aria-haspopup="dialog" aria-expanded={open}
          aria-controls="mobile-more-navigation" aria-current={secondaryActive ? 'page' : undefined}
          onClick={() => setOpen(value => !value)} className={itemClass(secondaryActive || open)}>
          <MoreHorizontal className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{t.nav_more}</span>
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <button type="button" aria-label={t.action_cancel} className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} tabIndex={-1} />
          <div ref={dialog} id="mobile-more-navigation" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"
            className="app-more-navigation absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-x border-[#e5e9df] dark:border-[#242c26] bg-[#ffffff] dark:bg-[#141915] p-4 shadow-2xl transition-colors">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id="mobile-more-title" className="font-bold text-[#141915] dark:text-[#f0f3ee] tracking-tight">{t.nav_more_title}</h2>
              <button type="button" aria-label={t.action_cancel} onClick={() => setOpen(false)} className="min-h-11 min-w-11 grid place-items-center rounded-lg text-[#576356] dark:text-[#9eaba0] hover:bg-[#f2f4ef] dark:hover:bg-[#1e261f] active:scale-[0.975]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {secondary.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" data-testid={'mobile-tab-' + id} aria-current={activeTab === id ? 'page' : undefined}
                  onClick={() => select(id)} className={`min-h-20 min-w-0 p-3 flex items-center justify-between gap-2.5 rounded-xl border text-start text-sm transition-all active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f3d23] dark:focus-visible:ring-[#ceeaa0] ${activeTab === id
                    ? 'border-[#1f3d23] dark:border-[#ceeaa0] bg-[#eef8f0] dark:bg-[#1e261f] text-[#1f3d23] dark:text-[#ceeaa0] font-semibold shadow-sm'
                    : 'border-[#e5e9df] dark:border-[#242c26] bg-[#f8f9f6] dark:bg-[#0c0f0d] text-[#141915] dark:text-[#f0f3ee] hover:bg-[#f2f4ef] dark:hover:bg-[#1e261f] font-medium'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-5 h-5 shrink-0 text-[#1f3d23] dark:text-[#ceeaa0]" aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
                  </div>
                  <span className="text-[#788677] dark:text-[#6f7c71] text-xs shrink-0" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
