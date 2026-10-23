import { AnimatedSegmentedControl } from './AnimatedSegmentedControl';
import { transferText } from '../i18n/transfers';
import { useEntryMotion } from '../hooks/useEntryMotion';
import React, { useState, useMemo, useRef } from 'react';
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
import { customerCashText } from '../i18n/customer_cashbook';
import { reportText } from '../i18n/reports';
import {
  getMoneyAccounts,
  getCashbookCategories,
  getCashbookParties,
  getCashbookLedger,
} from '../adapters/cashbook';
import { getTodayBusinessDate, formatMinorUnits } from '../domain/financial';
import type { CashbookSummary, ReportPrintData } from '../types/cashbook';
import { exportTransactionsToCsv } from '../utils/csv_export';

interface ReportsViewProps {
  settings: BusinessSettings;
  language: Language;
  onPrintReport?: (reportData: ReportPrintData) => void;
  initialPartyId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialAccountId?: string;
  initialPeriod?: 'today' | 'month' | 'year' | 'custom';
}

export type ReportPeriod = 'today' | 'month' | 'year' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  settings,
  language,
  onPrintReport,
  initialPeriod = 'today',
  initialPartyId = '',
  initialStartDate,
  initialEndDate,
  initialAccountId,
}) => {
  const t = translations[language] || translations.en;
  const c = (text: keyof typeof reportText) => language === 'en' ? text : reportText[text][language];
  const classificationLabel = (value: string) => ({ operating_income: c('Operating Income'), operating_expense: c('Operating Expense'), capital: c('Capital'), loan: c('Loan'), advance: c('Advance'), refund: c('Refund'), transfer: c('Transfer'), opening_balance: c('Opening Balance') } as Record<string, string>)[value] ?? value;
  const currencyExponent = settings.currency_exponent ?? 2;
  const currencySymbol = settings.currency_symbol ?? '₹';
  const timezone = settings.timezone || 'Asia/Kolkata';

  const todayStr = useMemo(() => getTodayBusinessDate(timezone), [timezone]);

  // Filters State
  const [period, setPeriod] = useState<ReportPeriod>(initialStartDate || initialEndDate ? 'custom' : initialPeriod);
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>(initialStartDate || todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(initialEndDate || todayStr);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || 'all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [partyFilter, setPartyFilter] = useState(initialPartyId);
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
          language === 'ml' ? 'ml-IN' : language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-IN',
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
          language === 'ml' ? 'ml-IN' : language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-IN',
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
  const { data: accounts = [], isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useQuery({
    queryKey: ['money_accounts'],
    queryFn: () => getMoneyAccounts(),
  });

  const { data: parties = [], isLoading: partiesLoading, error: partiesError, refetch: refetchParties } = useQuery({ queryKey: ['cashbook_parties'], queryFn: getCashbookParties });

  // Fetch Categories
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useQuery({
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
      party_id: partyFilter || null,
      include_archived: Boolean(partyFilter),
    };
  }, [selectedAccountId, startDate, endDate, searchQuery, classificationFilter, partyFilter]);

  const validRange = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate;
  const { data: ledgerData, isLoading, isFetching, error: ledgerError, refetch: refetchLedger } = useQuery({
    queryKey: ['cashbook_ledger', ledgerFilter],
    queryFn: () => getCashbookLedger(ledgerFilter),
    enabled: validRange,
  });

  const screenRef = useRef<HTMLDivElement>(null);
  useEntryMotion(screenRef, '[data-screen-entry]', [], 'cards', !isLoading);

  const queryError = Boolean(ledgerError || accountsError || categoriesError || partiesError);
  const unavailable = !validRange || !ledgerData || queryError;
  const canExport = !unavailable && !isFetching && !accountsLoading && !categoriesLoading && !partiesLoading;
  const summaryAmount = (amount: number) => unavailable ? '—' : formatMinorUnits(amount, currencyExponent);
  const categoryNames = useMemo(() => Object.fromEntries(categories.map(category => [category.id, category.name])), [categories]);
  const categoryName = (id: string | null) => id ? categoryNames[id] ?? (categoriesLoading ? c('Loading records...') : c('Category unavailable')) : '—';

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
    Boolean(partyFilter) ||
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
      if (entry.voucher.classification === 'transfer') continue;
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

  const selectedParty = parties.find(party => party.id === partyFilter);
  const partyContext = selectedParty ? `${customerCashText(language, 'party')}: ${selectedParty.name}` : undefined;

  // CSV Export Handler
  const handleExportCsv = () => {
    if (!canExport) return;
    const csvString = exportTransactionsToCsv({
      settings,
      summary,
      entries: filteredEntries,
      categoryNames,
      startDate,
      endDate,
      accountName: currentAccount?.account_name,
      filterSummary: partyContext || (hasDetailFilter ? c("Custom Filters Applied") : undefined),
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
    if (!onPrintReport || !canExport) return;
    onPrintReport({
      summary,
      entries: filteredEntries,
      categoryNames,
      periodTitle: periodLabel,
      dateRangeText: `${startDate} to ${endDate}`,
      accountName: currentAccount?.account_name,
      filterSummary: partyContext || (hasDetailFilter ? c("Filtered dataset") : undefined),
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
    <div ref={screenRef} className="reports-screen min-w-0 space-y-6 text-text-main">
      {(!validRange || queryError) && <div role="alert" data-testid="report-error" className="p-4 bg-brand-coral-subtle text-brand-coral border border-border-medium rounded-xl text-sm flex flex-wrap items-center justify-between gap-3">
        <span>{!validRange ? c('Choose a valid date range.') : c('Could not load the report. Please retry.')}</span>
        {validRange && <button className="focus-ring min-h-11 px-3 rounded-lg border border-border-medium" onClick={() => { refetchAccounts(); refetchCategories(); refetchParties(); refetchLedger(); }}>{c('Retry')}</button>}
      </div>}
      {/* Top Header & Actions */}
      <div data-screen-entry className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-emerald" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
              {t.report_title}
            </h1>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {t.report_subtitle}
          </p>
        </div>

        {/* Action Buttons: Print PDF & Export CSV */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex gap-2.5">
          <button
            onClick={handlePrint}
            data-testid="btn-print-report" disabled={!canExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-surface text-text-main border border-border-medium shadow-sm hover:bg-surface-subtle transition-colors"
          >
            <Printer className="w-4 h-4 text-text-muted" />
            <span>{t.btn_print_pdf}</span>
          </button>

          <button
            onClick={handleExportCsv}
            data-testid="btn-export-csv" disabled={!canExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t.btn_export_csv}</span>
          </button>
        </div>
      </div>

      {/* Period Controls & Date Selector Bar */}
      <div data-screen-entry className="bg-surface border border-border-subtle rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:flex-wrap items-center justify-between gap-4">
        {/* Period Switcher (Today, Month, Year, Custom) */}
        <AnimatedSegmentedControl value={period} onChange={setPeriod} language={language} label={t.period_today+' / '+t.period_month+' / '+t.period_year} testId="report-period-control"
          className="w-full sm:w-auto" options={[
            {value:'today',label:t.period_today,testId:'report-period-today'},
            {value:'month',label:t.period_month,testId:'report-period-month'},
            {value:'year',label:t.period_year,testId:'report-period-year'},
            {value:'custom',label:t.period_custom,testId:'report-period-custom'},
          ]}/>

        {/* Date Navigator / Custom Range */}
        {period !== 'custom' ? (
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] w-full sm:w-auto items-center gap-2">
            <button
              onClick={handlePrevPeriod}
              data-testid="btn-prev-period"
              aria-label={c("Previous Period")}
              className="p-1.5 rounded-lg border border-border-medium bg-surface-subtle text-text-main hover:bg-surface-subtle transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex items-center gap-2 px-3 py-1 bg-surface-subtle border border-border-medium rounded-lg">
              <Calendar className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-main" data-testid="report-date-display">
                {periodLabel}
              </span>
            </div>
            <button
              onClick={handleNextPeriod}
              data-testid="btn-next-period"
              aria-label={c("Next Period")}
              className="p-1.5 rounded-lg border border-border-medium bg-surface-subtle text-text-main hover:bg-surface-subtle transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              data-testid="report-custom-start-date" aria-label={c("Start Date")}
              className="text-xs bg-surface-subtle border border-border-medium rounded-lg px-2.5 py-1.5 text-text-main tabular-nums w-full min-w-0 sm:w-auto"
            />
            <span className="text-xs text-text-muted">{c("to")}</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              data-testid="report-custom-end-date" aria-label={c("End Date")}
              className="text-xs bg-surface-subtle border border-border-medium rounded-lg px-2.5 py-1.5 text-text-main tabular-nums w-full min-w-0 sm:w-auto"
            />
          </div>
        )}

        {/* Account Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 max-w-full">
          <Wallet className="w-4 h-4 text-text-muted shrink-0" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            data-testid="report-account-select" aria-label={c("Account")}
            className="text-xs bg-surface-subtle border border-border-medium rounded-xl px-3 py-1.5 text-text-main font-medium focus:ring-1 focus:ring-border-focus outline-none min-w-0 max-w-full w-full sm:w-auto sm:max-w-[16rem]"
          >
            <option value="all">{t.all_accounts}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section data-screen-entry data-testid="report-filters" className="reports-filters bg-surface border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-main">{c('Transaction details')}</h2>
                  {/* Reset Filters button if any active */}
        {hasDetailFilter && (
          <button
            onClick={() => {
              setPartyFilter('');
              setSearchQuery('');
              setDirectionFilter('all');
              setCategoryFilter('all');
              setClassificationFilter('all');
              setPaymentMethodFilter('all');
            }}
            data-testid="btn-reset-filters"
            className="flex items-center gap-1 text-xs text-brand-coral hover:underline px-2 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{c("Reset")}</span>
          </button>
        )}

        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(12rem,.6fr)] gap-3 items-start">
                    {/* Search Input */}
        <div className="relative min-w-0 w-full">
          <label className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4" htmlFor="report-transaction-search">{c("Search")}</label>
          <Search className="w-4 h-4 text-text-muted absolute start-3 bottom-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="report-transaction-search" data-testid="report-search-input" aria-label={c("Search")}
            placeholder={t.search_transactions_hint}
            className="w-full min-h-11 ps-9 pe-3 py-1.5 text-xs bg-surface-subtle border border-border-medium rounded-xl text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-border-focus outline-none"
          />
        </div>

<label className="block min-w-0"><span className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4">{customerCashText(language,'party')}</span>        <select value={partyFilter} onChange={e => setPartyFilter(e.target.value)} data-testid="report-party-select" aria-label={customerCashText(language, 'party')} className="min-h-[44px] max-w-full text-xs bg-surface-subtle border border-border-medium rounded-xl px-2.5 py-1.5 text-text-main font-medium outline-none focus:ring-2 focus:ring-border-focus">
          <option value="">{customerCashText(language, 'allParties')}</option>
          {parties.map(party => <option key={party.id} value={party.id}>{party.name}{party.phone || party.email ? ` · ${party.phone || party.email}` : ''}{party.is_archived ? ` (${customerCashText(language, 'archived')})` : ''}</option>)}
        </select>
        </label>
        {partiesError && <button onClick={() => refetchParties()}>{customerCashText(language, 'retry')}</button>}
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-3 pt-4 border-t border-border-subtle">
                    {/* Direction Filter */}
        <label className="block min-w-0"><span className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4">{c("Direction:")}</span><select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value as any)}
          data-testid="report-direction-select" aria-label={c("Direction:")}
          className="text-xs bg-surface-subtle border border-border-medium rounded-xl px-2.5 py-1.5 text-text-main font-medium outline-none"
        >
          <option value="all">{t.filter_direction_all}</option>
          <option value="inflow">{t.filter_direction_inflow}</option>
          <option value="outflow">{t.filter_direction_outflow}</option>
        </select></label>

        {/* Category Filter */}
        <label className="block min-w-0"><span className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4">{c("All Categories")}</span><select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          data-testid="report-category-select" aria-label={c("All Categories")}
          className="text-xs bg-surface-subtle border border-border-medium rounded-xl px-2.5 py-1.5 text-text-main font-medium outline-none"
        >
          <option value="all">{c("All Categories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select></label>

        {/* Classification Filter */}
        <label className="block min-w-0"><span className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4">{c("Classification")}</span><select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          data-testid="report-classification-select" aria-label={c("Classification")}
          className="text-xs bg-surface-subtle border border-border-medium rounded-xl px-2.5 py-1.5 text-text-main font-medium outline-none"
        >
          <option value="all">{c("All Classifications")}</option>
          <option value="operating_income">{c("Operating Income")}</option>
          <option value="operating_expense">{c("Operating Expense")}</option>
          <option value="capital">{c("Capital")}</option>
          <option value="loan">{c("Loan")}</option>
          <option value="advance">{c("Advance")}</option>
          <option value="refund">{c("Refund")}</option>
          <option value="transfer">{c("Transfer")}</option>
        </select></label>

        {/* Payment Method Filter */}
        <label className="block min-w-0"><span className="block text-[11px] font-semibold text-text-muted mb-1.5 leading-4">{c("Payment Method")}</span><select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          data-testid="report-method-select" aria-label={c("Payment Method")}
          className="text-xs bg-surface-subtle border border-border-medium rounded-xl px-2.5 py-1.5 text-text-main font-medium outline-none"
        >
          <option value="all">{t.filter_payment_method_all}</option>
          <option value="cash">{c("Cash")}</option>
          <option value="upi">{c("UPI / QR")}</option>
          <option value="card">{c("Card")}</option>
          <option value="bank_transfer">{c("Bank Transfer")}</option>
          <option value="cheque">{c("Cheque")}</option>
        </select></label>


          </div>
        </div>
      </section>

      {/* Balance Summary Bar */}
      <div data-screen-entry className="bg-surface text-text-main border border-border-subtle rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-4 divide-y xl:divide-y-0 xl:divide-x divide-border-subtle">
          <div className="pt-2 xl:pt-0">
            <span className="text-xs text-text-muted font-medium uppercase">{t.opening_balance}</span>
            <div className="text-base sm:text-lg font-bold tabular-nums [overflow-wrap:anywhere] mt-0.5" data-testid="report-opening-balance" dir="ltr">
              {currencySymbol}{summaryAmount(summary.opening_balance_minor)}
            </div>
          </div>
          <div className="pt-2 xl:pt-0 md:ps-4">
            <span className="text-xs text-brand-emerald font-medium uppercase">{t.money_received}</span>
            <div className="text-base sm:text-lg font-bold tabular-nums [overflow-wrap:anywhere] text-brand-emerald mt-0.5" data-testid="report-period-inflows" dir="ltr">
              +{currencySymbol}{summaryAmount(summary.period_inflows_minor)}
            </div>
          </div>
          <div className="pt-2 xl:pt-0 md:ps-4">
            <span className="text-xs text-brand-coral font-medium uppercase">{t.money_paid}</span>
            <div className="text-base sm:text-lg font-bold tabular-nums [overflow-wrap:anywhere] text-brand-coral mt-0.5" data-testid="report-period-outflows" dir="ltr">
              −{currencySymbol}{summaryAmount(summary.period_outflows_minor)}
            </div>
          </div>
          <div className="pt-2 xl:pt-0 md:ps-4 bg-brand-lime rounded-lg p-3">
            <span className="text-xs text-text-main font-medium uppercase">{t.closing_balance}</span>
            <div className="text-base sm:text-lg font-bold tabular-nums [overflow-wrap:anywhere] text-text-main mt-0.5" data-testid="report-closing-balance" dir="ltr">
              {currencySymbol}{summaryAmount(summary.closing_balance_minor)}
            </div>
          </div>
        </div>

        {/* Filter Matching Banner (Separates full period totals from filter results) */}
        {hasDetailFilter && !unavailable && (
          <div
            data-testid="report-matching-banner"
            className="mt-3 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between text-xs text-text-muted"
          >
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-brand-emerald" />
              <span>
                {c("Matching:")} <strong className="text-text-main">{matchingStats.count}</strong>  {c("transactions")}
              </span>
            </div>
            <div className="flex flex-wrap min-w-0 gap-3 break-words">
              <span className="text-brand-emerald">
                {c("Receipts: +")}{currencySymbol}{formatMinorUnits(matchingStats.inflows, currencyExponent)}
              </span>
              <span className="text-brand-coral">
                {c("Payments: −")}{currencySymbol}{formatMinorUnits(matchingStats.outflows, currencyExponent)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div data-screen-entry className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto" role="region" aria-label={c("Transaction details")} tabIndex={0}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-subtle border-b border-border-subtle text-text-muted font-semibold uppercase tracking-wider text-xs">
                <th className="py-3 px-3.5">{t.th_date}</th>
                <th className="py-3 px-3.5">{c("Voucher #")}</th>
                <th className="py-3 px-3.5">{t.th_voucher_name}</th>
                <th className="py-3 px-3.5">{t.th_category}</th>
                <th className="py-3 px-3.5">{t.th_account}</th>
                <th className="py-3 px-3.5">{c("Classification")}</th>
                <th className="py-3 px-3.5 text-right">{t.th_inflow}</th>
                <th className="py-3 px-3.5 text-right">{t.th_outflow}</th>
                <th className="py-3 px-3.5 text-right">{c("Transfer")}</th>
                <th className="py-3 px-3.5 text-right">{c("Balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-text-muted">
                    {c("Loading records...")}
                  </td>
                </tr>
              ) : unavailable ? (
                <tr><td colSpan={10} className="p-8 text-brand-coral">{!validRange ? c('Choose a valid date range.') : c('Could not load the report. Please retry.')}</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-text-muted">
                    <p className="font-medium">{t.empty_state_no_items}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {hasDetailFilter ? c("Try clearing your filters or changing the period.") : c("No cash movements recorded in this period.")}
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
                      className="hover:bg-surface-subtle transition-colors"
                      data-testid={`report-row-${idx}`}
                    >
                      <td className="py-3 px-3.5 tabular-nums text-text-muted whitespace-nowrap">
                        {v.business_date}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums font-medium text-text-main whitespace-nowrap">
                        {v.voucher_number}
                        {v.is_reversed && (
                          <span className="ms-1.5 px-1.5 py-0.5 rounded text-xs bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-brand-coral">
                            {c("VOID")}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-text-main">
                          {v.party_name_snap || '—'}
                        </div>
                        {(v.notes || v.reference_note) && (
                          <div className="text-xs text-text-muted truncate max-w-[180px]">
                            {v.notes || v.reference_note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-text-main">
                        {categoryName(v.category_id)}
                      </td>
                      <td className="py-3 px-3.5 text-text-main whitespace-nowrap">
                        {v.account_name_snap || '—'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-subtle text-text-main">
                          {classificationLabel(v.classification)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-right whitespace-nowrap font-medium text-brand-emerald">
                        {isInflow && v.classification !== 'transfer' ? `+${currencySymbol}${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-right whitespace-nowrap font-medium text-brand-coral">
                        {!isInflow && v.classification !== 'transfer' ? `−${currencySymbol}${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-right whitespace-nowrap text-text-main">
                        {v.classification === 'transfer' && <span>{transferText(language,isInflow?'transferIn':'transferOut')}: <bdi>{currencySymbol}{formatMinorUnits(v.amount_minor,currencyExponent)}</bdi></span>}
                      </td>
                      <td className="py-3 px-3.5 tabular-nums text-right whitespace-nowrap font-semibold text-text-main">
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
