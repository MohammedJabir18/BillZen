import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
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
}) => {
  const t = translations[language] || translations.en;
  const currencyExponent = settings.currency_exponent ?? 2;
  const currencySymbol = settings.currency_symbol ?? '₹';
  const timezone = settings.timezone || 'Asia/Kolkata';

  const todayStr = useMemo(() => getTodayBusinessDate(timezone), [timezone]);

  // Period state
  const [period, setPeriod] = useState<PeriodType>('today');
  const [mode, setMode] = useState<ViewMode>('simple');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

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
      // If reference date is in current month, end date is todayStr, otherwise last day of month
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

  const { data: ledgerData } = useQuery({
    queryKey: ['cashbook_ledger', startDate, endDate, selectedAccountId],
    queryFn: () =>
      getCashbookLedger({
        start_date: startDate,
        end_date: endDate,
        account_id: selectedAccountId === 'all' ? undefined : selectedAccountId,
        include_archived: false,
      }),
  });

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
    const groups: Record<string, { label: string; inflows: number; outflows: number }> = {};
    for (const item of entries) {
      const v = item.voucher;
      const key = period === 'year' ? v.business_date.slice(0, 7) : v.business_date.slice(5);
      if (!groups[key]) {
        groups[key] = { label: key, inflows: 0, outflows: 0 };
      }
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
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {settings.business_name || 'BillZen Workspace'} · {timezone}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            {period === 'today'
              ? t.today_summary
              : period === 'month'
              ? t.this_month_summary
              : period === 'year'
              ? t.this_year_summary
              : t.custom_period_summary}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
            {periodLabel} · {entries.length}{' '}
            {language === 'ml' ? 'ഇടപാടുകൾ' : language === 'ar' ? 'معاملة' : 'transactions'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenReceiptModal && (
            <button
              onClick={onOpenReceiptModal}
              data-testid="dashboard-add-receipt"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{t.btn_add_receipt}</span>
            </button>
          )}
          {onOpenPaymentModal && (
            <button
              onClick={onOpenPaymentModal}
              data-testid="dashboard-add-payment"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{t.btn_add_payment}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Bar: Period buttons, date step, account selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        {/* Segmented Period Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl max-w-full">
          <button
            onClick={() => {
              setPeriod('today');
              setReferenceDate(todayStr);
            }}
            data-testid="period-today"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'today'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_today}
          </button>
          <button
            onClick={() => {
              setPeriod('month');
              setReferenceDate(todayStr);
            }}
            data-testid="period-month"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'month'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_month}
          </button>
          <button
            onClick={() => {
              setPeriod('year');
              setReferenceDate(todayStr);
            }}
            data-testid="period-year"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'year'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_year}
          </button>
          <button
            onClick={() => setPeriod('custom')}
            data-testid="period-custom"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'custom'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_custom}
          </button>
        </div>

        {/* Previous / Next period step controls (disabled in custom mode) */}
        {period !== 'custom' ? (
          <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
            <button
              onClick={() => handleStepPeriod(-1)}
              aria-label="Previous period"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2">{periodLabel}</span>
            <button
              onClick={() => handleStepPeriod(1)}
              aria-label="Next period"
              disabled={referenceDate >= todayStr && period === 'today'}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
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
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="min-w-0 w-full px-2.5 py-1 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg text-slate-800 dark:text-zinc-200"
            />
            <span className="hidden min-[400px]:inline text-xs text-slate-400">→</span>
            <input
              type="date"
              aria-label="End date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="min-w-0 w-full px-2.5 py-1 text-xs border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg text-slate-800 dark:text-zinc-200"
            />
          </div>
        )}

        {/* Account Selector & Mode Switch */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            aria-label="Filter Account"
            className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg text-slate-800 dark:text-zinc-200 focus:outline-none min-w-[120px] max-w-full"
          >
            <option value="all">{t.all_accounts}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} ({acc.account_type})
              </option>
            ))}
          </select>

          {/* Simple vs Detailed Analytics Mode */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg">
            <button
              onClick={() => setMode('simple')}
              data-testid="tab-simple"
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                mode === 'simple'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              {t.simple_view}
            </button>
            <button
              onClick={() => setMode('analytics')}
              data-testid="tab-analytics"
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                mode === 'analytics'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              {t.analytics_view}
            </button>
          </div>
        </div>
      </div>

      {/* 3. 4 Primary Summary Cards */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Money Received */}
        <div
          data-testid="card-received"
          className="p-3.5 sm:p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>{t.money_received}</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
              {currencySymbol} {formatMinorUnits(moneyReceivedMinor, currencyExponent)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {language === 'ml' ? 'വരവായി രേഖപ്പെടുത്തിയ തുക' : language === 'ar' ? 'إجمالي المقبوضات' : 'Total receipts in period'}
            </p>
          </div>
        </div>

        {/* Card 2: Money Paid */}
        <div
          data-testid="card-paid"
          className="p-3.5 sm:p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>{t.money_paid}</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-rose-700 dark:text-rose-400 tabular-nums">
              {currencySymbol} {formatMinorUnits(moneyPaidMinor, currencyExponent)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {language === 'ml' ? 'ചെലവായി രേഖപ്പെടുത്തിയ തുക' : language === 'ar' ? 'إجمالي المدفوعات' : 'Total payments in period'}
            </p>
          </div>
        </div>

        {/* Card 3: Net Cash Change */}
        <div
          data-testid="card-net"
          className="p-3.5 sm:p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>{t.net_change}</span>
            {netCashChangeMinor >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div className="mt-3">
            <div
              className={`text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight tabular-nums ${
                netCashChangeMinor >= 0
                  ? 'text-slate-900 dark:text-zinc-100'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {netCashChangeMinor < 0 ? '−' : '+'} {currencySymbol}{' '}
              {formatMinorUnits(Math.abs(netCashChangeMinor), currencyExponent)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {language === 'ml' ? 'വരവ് − ചെലവ്' : language === 'ar' ? 'المقبوضات - المدفوعات' : 'Receipts − Payments'}
            </p>
          </div>
        </div>

        {/* Card 4: Closing Balance (Featured Card matching mockup #ceeaa0) */}
        <div
          data-testid="card-closing"
          className="p-3.5 sm:p-5 bg-[#ceeaa0] dark:bg-lime-950/60 text-[#223d18] dark:text-lime-200 border border-[#b8d98b] dark:border-lime-800/80 rounded-2xl shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#36532b] dark:text-lime-300 text-xs font-semibold">
            <span>{t.closing_balance}</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-xl md:text-2xl font-black [overflow-wrap:anywhere] tracking-tight text-[#1b3213] dark:text-lime-100 tabular-nums">
              {currencySymbol} {formatMinorUnits(closingBalanceMinor, currencyExponent)}
            </div>
            <p className="text-[11px] text-[#36532b] dark:text-lime-400 mt-1 font-medium">
              {language === 'ml' ? 'ഈ കാലയളവിന്റെ അവസാനം' : language === 'ar' ? 'الرصيد في نهاية الفترة' : 'At end of selected period'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Account Balances Row */}
      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 overflow-x-auto py-1 w-full max-w-full min-w-0">
        <span className="font-semibold text-slate-700 dark:text-zinc-300 shrink-0">
          {t.cash_breakdown}:
        </span>
        {accounts.map((acc, idx) => (
          <React.Fragment key={acc.id}>
            {idx > 0 && <span>·</span>}
            <span className="shrink-0">
              {acc.account_name}:{' '}
              <strong className="text-slate-800 dark:text-zinc-200 font-bold tabular-nums">
                {currencySymbol} {formatMinorUnits(acc.opening_balance_minor, currencyExponent)}
              </strong>
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* 5. View Mode: Simple View */}
      {mode === 'simple' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Panel: Recent 5 Transactions */}
          <div className="md:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
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
                  className="text-xs font-semibold text-emerald-700 dark:text-lime-400 hover:underline"
                >
                  {t.view_all}
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800" data-testid="recent-transactions-list">
              {recentEntries.length > 0 ? (
                recentEntries.map((entry) => {
                  const v = entry.voucher;
                  const isInflow = v.direction === 'inflow';
                  return (
                    <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isInflow
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {v.party_name_snap || (isInflow ? 'Cash Receipt' : 'Cash Payment')}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {v.voucher_number} · {v.payment_method} · {v.business_date}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold tabular-nums shrink-0 ${
                          isInflow
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {isInflow ? '+' : '−'} {currencySymbol}{' '}
                        {formatMinorUnits(v.amount_minor, currencyExponent)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
                  {t.no_transactions_period}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Cash Movement Explanation & Shortcuts */}
          <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {t.cash_movement_explainer}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {language === 'ml'
                  ? 'ഈ കാലയളവിലെ മാറ്റം എളുപ്പത്തിൽ'
                  : language === 'ar'
                  ? 'تفاصيل حركة النقد لهذه الفترة'
                  : 'Breakdown of cash flow in selected period'}
              </p>

              {/* Math Equation Lines */}
              <div
                className="mt-4 space-y-2 text-xs divide-y divide-slate-100 dark:divide-zinc-800"
                data-testid="cash-movement-explanation"
              >
                <div className="flex justify-between items-center py-1.5 text-slate-600 dark:text-zinc-400">
                  <span>{t.opening_balance}</span>
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-zinc-200">
                    {currencySymbol} {formatMinorUnits(openingBalanceMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 text-emerald-700 dark:text-emerald-400">
                  <span>＋ {t.money_received}</span>
                  <span className="font-semibold tabular-nums">
                    {currencySymbol} {formatMinorUnits(moneyReceivedMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 text-rose-700 dark:text-rose-400">
                  <span>− {t.money_paid}</span>
                  <span className="font-semibold tabular-nums">
                    {currencySymbol} {formatMinorUnits(moneyPaidMinor, currencyExponent)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 font-bold text-slate-900 dark:text-zinc-100">
                  <span>＝ {t.closing_balance}</span>
                  <span className="tabular-nums text-sm font-black">
                    {currencySymbol} {formatMinorUnits(closingBalanceMinor, currencyExponent)}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory Footnote */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <p
                data-testid="footnote-cash-flow"
                className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400"
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
            <div className="md:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    {t.inflows_outflows}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {language === 'ml'
                      ? 'തിരഞ്ഞെടുത്ത കാലയളവിലെ cash flow'
                      : language === 'ar'
                      ? 'التدفقات النقدية الداخلة والخارجة'
                      : 'Comparison of inflows and outflows'}
                  </p>
                </div>
              </div>

              {/* Bar Chart Bars */}
              <div
                data-testid="analytics-bars-container"
                className="mt-6 h-48 flex items-end justify-around gap-2 pb-6 border-b border-slate-200 dark:border-zinc-800 relative"
              >
                {barChartData.list.length > 0 ? (
                  barChartData.list.map((group) => {
                    const inHeight = Math.max(2, (group.inflows / barChartData.peak) * 100);
                    const outHeight = Math.max(2, (group.outflows / barChartData.peak) * 100);
                    return (
                      <div
                        key={group.label}
                        className="flex-1 max-w-[60px] h-full flex items-end justify-center gap-1 relative group"
                      >
                        <div
                          style={{ height: `${inHeight}%` }}
                          title={`${t.inflow_legend}: ${currencySymbol} ${formatMinorUnits(group.inflows, currencyExponent)}`}
                          className="w-1/2 bg-emerald-600 hover:bg-emerald-500 rounded-t-md transition-all cursor-pointer"
                        />
                        <div
                          style={{ height: `${outHeight}%` }}
                          title={`${t.outflow_legend}: ${currencySymbol} ${formatMinorUnits(group.outflows, currencyExponent)}`}
                          className="w-1/2 bg-rose-600 hover:bg-rose-500 rounded-t-md transition-all cursor-pointer"
                        />
                        <span className="absolute -bottom-5 text-[10px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {group.label}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    {t.no_transactions_period}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400 mt-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-600" />
                  {t.inflow_legend}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-600" />
                  {t.outflow_legend}
                </span>
              </div>
            </div>

            {/* Category Breakdown */}
            <div
              data-testid="analytics-category-breakdown"
              className="md:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {t.spending_by_category}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {language === 'ml'
                  ? 'Category അനുസരിച്ചുള്ള തുക'
                  : language === 'ar'
                  ? 'المصروفات حسب البند'
                  : 'Outflows distributed by category'}
              </p>

              <div className="mt-4 space-y-3.5">
                {categoryBreakdown.length > 0 ? (
                  categoryBreakdown.map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {cat.name}
                        </span>
                        <span className="text-slate-600 dark:text-zinc-400 tabular-nums">
                          {currencySymbol} {formatMinorUnits(cat.amount, currencyExponent)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${cat.percentage}%` }}
                          className="h-full bg-rose-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {language === 'ml' ? 'ചെലവുകളില്ല' : language === 'ar' ? 'لا توجد مصروفات' : 'No expenses in this period'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Helper Callout */}
          <div className="p-3.5 bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-600 dark:text-zinc-400">
            {t.analytics_helper_notice}
          </div>
        </div>
      )}
    </div>
  );
};
