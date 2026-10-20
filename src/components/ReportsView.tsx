import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Printer,
  Download,
  Wallet,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type { BusinessSettings } from '../types';
import type { Language } from '../i18n';
import { translations } from '../i18n';
import {
  getMoneyAccounts,
  getCashbookCategories,
  getCashbookLedger,
} from '../adapters/cashbook';
import { getTodayBusinessDate, formatMinorUnits } from '../domain/financial';
import type { CashbookSummary, ReportPrintData } from '../types/cashbook';
import { exportTransactionsToCsv } from '../utils/csv_export';

interface ReportsViewProps {
  settings: BusinessSettings;
  language: Language;
  onPrintReport?: (reportData: ReportPrintData) => void;
  initialPeriod?: 'today' | 'month' | 'year' | 'custom';
}

export type ReportPeriod = 'today' | 'month' | 'year' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  settings,
  language,
  onPrintReport,
  initialPeriod = 'today',
}) => {
  const t = translations[language] || translations.en;
  const currencyExponent = settings.currency_exponent ?? 2;
  const currencySymbol = settings.currency_symbol ?? '₹';
  const timezone = settings.timezone || 'Asia/Kolkata';

  const todayStr = useMemo(() => getTodayBusinessDate(timezone), [timezone]);

  // Filters State
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');

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
      return { startDate: start, endDate: end, periodLabel: `Year ${year}` };
    }

    // custom
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      periodLabel: `${customStartDate} – ${customEndDate}`,
    };
  }, [period, referenceDate, customStartDate, customEndDate, todayStr, language]);

  // Navigate Previous / Next period
  const handlePrevPeriod = () => {
    if (period === 'today') {
      const [y, m, d] = referenceDate.split('-').map(Number);
      const prev = new Date(y, m - 1, d - 1);
      const yyyy = prev.getFullYear();
      const mm = String(prev.getMonth() + 1).padStart(2, '0');
      const dd = String(prev.getDate()).padStart(2, '0');
      setReferenceDate(`${yyyy}-${mm}-${dd}`);
    } else if (period === 'month') {
      const [y, m] = referenceDate.slice(0, 7).split('-').map(Number);
      const prev = new Date(y, m - 2, 1);
      const yyyy = prev.getFullYear();
      const mm = String(prev.getMonth() + 1).padStart(2, '0');
      setReferenceDate(`${yyyy}-${mm}-01`);
    } else if (period === 'year') {
      const y = parseInt(referenceDate.slice(0, 4), 10);
      setReferenceDate(`${y - 1}-01-01`);
    }
  };

  const handleNextPeriod = () => {
    if (period === 'today') {
      const [y, m, d] = referenceDate.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const yyyy = next.getFullYear();
      const mm = String(next.getMonth() + 1).padStart(2, '0');
      const dd = String(next.getDate()).padStart(2, '0');
      setReferenceDate(`${yyyy}-${mm}-${dd}`);
    } else if (period === 'month') {
      const [y, m] = referenceDate.slice(0, 7).split('-').map(Number);
      const next = new Date(y, m, 1);
      const yyyy = next.getFullYear();
      const mm = String(next.getMonth() + 1).padStart(2, '0');
      setReferenceDate(`${yyyy}-${mm}-01`);
    } else if (period === 'year') {
      const y = parseInt(referenceDate.slice(0, 4), 10);
      setReferenceDate(`${y + 1}-01-01`);
    }
  };

  // Fetch Accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['money_accounts'],
    queryFn: () => getMoneyAccounts(),
  });

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['cashbook_categories'],
    queryFn: () => getCashbookCategories(),
  });

  // Fetch Cashbook Ledger
  const ledgerFilter = useMemo(() => {
    return {
      account_id: selectedAccountId === 'all' ? null : selectedAccountId,
      start_date: startDate,
      end_date: endDate,
      search: searchQuery.trim() ? searchQuery.trim() : null,
      classification: classificationFilter === 'all' ? null : classificationFilter,
      include_archived: false,
    };
  }, [selectedAccountId, startDate, endDate, searchQuery, classificationFilter]);

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['cashbook_ledger', ledgerFilter],
    queryFn: () => getCashbookLedger(ledgerFilter),
  });

  const summary: CashbookSummary = ledgerData?.summary || {
    total_cash_minor: 0,
    active_cash_minor: 0,
    opening_balance_minor: 0,
    period_inflows_minor: 0,
    period_outflows_minor: 0,
    closing_balance_minor: 0,
    net_operating_cash_flow_minor: 0,
    matching_inflows_minor: 0,
    matching_outflows_minor: 0,
    matching_count: 0,
  };

  // Additional client-side filters (direction, category, payment_method)
  const filteredEntries = useMemo(() => {
    if (!ledgerData?.entries) return [];

    return ledgerData.entries.filter((entry) => {
      const v = entry.voucher;
      if (directionFilter !== 'all' && v.direction !== directionFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && v.category_id !== categoryFilter) {
        return false;
      }
      if (paymentMethodFilter !== 'all' && v.payment_method !== paymentMethodFilter) {
        return false;
      }
      return true;
    });
  }, [ledgerData?.entries, directionFilter, categoryFilter, paymentMethodFilter]);

  // Is any detail filter currently active?
  const hasDetailFilter =
    Boolean(searchQuery.trim()) ||
    directionFilter !== 'all' ||
    categoryFilter !== 'all' ||
    classificationFilter !== 'all' ||
    paymentMethodFilter !== 'all';

  // Matching totals
  const matchingStats = useMemo(() => {
    let inflows = 0;
    let outflows = 0;
    for (const entry of filteredEntries) {
      if (entry.voucher.direction === 'inflow') {
        inflows += entry.voucher.amount_minor;
      } else {
        outflows += entry.voucher.amount_minor;
      }
    }
    return {
      count: filteredEntries.length,
      inflows,
      outflows,
    };
  }, [filteredEntries]);

  // Selected account object
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // CSV Export Handler
  const handleExportCsv = () => {
    const csvString = exportTransactionsToCsv({
      settings,
      summary,
      entries: filteredEntries,
      startDate,
      endDate,
      accountName: currentAccount?.account_name,
      filterSummary: hasDetailFilter ? 'Custom Filters Applied' : undefined,
    });

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `BillZen_Report_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Report Handler
  const handlePrint = () => {
    if (!onPrintReport) return;
    onPrintReport({
      summary,
      entries: filteredEntries,
      periodTitle: periodLabel,
      dateRangeText: `${startDate} to ${endDate}`,
      accountName: currentAccount?.account_name,
      filterSummary: hasDetailFilter ? 'Filtered dataset' : undefined,
      businessName: settings.business_name,
      taxIdentifier: settings.tax_identifier,
      phone: settings.phone,
      currencyCode: settings.currency_code,
      currencyExponent: settings.currency_exponent,
      timezone: settings.timezone,
      generatedAt: new Date().toLocaleString(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-lime-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
              {t.report_title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {t.report_subtitle} • {timezone}
          </p>
        </div>

        {/* Action Buttons: Print PDF & Export CSV */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            data-testid="btn-print-report"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-700/80 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            <span>{t.btn_print_pdf}</span>
          </button>

          <button
            onClick={handleExportCsv}
            data-testid="btn-export-csv"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t.btn_export_csv}</span>
          </button>
        </div>
      </div>

      {/* Period Controls & Date Selector Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:flex-wrap items-center justify-between gap-4">
        {/* Period Switcher (Today, Month, Year, Custom) */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto max-w-full">
          <button
            onClick={() => setPeriod('today')}
            data-testid="report-period-today"
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'today'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_today}
          </button>
          <button
            onClick={() => setPeriod('month')}
            data-testid="report-period-month"
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'month'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_month}
          </button>
          <button
            onClick={() => setPeriod('year')}
            data-testid="report-period-year"
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'year'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_year}
          </button>
          <button
            onClick={() => setPeriod('custom')}
            data-testid="report-period-custom"
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              period === 'custom'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.period_custom}
          </button>
        </div>

        {/* Date Navigator / Custom Range */}
        {period !== 'custom' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPeriod}
              data-testid="btn-prev-period"
              aria-label="Previous Period"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 rounded-lg">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-zinc-200" data-testid="report-date-display">
                {periodLabel}
              </span>
            </div>
            <button
              onClick={handleNextPeriod}
              data-testid="btn-next-period"
              aria-label="Next Period"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              data-testid="report-custom-start-date"
              className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 font-mono max-w-[135px] sm:max-w-none"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              data-testid="report-custom-end-date"
              className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 font-mono max-w-[135px] sm:max-w-none"
            />
          </div>
        )}

        {/* Account Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 max-w-full">
          <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            data-testid="report-account-select"
            className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-zinc-200 font-medium focus:ring-1 focus:ring-indigo-500 outline-none min-w-0 max-w-full w-full sm:w-auto sm:max-w-[16rem]"
          >
            <option value="all">{t.all_accounts}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} ({acc.account_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Detail Filters Row */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="report-search-input"
            placeholder={t.search_transactions_hint}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Direction Filter */}
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value as any)}
          data-testid="report-direction-select"
          className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 font-medium outline-none"
        >
          <option value="all">{t.filter_direction_all}</option>
          <option value="inflow">{t.filter_direction_inflow}</option>
          <option value="outflow">{t.filter_direction_outflow}</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          data-testid="report-category-select"
          className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 font-medium outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Classification Filter */}
        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          data-testid="report-classification-select"
          className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 font-medium outline-none"
        >
          <option value="all">All Classifications</option>
          <option value="operating_income">Operating Income</option>
          <option value="operating_expense">Operating Expense</option>
          <option value="capital">Capital</option>
          <option value="loan">Loan</option>
          <option value="advance">Advance</option>
          <option value="refund">Refund</option>
        </select>

        {/* Payment Method Filter */}
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          data-testid="report-method-select"
          className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 font-medium outline-none"
        >
          <option value="all">{t.filter_payment_method_all}</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI / QR</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>

        {/* Reset Filters button if any active */}
        {hasDetailFilter && (
          <button
            onClick={() => {
              setSearchQuery('');
              setDirectionFilter('all');
              setCategoryFilter('all');
              setClassificationFilter('all');
              setPaymentMethodFilter('all');
            }}
            data-testid="btn-reset-filters"
            className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Balance Summary Bar */}
      <div className="bg-slate-900 text-white dark:bg-zinc-900 border border-slate-800 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-800 dark:divide-zinc-800">
          <div className="pt-2 md:pt-0">
            <span className="text-[11px] text-slate-400 font-medium uppercase">{t.opening_balance}</span>
            <div className="text-base sm:text-lg font-bold font-mono [overflow-wrap:anywhere] mt-0.5" data-testid="report-opening-balance">
              {currencySymbol}{formatMinorUnits(summary.opening_balance_minor, currencyExponent)}
            </div>
          </div>
          <div className="pt-2 md:pt-0 md:pl-4">
            <span className="text-[11px] text-emerald-400 font-medium uppercase">{t.money_received}</span>
            <div className="text-base sm:text-lg font-bold font-mono [overflow-wrap:anywhere] text-emerald-400 mt-0.5" data-testid="report-period-inflows">
              +{currencySymbol}{formatMinorUnits(summary.period_inflows_minor, currencyExponent)}
            </div>
          </div>
          <div className="pt-2 md:pt-0 md:pl-4">
            <span className="text-[11px] text-rose-400 font-medium uppercase">{t.money_paid}</span>
            <div className="text-base sm:text-lg font-bold font-mono [overflow-wrap:anywhere] text-rose-400 mt-0.5" data-testid="report-period-outflows">
              −{currencySymbol}{formatMinorUnits(summary.period_outflows_minor, currencyExponent)}
            </div>
          </div>
          <div className="pt-2 md:pt-0 md:pl-4">
            <span className="text-[11px] text-lime-400 font-medium uppercase">{t.closing_balance}</span>
            <div className="text-base sm:text-lg font-bold font-mono [overflow-wrap:anywhere] text-lime-400 mt-0.5" data-testid="report-closing-balance">
              {currencySymbol}{formatMinorUnits(summary.closing_balance_minor, currencyExponent)}
            </div>
          </div>
        </div>

        {/* Filter Matching Banner (Separates full period totals from filter results) */}
        {hasDetailFilter && (
          <div
            data-testid="report-matching-banner"
            className="mt-3 pt-3 border-t border-slate-800 dark:border-zinc-800 flex flex-wrap items-center justify-between text-xs text-slate-300"
          >
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-400 dark:text-lime-400" />
              <span>
                Matching: <strong className="text-white">{matchingStats.count}</strong> transactions
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400">
                Receipts: +{currencySymbol}{formatMinorUnits(matchingStats.inflows, currencyExponent)}
              </span>
              <span className="text-rose-400">
                Payments: −{currencySymbol}{formatMinorUnits(matchingStats.outflows, currencyExponent)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">{t.th_date}</th>
                <th className="py-3 px-3.5">Voucher #</th>
                <th className="py-3 px-3.5">{t.th_voucher_name}</th>
                <th className="py-3 px-3.5">{t.th_category}</th>
                <th className="py-3 px-3.5">{t.th_account}</th>
                <th className="py-3 px-3.5">Classification</th>
                <th className="py-3 px-3.5 text-right">{t.th_inflow}</th>
                <th className="py-3 px-3.5 text-right">{t.th_outflow}</th>
                <th className="py-3 px-3.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 dark:text-zinc-400">
                    Loading records...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-zinc-400">
                    <p className="font-medium">{t.empty_state_no_items}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {hasDetailFilter ? 'Try clearing your filters or changing the period.' : 'No cash movements recorded in this period.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => {
                  const v = entry.voucher;
                  const isInflow = v.direction === 'inflow';
                  return (
                    <tr
                      key={v.id || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                      data-testid={`report-row-${idx}`}
                    >
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                        {v.business_date}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                        {v.voucher_number}
                        {v.is_reversed && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                            VOID
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-900 dark:text-zinc-100">
                          {v.party_name_snap || '—'}
                        </div>
                        {(v.notes || v.reference_note) && (
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[180px]">
                            {v.notes || v.reference_note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-zinc-300">
                        {v.category_id || '—'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                        {v.account_name_snap || '—'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {v.classification.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-right whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400">
                        {isInflow ? `+${currencySymbol}${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-right whitespace-nowrap font-medium text-rose-600 dark:text-rose-400">
                        {!isInflow ? `−${currencySymbol}${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-right whitespace-nowrap font-semibold text-slate-900 dark:text-zinc-100">
                        {currencySymbol}{formatMinorUnits(entry.running_balance_minor, currencyExponent)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
