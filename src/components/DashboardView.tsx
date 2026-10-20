import React, { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BarChart2,
  List,
  CheckCircle2,
} from 'lucide-react';
import type { BusinessSettings } from '../types';
import type { Language } from '../i18n';
import { translations } from '../i18n';
import { getMoneyAccounts, getCashbookLedger } from '../adapters/cashbook';
import { getTodayBusinessDate, formatMinorUnits } from '../domain/financial';

interface DashboardViewProps {
  settings: BusinessSettings;
  language: Language;
  onNavigateToReports?: () => void;
  onNavigateToCashbook?: (filter?: { direction?: 'inflow' | 'outflow' }) => void;
  onOpenReceiptModal?: () => void;
  onOpenPaymentModal?: () => void;
  initialAccountId?: string;
  initialPeriod?: PeriodType;
}

export type PeriodType = 'today' | 'month' | 'year' | 'custom';
export type ViewMode = 'simple' | 'analytics';

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  language,
  onNavigateToReports,
  onNavigateToCashbook,
  onOpenReceiptModal,
  onOpenPaymentModal,
  initialAccountId,
  initialPeriod,
}) => {
  const t = translations[language] || translations.en;
  const currencyExponent = settings.currency_exponent ?? 2;
  const currencySymbol = settings.currency_symbol ?? '₹';
  const timezone = settings.timezone || 'Asia/Kolkata';

  const todayStr = useMemo(() => getTodayBusinessDate(timezone), [timezone]);

  // Period state
  const [period, setPeriod] = useState<PeriodType>(initialPeriod || 'today');
  const [mode, setMode] = useState<ViewMode>('simple');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || 'all');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Selected bar in analytics view for accessible details
  const [selectedBarLabel, setSelectedBarLabel] = useState<string | null>(null);

  // Reference date for navigating days, months, years
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);

  // Compute active date range based on period and referenceDate
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (period === 'today') {
      const d = referenceDate;
      let label = d;
      try {
        const [y, m, day] = d.split('-').map(Number);
        const dateObj = new Date(y, m - 1, day);
        label = new Intl.DateTimeFormat(
          language === 'ml' ? 'ml-IN' : language === 'ar' ? 'ar-SA' : 'en-IN',
          { day: 'numeric', month: 'long', year: 'numeric' }
        ).format(dateObj);
      } catch {}
      return { startDate: d, endDate: d, periodLabel: label };
    }

    if (period === 'month') {
      const ym = referenceDate.slice(0, 7);
      const start = `${ym}-01`;
      const [y, m] = ym.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = ym === todayStr.slice(0, 7) ? todayStr : `${ym}-${String(lastDay).padStart(2, '0')}`;

      let label = ym;
      try {
        const dateObj = new Date(y, m - 1, 1);
        label = new Intl.DateTimeFormat(
          language === 'ml' ? 'ml-IN' : language === 'ar' ? 'ar-SA' : 'en-IN',
          { month: 'long', year: 'numeric' }
        ).format(dateObj);
      } catch {}
      return { startDate: start, endDate: end, periodLabel: label };
    }

    if (period === 'year') {
      const year = referenceDate.slice(0, 4);
      const start = `${year}-01-01`;
      const end = year === todayStr.slice(0, 4) ? todayStr : `${year}-12-31`;
      return { startDate: start, endDate: end, periodLabel: year };
    }

    // custom
    return {
      startDate: customStartDate || todayStr,
      endDate: customEndDate || todayStr,
      periodLabel: `${customStartDate} → ${customEndDate}`,
    };
  }, [period, referenceDate, customStartDate, customEndDate, todayStr, language]);

  // Step backward / forward
  const handleStepPeriod = (direction: -1 | 1) => {
    setSelectedBarLabel(null);
    if (period === 'today') {
      const [y, m, d] = referenceDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d + direction);
      const newStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      setReferenceDate(newStr);
    } else if (period === 'month') {
      const [y, m] = referenceDate.split('-').map(Number);
      const dt = new Date(y, m - 1 + direction, 1);
      const newStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
      setReferenceDate(newStr);
    } else if (period === 'year') {
      const y = Number(referenceDate.slice(0, 4)) + direction;
      setReferenceDate(`${y}-01-01`);
    }
  };

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ['money_accounts'],
    queryFn: getMoneyAccounts,
  });

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.is_archived), [accounts]);

  // Which accounts to display in the account balances strip:
  // - When 'all' is selected: display all active accounts.
  // - When a specific account is selected: display only that account (even if archived).
  const displayedAccounts = useMemo(() => {
    if (selectedAccountId === 'all') {
      return activeAccounts;
    }
    const found = accounts.find((a) => a.id === selectedAccountId);
    return found ? [found] : [];
  }, [selectedAccountId, activeAccounts, accounts]);

  const isSelectedAccountArchived = useMemo(() => {
    if (selectedAccountId === 'all') return false;
    return accounts.find((a) => a.id === selectedAccountId)?.is_archived ?? false;
  }, [selectedAccountId, accounts]);

  // Main ledger query for the dashboard
  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
    isError: isLedgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: ['cashbook_ledger', startDate, endDate, selectedAccountId],
    queryFn: () =>
      getCashbookLedger({
        start_date: startDate,
        end_date: endDate,
        account_id: selectedAccountId === 'all' ? undefined : selectedAccountId,
        include_archived: isSelectedAccountArchived,
      }),
  });

  // Query individual displayed accounts to ensure strip balances consistently reflect
  // the exact closing balance for the active period cutoff date
  const accountLedgerQueries = useQueries({
    queries: displayedAccounts.map((acc) => ({
      queryKey: ['cashbook_ledger', startDate, endDate, acc.id],
      queryFn: () =>
        getCashbookLedger({
          start_date: startDate,
          end_date: endDate,
          account_id: acc.id,
          include_archived: acc.is_archived,
        }),
      staleTime: 30000,
    })),
  });

  interface AccountStripState {
    balance: number | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  }

  const accountStatesMap = useMemo(() => {
    const map = new Map<string, AccountStripState>();
    displayedAccounts.forEach((acc, i) => {
      const q = accountLedgerQueries[i];
      // Leverage main ledger query data if querying the same selected account
      const data = q?.data || (selectedAccountId === acc.id ? ledgerData : undefined);
      const isErr = q?.isError || (selectedAccountId === acc.id && isLedgerError);
      const isLoad = (q?.isLoading ?? true) && (selectedAccountId === acc.id ? isLedgerLoading : true);

      map.set(acc.id, {
        balance: data?.summary ? data.summary.closing_balance_minor : null,
        isLoading: Boolean(isLoad && !data?.summary),
        isError: Boolean(isErr && !data?.summary),
        refetch: () => {
          q?.refetch?.();
          if (selectedAccountId === acc.id) refetchLedger();
        },
      });
    });
    return map;
  }, [displayedAccounts, accountLedgerQueries, selectedAccountId, ledgerData, isLedgerError, isLedgerLoading, refetchLedger]);

  const summary = ledgerData?.summary;
  const entries = ledgerData?.entries || [];

  const moneyReceivedMinor = summary?.period_inflows_minor ?? 0;
  const moneyPaidMinor = summary?.period_outflows_minor ?? 0;
  const netCashChangeMinor = moneyReceivedMinor - moneyPaidMinor;
  const closingBalanceMinor = summary?.closing_balance_minor ?? 0;
  const openingBalanceMinor = summary?.opening_balance_minor ?? 0;

  // Recent 5 entries (reverse chronological)
  const recentEntries = useMemo(() => {
    return [...entries].reverse().slice(0, 5);
  }, [entries]);

  // Analytics: daily / monthly grouping for bar chart
  const barChartData = useMemo(() => {
    const groups: Record<string, { label: string; inflows: number; outflows: number; count: number }> = {};
    for (const item of entries) {
      const v = item.voucher;
      const key = period === 'year' ? v.business_date.slice(0, 7) : v.business_date.slice(5);
      if (!groups[key]) {
        groups[key] = { label: key, inflows: 0, outflows: 0, count: 0 };
      }
      groups[key].count += 1;
      if (v.direction === 'inflow') {
        groups[key].inflows += v.amount_minor;
      } else {
        groups[key].outflows += v.amount_minor;
      }
    }
    const list = Object.values(groups);
    const peak = Math.max(1, ...list.flatMap((g) => [g.inflows, g.outflows]));
    return { list, peak };
  }, [entries, period]);

  // Active bar details for accessible chart popover
  const selectedBarData = useMemo(() => {
    if (!selectedBarLabel) return null;
    return barChartData.list.find((g) => g.label === selectedBarLabel) || null;
  }, [selectedBarLabel, barChartData.list]);

  // Analytics: category breakdown for outflows
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of entries) {
      const v = item.voucher;
      if (v.direction === 'outflow') {
        const catName = v.category_id || 'Other Expense';
        map[catName] = (map[catName] || 0) + v.amount_minor;
      }
    }
    const totalOut = moneyPaidMinor || 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: Math.round((amount / totalOut) * 100),
      }));
  }, [entries, moneyPaidMinor]);

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full" data-testid="dashboard-view">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-subtle)]">
            {settings.business_name || 'BillZen Workspace'} · {timezone}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
            {period === 'today'
              ? t.today_summary
              : period === 'month'
              ? t.this_month_summary
              : period === 'year'
              ? t.this_year_summary
              : t.custom_period_summary}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {periodLabel} · {entries.length} {t.transactions_count}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenReceiptModal && (
            <button
              onClick={onOpenReceiptModal}
              data-testid="dashboard-add-receipt"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand-primary)] hover:bg-[#17301b] dark:bg-[#2e5733] dark:hover:bg-[#3b6d41] text-white text-xs font-bold shadow-sm transition-all duration-120 active:scale-[0.975] focus-ring cursor-pointer min-h-[38px]"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{t.btn_add_receipt}</span>
            </button>
          )}
          {onOpenPaymentModal && (
            <button
              onClick={onOpenPaymentModal}
              data-testid="dashboard-add-payment"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-[#ef4444] dark:hover:bg-[#dc2626] text-white text-xs font-bold shadow-sm transition-all duration-120 active:scale-[0.975] focus-ring cursor-pointer min-h-[38px]"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{t.btn_add_payment}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Bar: Period buttons, date step, account selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm">
        {/* Segmented Period Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-surface-subtle)] p-1 rounded-xl max-w-full">
          <button
            onClick={() => {
              setPeriod('today');
              setReferenceDate(todayStr);
              setSelectedBarLabel(null);
            }}
            data-testid="period-today"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
              period === 'today'
                ? 'bg-[var(--brand-lime)] text-[#142811] dark:bg-[#2e5733] dark:text-[#ceeaa0] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] font-medium'
            }`}
          >
            {t.period_today}
          </button>
          <button
            onClick={() => {
              setPeriod('month');
              setReferenceDate(todayStr);
              setSelectedBarLabel(null);
            }}
            data-testid="period-month"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
              period === 'month'
                ? 'bg-[var(--brand-lime)] text-[#142811] dark:bg-[#2e5733] dark:text-[#ceeaa0] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] font-medium'
            }`}
          >
            {t.period_month}
          </button>
          <button
            onClick={() => {
              setPeriod('year');
              setReferenceDate(todayStr);
              setSelectedBarLabel(null);
            }}
            data-testid="period-year"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
              period === 'year'
                ? 'bg-[var(--brand-lime)] text-[#142811] dark:bg-[#2e5733] dark:text-[#ceeaa0] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] font-medium'
            }`}
          >
            {t.period_year}
          </button>
          <button
            onClick={() => {
              setPeriod('custom');
              setSelectedBarLabel(null);
            }}
            data-testid="period-custom"
            className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
              period === 'custom'
                ? 'bg-[var(--brand-lime)] text-[#142811] dark:bg-[#2e5733] dark:text-[#ceeaa0] font-bold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] font-medium'
            }`}
          >
            {t.period_custom}
          </button>
        </div>

        {/* Previous / Next period step controls (disabled in custom mode) */}
        {period !== 'custom' ? (
          <div className="flex items-center gap-1 text-[var(--text-muted)]">
            <button
              onClick={() => handleStepPeriod(-1)}
              aria-label="Previous period"
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-subtle)] active:scale-[0.975] transition-all focus-ring cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-[var(--text-main)]">{periodLabel}</span>
            <button
              onClick={() => handleStepPeriod(1)}
              aria-label="Next period"
              disabled={referenceDate >= todayStr && period === 'today'}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-subtle)] active:scale-[0.975] disabled:opacity-30 transition-all focus-ring cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              aria-label="Start date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setSelectedBarLabel(null);
              }}
              className="min-w-0 w-full px-2.5 py-1.5 text-xs border border-[var(--border-medium)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-main)] focus-ring font-mono"
            />
            <span className="hidden min-[400px]:inline text-xs text-[var(--text-muted)]">→</span>
            <input
              type="date"
              aria-label="End date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setSelectedBarLabel(null);
              }}
              className="min-w-0 w-full px-2.5 py-1.5 text-xs border border-[var(--border-medium)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-main)] focus-ring font-mono"
            />
          </div>
        )}

        {/* Account Selector & Mode Switch */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedBarLabel(null);
            }}
            aria-label="Filter Account"
            className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium border border-[var(--border-medium)] bg-[var(--bg-surface)] rounded-lg text-[var(--text-main)] focus-ring min-w-[130px] max-w-full"
          >
            <option value="all">{t.all_accounts}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} ({acc.account_type}){acc.is_archived ? ' [Archived]' : ''}
              </option>
            ))}
          </select>

          {/* Simple vs Detailed Analytics Mode */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-xl border border-[var(--border-subtle)]">
            <button
              onClick={() => setMode('simple')}
              data-testid="tab-simple"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
                mode === 'simple'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-bold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{t.simple_view}</span>
            </button>
            <button
              onClick={() => setMode('analytics')}
              data-testid="tab-analytics"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-120 active:scale-[0.975] focus-ring ${
                mode === 'analytics'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-bold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{t.analytics_view}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error alert banner if main ledger query failed */}
      {isLedgerError && !summary && (
        <div
          data-testid="dashboard-ledger-error"
          className="p-3 bg-[#fef2f2] dark:bg-[#2d1414] border border-[#fca5a5] dark:border-[#7f1d1d] rounded-xl text-xs flex items-center justify-between text-[#b91c1c] dark:text-[#ef4444]"
        >
          <span>{t.balance_error_retry}</span>
          <button
            onClick={() => refetchLedger()}
            className="px-2.5 py-1 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-lg font-semibold transition-all cursor-pointer focus-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. 4 Primary Summary Cards */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Money Received */}
        <div
          data-testid="card-received"
          className="p-3.5 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col justify-between transition-all hover:border-[var(--border-medium)]"
        >
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
            <span>{t.money_received}</span>
            <div className="w-7 h-7 rounded-lg bg-[#eef8f0] dark:bg-[#132a18] text-[#15803d] dark:text-[#22c55e] flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-[#15803d] dark:text-[#22c55e] tabular-nums font-mono">
              {isLedgerLoading && !summary ? (
                <span className="text-[var(--text-subtle)] animate-pulse">{currencySymbol} ···</span>
              ) : isLedgerError && !summary ? (
                <span className="text-sm font-semibold text-[#b91c1c] dark:text-[#ef4444]">—</span>
              ) : (
                `${currencySymbol} ${formatMinorUnits(moneyReceivedMinor, currencyExponent)}`
              )}
            </div>
            <p className="text-[11px] text-[var(--text-subtle)] mt-1 font-medium">
              {t.total_receipts_in_period}
            </p>
          </div>
        </div>

        {/* Card 2: Money Paid */}
        <div
          data-testid="card-paid"
          className="p-3.5 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col justify-between transition-all hover:border-[var(--border-medium)]"
        >
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
            <span>{t.money_paid}</span>
            <div className="w-7 h-7 rounded-lg bg-[#fef2f2] dark:bg-[#2d1414] text-[#b91c1c] dark:text-[#ef4444] flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-[#b91c1c] dark:text-[#ef4444] tabular-nums font-mono">
              {isLedgerLoading && !summary ? (
                <span className="text-[var(--text-subtle)] animate-pulse">{currencySymbol} ···</span>
              ) : isLedgerError && !summary ? (
                <span className="text-sm font-semibold text-[#b91c1c] dark:text-[#ef4444]">—</span>
              ) : (
                `${currencySymbol} ${formatMinorUnits(moneyPaidMinor, currencyExponent)}`
              )}
            </div>
            <p className="text-[11px] text-[var(--text-subtle)] mt-1 font-medium">
              {t.total_payments_in_period}
            </p>
          </div>
        </div>

        {/* Card 3: Net Cash Change */}
        <div
          data-testid="card-net"
          className="p-3.5 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col justify-between transition-all hover:border-[var(--border-medium)]"
        >
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold">
            <span>{t.net_change}</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                netCashChangeMinor >= 0
                  ? 'bg-[#eef8f0] dark:bg-[#132a18] text-[#15803d] dark:text-[#22c55e]'
                  : 'bg-[#fef2f2] dark:bg-[#2d1414] text-[#b91c1c] dark:text-[#ef4444]'
              }`}
            >
              {netCashChangeMinor >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight tabular-nums font-mono ${
                netCashChangeMinor >= 0
                  ? 'text-[var(--text-main)]'
                  : 'text-[#b91c1c] dark:text-[#ef4444]'
              }`}
            >
              {isLedgerLoading && !summary ? (
                <span className="text-[var(--text-subtle)] animate-pulse">{currencySymbol} ···</span>
              ) : isLedgerError && !summary ? (
                <span className="text-sm font-semibold text-[#b91c1c] dark:text-[#ef4444]">—</span>
              ) : (
                `${netCashChangeMinor < 0 ? '−' : '+'} ${currencySymbol} ${formatMinorUnits(Math.abs(netCashChangeMinor), currencyExponent)}`
              )}
            </div>
            <p className="text-[11px] text-[var(--text-subtle)] mt-1 font-medium">
              {t.receipts_minus_payments}
            </p>
          </div>
        </div>

        {/* Card 4: Closing Balance (Featured Card matching mockup #ceeaa0) */}
        <div
          data-testid="card-closing"
          className="p-3.5 sm:p-5 bg-[#ceeaa0] dark:bg-[#1e3518] border border-[#b8d98b] dark:border-[#2e5733] text-[#142811] dark:text-[#ceeaa0] rounded-2xl shadow-sm flex flex-col justify-between transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between text-[#142811] dark:text-[#ceeaa0] text-xs font-bold uppercase tracking-wide">
            <span>{t.closing_balance}</span>
            <Wallet className="w-5 h-5 text-[#142811] dark:text-[#ceeaa0]" />
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-[#142811] dark:text-[#f0f3ee] tabular-nums font-mono">
              {isLedgerLoading && !summary ? (
                <span className="text-[#2d4926] dark:text-[#a8cb88] animate-pulse">{currencySymbol} ···</span>
              ) : isLedgerError && !summary ? (
                <span className="text-sm font-semibold text-[#b91c1c] dark:text-[#ef4444]">—</span>
              ) : (
                `${currencySymbol} ${formatMinorUnits(closingBalanceMinor, currencyExponent)}`
              )}
            </div>
            <p className="text-[11px] text-[#2d4926] dark:text-[#a8cb88] mt-1 font-medium">
              {t.at_end_of_period}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Account Balances Strip with Explicit Date/Account Scope and Honest Loading/Error States */}
      <div
        className="flex items-center gap-2.5 text-xs text-[var(--text-muted)] overflow-x-auto py-1.5 w-full max-w-full min-w-0"
        data-testid="account-balances-strip"
      >
        <span className="font-bold text-[var(--text-main)] shrink-0 flex items-center gap-1.5">
          {t.cash_breakdown}
          {selectedAccountId !== 'all' && (
            <span className="text-[10px] font-semibold text-[var(--brand-primary)] dark:text-[var(--brand-lime)] bg-[var(--brand-lime-muted)] dark:bg-[#1e3518] px-1.5 py-0.5 rounded">
              ({t.account_filtered_label})
            </span>
          )}:
        </span>
        {displayedAccounts.length > 0 ? (
          displayedAccounts.map((acc, idx) => {
            const accState = accountStatesMap.get(acc.id);
            const isFiltered = selectedAccountId === acc.id;
            return (
              <React.Fragment key={acc.id}>
                {idx > 0 && <span className="text-[var(--border-medium)]">·</span>}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0 border transition-colors ${
                    isFiltered
                      ? 'bg-[var(--brand-lime-muted)] border-[var(--border-focus)] dark:bg-[#1e3518] text-[var(--text-main)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                  data-testid={`account-balance-item-${acc.id}`}
                >
                  <span className="font-medium">{acc.account_name}:</span>
                  {accState?.isLoading ? (
                    <span className="text-[11px] text-[var(--text-subtle)] animate-pulse font-mono" data-testid="account-balance-loading">
                      {t.balance_loading}
                    </span>
                  ) : accState?.isError ? (
                    <button
                      onClick={() => accState.refetch()}
                      className="text-[11px] text-[#b91c1c] dark:text-[#ef4444] font-semibold hover:underline cursor-pointer"
                      data-testid="account-balance-retry"
                    >
                      {t.balance_error_retry}
                    </button>
                  ) : accState?.balance !== null && accState?.balance !== undefined ? (
                    <strong className="text-[var(--text-main)] font-bold tabular-nums font-mono" data-testid="account-balance-value">
                      {currencySymbol} {formatMinorUnits(accState.balance, currencyExponent)}
                    </strong>
                  ) : (
                    <span className="text-[11px] text-[var(--text-subtle)]">—</span>
                  )}
                  {isFiltered && (
                    <span className="text-[10px] uppercase font-bold text-[var(--brand-primary)] dark:text-[var(--brand-lime)]">
                      ({t.account_filtered_label})
                    </span>
                  )}
                  {acc.is_archived && (
                    <span className="text-[10px] text-[var(--text-subtle)]">
                      [Archived]
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })
        ) : (
          <span className="text-[var(--text-subtle)]">{t.no_active_accounts}</span>
        )}
      </div>

      {/* 5. View Mode: Simple View */}
      {mode === 'simple' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Panel: Recent 5 Transactions */}
          <div className="md:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[var(--text-main)]">
                {t.recent_transactions}
              </h2>
              {(onNavigateToReports || onNavigateToCashbook) && (
                <button
                  onClick={() => {
                    if (onNavigateToReports) {
                      onNavigateToReports();
                    } else if (onNavigateToCashbook) {
                      onNavigateToCashbook();
                    }
                  }}
                  className="text-xs font-bold text-[var(--brand-primary)] dark:text-[var(--brand-lime)] hover:underline active:scale-[0.975] transition-all focus-ring cursor-pointer"
                >
                  {t.view_all}
                </button>
              )}
            </div>

            <div className="divide-y divide-[var(--border-subtle)]" data-testid="recent-transactions-list">
              {recentEntries.length > 0 ? (
                recentEntries.map((entry) => {
                  const v = entry.voucher;
                  const isInflow = v.direction === 'inflow';
                  return (
                    <div
                      key={v.id}
                      className="py-3 px-1.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-subtle)] rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isInflow
                              ? 'bg-[#eef8f0] dark:bg-[#132a18] text-[#15803d] dark:text-[#22c55e]'
                              : 'bg-[#fef2f2] dark:bg-[#2d1414] text-[#b91c1c] dark:text-[#ef4444]'
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-main)] truncate">
                            {v.party_name_snap || (isInflow ? t.cash_receipt_default : t.cash_payment_default)}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate font-mono">
                            {v.voucher_number} · {v.payment_method} · {v.business_date}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold tabular-nums font-mono shrink-0 ${
                          isInflow
                            ? 'text-[#15803d] dark:text-[#22c55e]'
                            : 'text-[#b91c1c] dark:text-[#ef4444]'
                        }`}
                      >
                        {isInflow ? '+' : '−'} {currencySymbol}{' '}
                        {formatMinorUnits(v.amount_minor, currencyExponent)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-[var(--text-subtle)]">
                  {t.no_transactions_period}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Cash Movement Explanation & Shortcuts */}
          <div className="md:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                {t.cash_movement_explainer}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t.cash_flow_subtitle}
              </p>

              {/* Math Equation Lines */}
              <div
                className="mt-4 space-y-2 text-xs divide-y divide-[var(--border-subtle)]"
                data-testid="cash-movement-explanation"
              >
                <div className="flex justify-between items-center py-2 text-[var(--text-muted)]">
                  <span className="font-medium">{t.opening_balance}</span>
                  <span className="font-semibold tabular-nums font-mono text-[var(--text-main)]">
                    {currencySymbol} {formatMinorUnits(openingBalanceMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 text-[#15803d] dark:text-[#22c55e]">
                  <span className="font-medium">＋ {t.money_received}</span>
                  <span className="font-semibold tabular-nums font-mono">
                    {currencySymbol} {formatMinorUnits(moneyReceivedMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 text-[#b91c1c] dark:text-[#ef4444]">
                  <span className="font-medium">− {t.money_paid}</span>
                  <span className="font-semibold tabular-nums font-mono">
                    {currencySymbol} {formatMinorUnits(moneyPaidMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2.5 font-bold text-[var(--text-main)]">
                  <span className="font-bold">＝ {t.closing_balance}</span>
                  <span className="tabular-nums font-mono text-sm font-black">
                    {currencySymbol} {formatMinorUnits(closingBalanceMinor, currencyExponent)}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory Footnote */}
            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
              <p
                data-testid="footnote-cash-flow"
                className="text-[11px] leading-relaxed text-[var(--text-subtle)]"
              >
                {t.cash_flow_notice}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. View Mode: Detailed Analytics View */}
      {mode === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Receipts vs Payments Bar Chart */}
            <div className="md:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-main)]">
                    {t.inflows_outflows}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {t.chart_comparison_subtitle}
                  </p>
                </div>
                {selectedBarData && (
                  <button
                    onClick={() => setSelectedBarLabel(null)}
                    className="text-[11px] text-[var(--brand-primary)] dark:text-[var(--brand-lime)] font-semibold hover:underline focus-ring rounded"
                  >
                    {t.clear_selection}
                  </button>
                )}
              </div>

              {/* Bar Chart Bars with Tap and Keyboard Accessibility */}
              <div
                data-testid="analytics-bars-container"
                role="region"
                aria-label="Cash flow bar chart"
                className="mt-6 h-48 flex items-end justify-around gap-2 pb-6 border-b border-[var(--border-subtle)] relative"
              >
                {barChartData.list.length > 0 ? (
                  barChartData.list.map((group) => {
                    const inHeight = group.inflows > 0 ? Math.max(2, (group.inflows / barChartData.peak) * 100) : 0;
                    const outHeight = group.outflows > 0 ? Math.max(2, (group.outflows / barChartData.peak) * 100) : 0;
                    const isSelected = selectedBarLabel === group.label;
                    const groupAria = `${group.label}: Inflows ${currencySymbol}${formatMinorUnits(group.inflows, currencyExponent)}, Outflows ${currencySymbol}${formatMinorUnits(group.outflows, currencyExponent)}`;

                    return (
                      <div
                        key={group.label}
                        tabIndex={0}
                        role="graphics-symbol"
                        aria-label={groupAria}
                        onClick={() => setSelectedBarLabel(isSelected ? null : group.label)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedBarLabel(isSelected ? null : group.label);
                          }
                        }}
                        className={`flex-1 max-w-[64px] h-full flex items-end justify-center gap-1.5 relative group cursor-pointer rounded-t-lg p-0.5 transition-all duration-120 focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1 ${
                          isSelected ? 'bg-[var(--brand-lime-muted)] dark:bg-[#1e3518]' : 'hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        {/* Inflow Bar */}
                        <div
                          style={{ height: `${inHeight}%` }}
                          title={`${t.inflow_legend}: ${currencySymbol} ${formatMinorUnits(group.inflows, currencyExponent)}`}
                          className="w-1/2 bg-[#15803d] hover:bg-[#16a34a] dark:bg-[#22c55e] dark:hover:bg-[#4ade80] rounded-t-[4px] transition-all"
                        />
                        {/* Outflow Bar */}
                        <div
                          style={{ height: `${outHeight}%` }}
                          title={`${t.outflow_legend}: ${currencySymbol} ${formatMinorUnits(group.outflows, currencyExponent)}`}
                          className="w-1/2 bg-[#b91c1c] hover:bg-[#dc2626] dark:bg-[#ef4444] dark:hover:bg-[#f87171] rounded-t-[4px] transition-all"
                        />
                        <span className="absolute -bottom-5 text-[10px] text-[var(--text-subtle)] font-mono whitespace-nowrap">
                          {group.label}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-subtle)]">
                    {t.no_transactions_period}
                  </div>
                )}
              </div>

              {/* Accessible Selected Bar Details Callout (Touch & Keyboard Friendly) */}
              {selectedBarData && (
                <div className="mt-3 p-3 bg-[var(--brand-lime-muted)] dark:bg-[#1e3518] border border-[var(--border-subtle)] rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[var(--text-main)]">
                    {selectedBarData.label} ({selectedBarData.count} {t.transactions_count}):
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#15803d] dark:text-[#22c55e] font-bold font-mono tabular-nums">
                      + {currencySymbol} {formatMinorUnits(selectedBarData.inflows, currencyExponent)}
                    </span>
                    <span className="text-[#b91c1c] dark:text-[#ef4444] font-bold font-mono tabular-nums">
                      − {currencySymbol} {formatMinorUnits(selectedBarData.outflows, currencyExponent)}
                    </span>
                    <span className="font-bold text-[var(--text-main)] font-mono tabular-nums">
                      {t.chart_net_label}:{' '}
                      {selectedBarData.inflows - selectedBarData.outflows >= 0 ? '+' : '−'}
                      {currencySymbol}{' '}
                      {formatMinorUnits(Math.abs(selectedBarData.inflows - selectedBarData.outflows), currencyExponent)}
                    </span>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-5 text-xs text-[var(--text-muted)] mt-5">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-[3px] bg-[#15803d] dark:bg-[#22c55e]" />
                  {t.inflow_legend}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-[3px] bg-[#b91c1c] dark:bg-[#ef4444]" />
                  {t.outflow_legend}
                </span>
              </div>
            </div>

            {/* Category Breakdown */}
            <div
              data-testid="analytics-category-breakdown"
              className="md:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-bold text-[var(--text-main)]">
                {t.spending_by_category}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {t.category_expenses_subtitle}
              </p>

              <div className="mt-4 space-y-3.5">
                {categoryBreakdown.length > 0 ? (
                  categoryBreakdown.map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[var(--text-main)] truncate max-w-[180px]">
                          {cat.name}
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums font-mono">
                          {currencySymbol} {formatMinorUnits(cat.amount, currencyExponent)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[var(--bg-surface-subtle)] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${cat.percentage}%` }}
                          className="h-full bg-[#b91c1c] dark:bg-[#ef4444] rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-[var(--text-subtle)]">
                    {t.no_expenses_period}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Helper Callout */}
          <div className="p-4 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-muted)] flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] dark:text-[var(--brand-lime)] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {t.analytics_helper_notice}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
