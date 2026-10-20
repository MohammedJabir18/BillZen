import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  RotateCcw,
  Printer,
  X,
  AlertTriangle,
  FileText,
  Building2,
  Eye,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  CashbookVoucher,
  CashbookLedgerEntry,
  CashbookSummary,
  CreateVoucherInput,
  MovementDirection,
  CashbookClassification,
  PaymentMethod,
  PartyType,
  CategoryType,
} from '../types/cashbook';
import type { BusinessSettings, ActivePrintDocument } from '../types';
import type { Language } from '../i18n';
import {
  getMoneyAccounts,
  createMoneyAccount,
  getCashbookCategories,
  createCashbookCategory,
  getCashbookParties,
  createCashbookParty,
  postCashbookVoucher,
  reverseCashbookVoucher,
  getCashbookLedger,
  generateIdempotencyKey,
} from '../adapters/cashbook';
import { getTodayBusinessDate, formatMinorUnits, parseToMinorUnits } from '../domain/financial';
import { isTauriEnvironment } from '../adapters/tauri';
import { preparePrintStyles, cleanupPrintStyles } from '../utils/print';
import { useBackHandler } from '../hooks/useBackHandler';
import { PrintableVoucherDocument } from './PrintableVoucherDocument';

interface CashbookViewProps {
  settings: BusinessSettings;
  language: Language;
  onSetActivePrintDocument?: (doc: ActivePrintDocument) => void;
  initialModal?: 'inflow' | 'outflow' | null;
  onClearInitialModal?: () => void;
}

export const CashbookView: React.FC<CashbookViewProps> = ({
  settings,
  onSetActivePrintDocument,
  initialModal,
  onClearInitialModal,
}) => {
  const queryClient = useQueryClient();
  const currencyExponent = settings.currency_exponent ?? 2;
  const currencyCode = settings.currency_code ?? 'INR';
  const currencySymbol = settings.currency_symbol ?? '₹';

  // State: Filters
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [classificationFilter, setClassificationFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  // State: Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [entryDirection, setEntryDirection] = useState<MovementDirection>('inflow');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState<boolean>(false);
  const [viewingVoucher, setViewingVoucher] = useState<CashbookVoucher | null>(null);
  const [voucherPrintFormat, setVoucherPrintFormat] = useState<'a4' | 'thermal80'>('a4');
  const [reversingVoucher, setReversingVoucher] = useState<CashbookVoucher | null>(null);

  React.useEffect(() => {
    if (initialModal) {
      setEntryDirection(initialModal);
      setIsEntryModalOpen(true);
      if (onClearInitialModal) onClearInitialModal();
    }
  }, [initialModal, onClearInitialModal]);

  // State: Reversal Negative Balance Confirmation Dialog
  const [reversalNegativeBalancePrompt, setReversalNegativeBalancePrompt] = useState<{
    voucher: CashbookVoucher;
    currentBalanceMinor: number;
    amountMinor: number;
    projectedBalanceMinor: number;
    message: string;
  } | null>(null);

  // State: Negative Balance Confirmation Dialog
  const [negativeBalancePrompt, setNegativeBalancePrompt] = useState<{
    pendingInput: CreateVoucherInput;
    currentBalanceMinor: number;
    amountMinor: number;
    projectedBalanceMinor: number;
    message: string;
  } | null>(null);

  // State: Error Toast / Notification
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Queries
  const {
    data: accounts = [],
    isLoading: isAccountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ['cashbook_accounts'],
    queryFn: getMoneyAccounts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['cashbook_categories'],
    queryFn: getCashbookCategories,
  });

  const { data: parties = [] } = useQuery({
    queryKey: ['cashbook_parties'],
    queryFn: getCashbookParties,
  });

  const ledgerFilter = useMemo(() => ({
    account_id: selectedAccountId || null,
    start_date: startDate || null,
    end_date: endDate || null,
    classification: classificationFilter || null,
    search: searchQuery || null,
    include_archived: includeArchived,
  }), [selectedAccountId, startDate, endDate, classificationFilter, searchQuery, includeArchived]);

  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: ['cashbook_ledger', ledgerFilter],
    queryFn: () => getCashbookLedger(ledgerFilter),
  });

  const entries: CashbookLedgerEntry[] = ledgerData?.entries || [];
  const summary: CashbookSummary = ledgerData?.summary || {
    total_cash_minor: 0,
    active_cash_minor: 0,
    period_inflows_minor: 0,
    period_outflows_minor: 0,
    net_operating_cash_flow_minor: 0,
    opening_balance_minor: 0,
    closing_balance_minor: 0,
  };

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.is_archived), [accounts]);

  // Form State: Entry Modal
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formAmountText, setFormAmountText] = useState<string>('');
  const [formBusinessDate, setFormBusinessDate] = useState<string>(
    getTodayBusinessDate(settings.timezone)
  );
  const [formClassification, setFormClassification] = useState<CashbookClassification>('operating_income');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formPartyId, setFormPartyId] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('cash');
  const [formReferenceNote, setFormReferenceNote] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>(generateIdempotencyKey());
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState<boolean>(false);

  // Form State: New Account Modal
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<string>('cash');
  const [newAccOpeningText, setNewAccOpeningText] = useState<string>('0');
  const [newAccAllowNegative, setNewAccAllowNegative] = useState<boolean>(false);
  const [newAccBankName, setNewAccBankName] = useState<string>('');
  const [newAccNumber, setNewAccNumber] = useState<string>('');

  // Form State: New Category Modal
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatType, setNewCatType] = useState<CategoryType>('both');

  // Form State: New Party Modal
  const [newPartyName, setNewPartyName] = useState<string>('');
  const [newPartyType, setNewPartyType] = useState<PartyType>('customer');
  const [newPartyPhone, setNewPartyPhone] = useState<string>('');

  // Back button hooks
  useBackHandler(isEntryModalOpen, () => setIsEntryModalOpen(false));
  useBackHandler(isAccountModalOpen, () => setIsAccountModalOpen(false));
  useBackHandler(isCategoryModalOpen, () => setIsCategoryModalOpen(false));
  useBackHandler(isPartyModalOpen, () => setIsPartyModalOpen(false));
  useBackHandler(Boolean(viewingVoucher), () => setViewingVoucher(null));
  useBackHandler(Boolean(reversingVoucher), () => setReversingVoucher(null));
  useBackHandler(Boolean(negativeBalancePrompt), () => setNegativeBalancePrompt(null));
  useBackHandler(Boolean(reversalNegativeBalancePrompt), () => setReversalNegativeBalancePrompt(null));

  // Synchronize active print document whenever viewed voucher or format changes
  React.useEffect(() => {
    if (viewingVoucher) {
      onSetActivePrintDocument?.({
        type: 'voucher',
        voucher: viewingVoucher,
        format: voucherPrintFormat,
      });
      preparePrintStyles(voucherPrintFormat);
    } else {
      onSetActivePrintDocument?.(null);
      cleanupPrintStyles();
    }
  }, [viewingVoucher, voucherPrintFormat, onSetActivePrintDocument]);

  // Open Entry Modal with given direction
  const handleOpenEntry = (dir: MovementDirection) => {
    setEntryDirection(dir);
    setFormClassification(dir === 'inflow' ? 'operating_income' : 'operating_expense');
    setFormAmountText('');
    setFormBusinessDate(getTodayBusinessDate(settings.timezone));
    setFormAccountId(activeAccounts[0]?.id || '');
    setFormCategoryId('');
    setFormPartyId('');
    setFormPaymentMethod('cash');
    setFormReferenceNote('');
    setFormNotes('');
    setCurrentIdempotencyKey(generateIdempotencyKey());
    setIsEntryModalOpen(true);
  };

  // Submit Voucher Mutation
  const submitVoucherMutation = useMutation({
    mutationFn: postCashbookVoucher,
    onSuccess: (res) => {
      setIsSubmittingVoucher(false);
      if (res.status === 'requires_confirmation') {
        setNegativeBalancePrompt({
          pendingInput: {
            account_id: formAccountId,
            direction: entryDirection,
            classification: formClassification,
            payment_method: formPaymentMethod,
            amount_minor: parseToMinorUnits(formAmountText, currencyExponent),
            business_date: formBusinessDate,
            party_id: formPartyId || null,
            category_id: formCategoryId || null,
            reference_note: formReferenceNote || null,
            notes: formNotes || null,
            idempotency_key: currentIdempotencyKey,
            confirmed_negative_balance: false,
          },
          currentBalanceMinor: res.current_balance_minor,
          amountMinor: res.amount_minor,
          projectedBalanceMinor: res.projected_balance_minor,
          message: res.message,
        });
      } else {
        setIsEntryModalOpen(false);
        setNegativeBalancePrompt(null);
        setSuccessMessage(`Voucher ${res.voucher_number} posted successfully!`);
        queryClient.invalidateQueries({ queryKey: ['cashbook_ledger'] });
        queryClient.invalidateQueries({ queryKey: ['cashbook_accounts'] });
      }
    },
    onError: (err: any) => {
      setIsSubmittingVoucher(false);
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to post voucher';
      setErrorMessage(msg);
    },
  });

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    let amountMinor = 0;
    try {
      amountMinor = parseToMinorUnits(formAmountText, currencyExponent);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid amount');
      return;
    }

    if (amountMinor <= 0) {
      setErrorMessage('Amount must be greater than zero');
      return;
    }

    if (!formAccountId) {
      setErrorMessage('Please select an account');
      return;
    }

    setIsSubmittingVoucher(true);
    submitVoucherMutation.mutate({
      account_id: formAccountId,
      direction: entryDirection,
      classification: formClassification,
      payment_method: formPaymentMethod,
      amount_minor: amountMinor,
      business_date: formBusinessDate,
      party_id: formPartyId || null,
      category_id: formCategoryId || null,
      reference_note: formReferenceNote || null,
      notes: formNotes || null,
      idempotency_key: currentIdempotencyKey,
      confirmed_negative_balance: false,
    });
  };

  const handleConfirmNegativeBalance = () => {
    if (!negativeBalancePrompt) return;
    setIsSubmittingVoucher(true);
    submitVoucherMutation.mutate({
      ...negativeBalancePrompt.pendingInput,
      confirmed_negative_balance: true,
    });
  };

  // Reversal Mutation
  const reverseMutation = useMutation({
    mutationFn: ({ voucherId, confirmed }: { voucherId: string; confirmed: boolean }) =>
      reverseCashbookVoucher(voucherId, confirmed),
    onSuccess: (res, variables) => {
      if (res.status === 'requires_confirmation') {
        const targetVoucher = reversingVoucher || entries.find((e) => e.voucher.id === variables.voucherId)?.voucher;
        if (targetVoucher) {
          setReversalNegativeBalancePrompt({
            voucher: targetVoucher,
            currentBalanceMinor: res.current_balance_minor,
            amountMinor: res.amount_minor,
            projectedBalanceMinor: res.projected_balance_minor,
            message: res.message,
          });
        } else {
          setErrorMessage(res.message);
        }
      } else {
        setReversalNegativeBalancePrompt(null);
        setReversingVoucher(null);
        setSuccessMessage(`Voucher reversed successfully. Reversal voucher: ${res.voucher_number}`);
        queryClient.invalidateQueries({ queryKey: ['cashbook_ledger'] });
        queryClient.invalidateQueries({ queryKey: ['cashbook_accounts'] });
      }
    },
    onError: (err: any) => {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to reverse voucher';
      setErrorMessage(msg);
    },
  });

  const handleConfirmNegativeBalanceReversal = () => {
    if (!reversalNegativeBalancePrompt) return;
    reverseMutation.mutate({
      voucherId: reversalNegativeBalancePrompt.voucher.id,
      confirmed: true,
    });
  };

  // Account Creation Mutation
  const createAccountMutation = useMutation({
    mutationFn: createMoneyAccount,
    onSuccess: (newAcc) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook_accounts'] });
      setIsAccountModalOpen(false);
      setSuccessMessage(`Account "${newAcc.account_name}" created successfully!`);
      setFormAccountId(newAcc.id);
    },
    onError: (err: any) => {
      setErrorMessage(typeof err === 'string' ? err : err?.message || 'Failed to create account');
    },
  });

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let openingMinor = 0;
    try {
      openingMinor = parseToMinorUnits(newAccOpeningText, currencyExponent);
    } catch {
      setErrorMessage('Invalid opening balance');
      return;
    }

    createAccountMutation.mutate({
      account_name: newAccName.trim(),
      account_type: newAccType,
      opening_balance_minor: openingMinor,
      allow_negative_balance: newAccAllowNegative,
      currency_code: currencyCode,
      currency_exponent: currencyExponent,
      bank_name: newAccBankName ? newAccBankName.trim() : null,
      account_number: newAccNumber ? newAccNumber.trim() : null,
    });
  };

  // Inline Category Creation
  const createCategoryMutation = useMutation({
    mutationFn: createCashbookCategory,
    onSuccess: (cat) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook_categories'] });
      setIsCategoryModalOpen(false);
      setFormCategoryId(cat.id);
      setSuccessMessage(`Category "${cat.name}" created!`);
    },
    onError: (err: any) => setErrorMessage(typeof err === 'string' ? err : err?.message || 'Failed to create category'),
  });

  // Inline Party Creation
  const createPartyMutation = useMutation({
    mutationFn: createCashbookParty,
    onSuccess: (party) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook_parties'] });
      setIsPartyModalOpen(false);
      setFormPartyId(party.id);
      setSuccessMessage(`Party "${party.name}" created!`);
    },
    onError: (err: any) => setErrorMessage(typeof err === 'string' ? err : err?.message || 'Failed to create party'),
  });

  // Filtered categories compatible with current direction
  const compatibleCategories = useMemo(() => {
    return categories.filter((c) => {
      if (c.is_archived) return false;
      if (entryDirection === 'inflow') return c.category_type === 'income' || c.category_type === 'both';
      return c.category_type === 'expense' || c.category_type === 'both';
    });
  }, [categories, entryDirection]);

  // Handle Print Action
  const handlePrint = (voucher: CashbookVoucher, format: 'a4' | 'thermal80') => {
    setViewingVoucher(voucher);
    setVoucherPrintFormat(format);
    onSetActivePrintDocument?.({
      type: 'voucher',
      voucher,
      format,
    });
    preparePrintStyles(format);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center justify-between text-rose-800 dark:text-rose-200 text-xs sm:text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Browser Mode Ephemeral In-Memory Banner */}
      {!isTauriEnvironment() && (
        <div data-testid="browser-mode-banner" className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5 text-amber-800 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <strong>Browser Preview Mode:</strong> Transactions, accounts, and running balances are maintained in memory for preview and testing. Data will reset upon page reload. For permanent offline SQLite durability, launch BillZen Desktop or Android.
          </div>
        </div>
      )}

      {/* Query Error State with Retry Button */}
      {(Boolean(accountsError) || Boolean(ledgerError)) && (
        <div data-testid="cashbook-error-banner" className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between text-rose-800 dark:text-rose-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Failed to load cashbook data. Please check connection and retry.</span>
          </div>
          <button
            onClick={() => {
              refetchAccounts();
              refetchLedger();
            }}
            data-testid="btn-retry-cashbook-load"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-indigo-600 dark:text-lime-400" />
            <span>Company Cashbook</span>
            {(isAccountsLoading || isLedgerLoading) && (
              <span className="w-4 h-4 border-2 border-indigo-600 dark:border-lime-400 border-t-transparent rounded-full animate-spin" title="Loading data..." />
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Offline ledger for recording company receipts & payments with running balances.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenEntry('inflow')}
            data-testid="action-receive-money"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Receive Money</span>
          </button>

          <button
            onClick={() => handleOpenEntry('outflow')}
            data-testid="action-pay-money"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Pay Money</span>
          </button>

          <button
            onClick={() => {
              setNewAccName('');
              setNewAccOpeningText('0');
              setNewAccBankName('');
              setNewAccNumber('');
              setIsAccountModalOpen(true);
            }}
            data-testid="action-manage-accounts"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <span>Accounts ({accounts.length})</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Cash Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
            Total Cash (All Accounts)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
              {currencySymbol} {formatMinorUnits(summary.total_cash_minor, currencyExponent)}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
            Active: {currencySymbol} {formatMinorUnits(summary.active_cash_minor, currencyExponent)}
          </span>
        </div>

        {/* Period Inflows Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Money Received</span>
          </span>
          <div className="mt-1">
            <span className="text-lg sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              + {currencySymbol} {formatMinorUnits(summary.period_inflows_minor, currencyExponent)}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block truncate">
            {startDate || endDate ? 'Filtered Period' : 'All-time total'}
          </span>
        </div>

        {/* Period Outflows Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider block flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Money Paid</span>
          </span>
          <div className="mt-1">
            <span className="text-lg sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              - {currencySymbol} {formatMinorUnits(summary.period_outflows_minor, currencyExponent)}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block truncate">
            {startDate || endDate ? 'Filtered Period' : 'All-time total'}
          </span>
        </div>

        {/* Period Balances Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-[11px] font-medium text-indigo-600 dark:text-lime-400 uppercase tracking-wider block">
            Closing Balance
          </span>
          <div className="mt-1">
            <span className="text-lg sm:text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">
              {currencySymbol} {formatMinorUnits(summary.closing_balance_minor, currencyExponent)}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block truncate">
            Opening: {currencySymbol} {formatMinorUnits(summary.opening_balance_minor, currencyExponent)}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Account Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              data-testid="filter-account"
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} {a.is_archived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="filter-start-date"
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="filter-end-date"
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Classification Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Classification
            </label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              data-testid="filter-classification"
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              <option value="operating_income">Operating Income</option>
              <option value="operating_expense">Operating Expense</option>
              <option value="capital">Capital</option>
              <option value="loan">Loan</option>
              <option value="advance">Advance</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Voucher #, party, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="filter-search"
                className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg pl-8 p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Secondary Filter toggles */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0"
            />
            <span>Include Archived Accounts</span>
          </label>

          {(startDate || endDate || classificationFilter || searchQuery || selectedAccountId) && (
            <button
              onClick={() => {
                setSelectedAccountId('');
                setStartDate('');
                setEndDate('');
                setClassificationFilter('');
                setSearchQuery('');
              }}
              className="text-indigo-600 dark:text-lime-400 hover:underline font-medium cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Matching Search Results Banner (Decoupled from Financial Statement) */}
      {summary.matching_count !== undefined && summary.matching_count !== null && (
        <div className="p-3 bg-indigo-50 dark:bg-zinc-800/80 border border-indigo-100 dark:border-zinc-700 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-zinc-200">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-lime-400 shrink-0" />
            <span>
              Display Filter Active: <strong>{summary.matching_count} matching entries found</strong>.
              Statement closing balance remains <strong>{currencySymbol} {formatMinorUnits(summary.closing_balance_minor, currencyExponent)}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
            <span>Hits In: +{currencySymbol} {formatMinorUnits(summary.matching_inflows_minor ?? 0, currencyExponent)}</span>
            <span>Hits Out: -{currencySymbol} {formatMinorUnits(summary.matching_outflows_minor ?? 0, currencyExponent)}</span>
          </div>
        </div>
      )}

      {/* Ledger Table / List Section */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {entries.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-200">No cashbook transactions found</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-5">
              {accounts.length === 0
                ? 'Create a money account to start issuing receipts and payment vouchers.'
                : 'No entries match your selected account or filters.'}
            </p>
            {accounts.length === 0 ? (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Account</span>
              </button>
            ) : (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleOpenEntry('inflow')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Receive Money</span>
                </button>
                <button
                  onClick={() => handleOpenEntry('outflow')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Pay Money</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="cashbook-ledger-table">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Voucher #</th>
                    <th className="py-3 px-3.5">Account</th>
                    <th className="py-3 px-3.5">Party / Particulars</th>
                    <th className="py-3 px-3.5">Classification</th>
                    <th className="py-3 px-3.5 text-right">Inflow</th>
                    <th className="py-3 px-3.5 text-right">Outflow</th>
                    <th className="py-3 px-3.5 text-right">Running Balance</th>
                    <th className="py-3 px-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {entries.map(({ voucher, movement, running_balance_minor }) => {
                    const isInflow = movement.amount_minor > 0;
                    return (
                      <tr
                        key={voucher.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                          voucher.is_reversed ? 'opacity-60 bg-slate-50/50 dark:bg-zinc-900/50' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                          {movement.business_date}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{voucher.voucher_number}</span>
                            {voucher.is_reversal && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded">
                                REV
                              </span>
                            )}
                            {voucher.is_reversed && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded">
                                VOID
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                          {voucher.account_name_snap}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-medium text-slate-800 dark:text-zinc-200">
                            {voucher.party_name_snap || 'Direct Counterparty'}
                          </div>
                          {voucher.reference_note && (
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-xs">
                              Ref: {voucher.reference_note}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 dark:text-zinc-400 capitalize">
                          {voucher.classification.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {isInflow ? `+${formatMinorUnits(movement.amount_minor, currencyExponent)}` : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {!isInflow ? `-${formatMinorUnits(Math.abs(movement.amount_minor), currencyExponent)}` : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                          {currencySymbol} {formatMinorUnits(running_balance_minor, currencyExponent)}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setViewingVoucher(voucher);
                                setVoucherPrintFormat('a4');
                              }}
                              data-testid="btn-view-voucher"
                              title="View & Print Voucher"
                              className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-lime-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!voucher.is_reversed && !voucher.is_reversal && (
                              <button
                                onClick={() => setReversingVoucher(voucher)}
                                data-testid="btn-reverse-voucher"
                                title="Reverse Voucher"
                                className="p-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {entries.map(({ voucher, movement, running_balance_minor }) => {
                const isInflow = movement.amount_minor > 0;
                return (
                  <div key={voucher.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                            {voucher.voucher_number}
                          </span>
                          {voucher.is_reversal && (
                            <span className="px-1 py-0.2 text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded">
                              REV
                            </span>
                          )}
                          {voucher.is_reversed && (
                            <span className="px-1 py-0.2 text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded">
                              VOID
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          {movement.business_date} • {voucher.account_name_snap}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono text-sm font-bold ${
                          isInflow ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isInflow ? '+' : '-'}{currencySymbol} {formatMinorUnits(Math.abs(movement.amount_minor), currencyExponent)}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                          Bal: {currencySymbol} {formatMinorUnits(running_balance_minor, currencyExponent)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300 pt-1 border-t border-slate-50 dark:border-zinc-800/60">
                      <div>
                        <span>{voucher.party_name_snap || 'Direct Counterparty'}</span>
                        <span className="text-slate-500 dark:text-zinc-400 text-[10px] ml-1.5">({voucher.classification.replace(/_/g, ' ')})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewingVoucher(voucher);
                            setVoucherPrintFormat('a4');
                          }}
                          className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-medium"
                        >
                          View / Print
                        </button>
                        {!voucher.is_reversed && !voucher.is_reversal && (
                          <button
                            onClick={() => setReversingVoucher(voucher)}
                            className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded text-[11px] font-medium"
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Voucher Entry Modal (Receipt / Payment) */}
      {/* ========================================================================= */}
      {isEntryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className={`p-4 border-b flex items-center justify-between ${
              entryDirection === 'inflow'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'
                : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50'
            }`}>
              <div className="flex items-center gap-2">
                {entryDirection === 'inflow' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {entryDirection === 'inflow' ? 'Receive Money (Receipt Voucher)' : 'Pay Money (Payment Voucher)'}
                </h2>
              </div>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Direction Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => {
                    setEntryDirection('inflow');
                    setFormClassification('operating_income');
                    setCurrentIdempotencyKey(generateIdempotencyKey());
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    entryDirection === 'inflow'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Receipt (Inflow)
                </button>
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => {
                    setEntryDirection('outflow');
                    setFormClassification('operating_expense');
                    setCurrentIdempotencyKey(generateIdempotencyKey());
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                    entryDirection === 'outflow'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Payment (Outflow)
                </button>
              </div>

              {/* Amount and Account in a 2-col grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    placeholder={currencyExponent === 3 ? '0.000' : '0.00'}
                    value={formAmountText}
                    onChange={(e) => setFormAmountText(e.target.value)}
                    data-testid="input-voucher-amount"
                    className="w-full text-base font-mono font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Money Account *
                  </label>
                  <select
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    data-testid="select-voucher-account"
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>Select Account</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({a.account_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date and Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Business Date *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formBusinessDate}
                    onChange={(e) => setFormBusinessDate(e.target.value)}
                    data-testid="input-voucher-date"
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Financial Classification *
                  </label>
                  <select
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formClassification}
                    onChange={(e) => setFormClassification(e.target.value as CashbookClassification)}
                    data-testid="select-voucher-classification"
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {entryDirection === 'inflow' ? (
                      <>
                        <option value="operating_income">Operating Income (Revenue)</option>
                        <option value="capital">Capital Infusion</option>
                        <option value="loan">Loan Received</option>
                        <option value="refund">Refund Received</option>
                      </>
                    ) : (
                      <>
                        <option value="operating_expense">Operating Expense</option>
                        <option value="capital">Owner Drawings / Capital Return</option>
                        <option value="loan">Loan Repayment / Disbursement</option>
                        <option value="advance">Supplier / Employee Advance</option>
                        <option value="refund">Refund Paid</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Category with inline Add button */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Category (Optional)
                  </label>
                  <button
                    type="button"
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    onClick={() => {
                      setNewCatName('');
                      setNewCatType(entryDirection === 'inflow' ? 'income' : 'expense');
                      setIsCategoryModalOpen(true);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-60 disabled:no-underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Category</span>
                  </button>
                </div>
                <select
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  data-testid="select-voucher-category"
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">No Category</option>
                  {compatibleCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Party with inline Add button */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Party / Contact (Optional)
                  </label>
                  <button
                    type="button"
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    onClick={() => {
                      setNewPartyName('');
                      setNewPartyType(entryDirection === 'inflow' ? 'customer' : 'supplier');
                      setNewPartyPhone('');
                      setIsPartyModalOpen(true);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-lime-400 hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-60 disabled:no-underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Party</span>
                  </button>
                </div>
                <select
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  value={formPartyId}
                  onChange={(e) => setFormPartyId(e.target.value)}
                  data-testid="select-voucher-party"
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Direct / Counter Party</option>
                  {parties.filter((p) => !p.is_archived).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.party_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method and Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reference / Cheque #
                  </label>
                  <input
                    type="text"
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    placeholder="Ref #, transaction ID..."
                    value={formReferenceNote}
                    onChange={(e) => setFormReferenceNote(e.target.value)}
                    data-testid="input-voucher-reference"
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  placeholder="Additional remarks..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  data-testid="input-voucher-notes"
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => setIsEntryModalOpen(false)}
                  data-testid="btn-cancel-voucher-entry"
                  className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  data-testid="btn-submit-voucher"
                  className={`px-5 py-2 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer ${
                    entryDirection === 'inflow'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-600 hover:bg-rose-700'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {(isSubmittingVoucher || submitVoucherMutation.isPending) && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>
                    {(isSubmittingVoucher || submitVoucherMutation.isPending)
                      ? 'Posting Voucher...'
                      : entryDirection === 'inflow'
                      ? 'Issue Receipt'
                      : 'Issue Payment'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Two-Step Negative Balance Confirmation Modal */}
      {/* ========================================================================= */}
      {negativeBalancePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">Negative Balance Confirmation Required</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Posting this payment will make the account balance negative. Since this account has strict negative balance protection enabled, your explicit confirmation as company operator is required to proceed.
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-zinc-400">Current Balance:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {currencySymbol} {formatMinorUnits(negativeBalancePrompt.currentBalanceMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>Payment Amount:</span>
                <span className="font-bold">
                  - {currencySymbol} {formatMinorUnits(negativeBalancePrompt.amountMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-amber-200 dark:border-amber-800 font-bold text-red-600 dark:text-red-400 text-sm">
                <span>Projected Balance:</span>
                <span>
                  {currencySymbol} {formatMinorUnits(negativeBalancePrompt.projectedBalanceMinor, currencyExponent)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
              Note: This confirmation will be logged immutably in the company cashbook audit trail.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNegativeBalancePrompt(null)}
                data-testid="btn-cancel-negative-balance"
                className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800"
              >
                Cancel (Make No Changes)
              </button>
              <button
                type="button"
                onClick={handleConfirmNegativeBalance}
                data-testid="btn-confirm-negative-balance"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirm & Post Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Reversal Confirmation Modal */}
      {/* ========================================================================= */}
      {reversingVoucher && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
              <RotateCcw className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Reverse Voucher {reversingVoucher.voucher_number}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Posted vouchers cannot be modified or deleted. Reversing will post an equal and opposite movement to restore the account balance, while permanently maintaining the original record and audit trail.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Original Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {currencySymbol} {formatMinorUnits(reversingVoucher.amount_minor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Direction:</span>
                <span className="capitalize">{reversingVoucher.direction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Account:</span>
                <span>{reversingVoucher.account_name_snap}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversingVoucher(null)}
                disabled={reverseMutation.isPending}
                className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => reverseMutation.mutate({ voucherId: reversingVoucher.id, confirmed: false })}
                disabled={reverseMutation.isPending}
                data-testid="btn-confirm-reversal"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {reverseMutation.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Confirm Reversal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Reversal Negative Balance Confirmation Modal */}
      {/* ========================================================================= */}
      {reversalNegativeBalancePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Negative Cash Balance Warning (Reversal)
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              Reversing receipt voucher <strong>{reversalNegativeBalancePrompt.voucher.voucher_number}</strong> will deduct funds from the account, causing the cash balance to drop below zero. Owner confirmation is required to proceed.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Original Voucher ID:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {reversalNegativeBalancePrompt.voucher.voucher_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Current Balance:</span>
                <span className="font-mono text-slate-900 dark:text-zinc-100">
                  {currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.currentBalanceMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">Reversal Deduction:</span>
                <span className="font-mono text-rose-600 dark:text-rose-300 font-semibold">
                  -{currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.amountMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-amber-200 dark:border-amber-900/40 font-bold">
                <span className="text-slate-700 dark:text-zinc-200">Projected Balance:</span>
                <span className="font-mono text-rose-600 dark:text-rose-300">
                  {currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.projectedBalanceMinor, currencyExponent)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
              Note: This confirmation will be logged immutably in the company cashbook audit trail.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReversalNegativeBalancePrompt(null);
                  setReversingVoucher(null);
                }}
                disabled={reverseMutation.isPending}
                data-testid="btn-cancel-reversal-negative-balance"
                className="px-4 py-2 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                Cancel (Make No Changes)
              </button>
              <button
                type="button"
                onClick={handleConfirmNegativeBalanceReversal}
                disabled={reverseMutation.isPending}
                data-testid="btn-confirm-reversal-negative-balance"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {reverseMutation.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Confirm (Proceed with Negative Balance)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Account Management Modal */}
      {/* ========================================================================= */}
      {isAccountModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-lime-400" />
                <span>Company Money Accounts</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                data-testid="btn-close-account-modal"
                className="p-1 text-slate-500 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Existing Accounts List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Existing Accounts</h3>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  {accounts.map((a) => (
                    <div key={a.id} className="p-3 flex items-center justify-between bg-white dark:bg-zinc-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100">{a.account_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded uppercase">
                            {a.account_type}
                          </span>
                          {a.is_archived && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          Opening: {currencySymbol} {formatMinorUnits(a.opening_balance_minor, currencyExponent)} •{' '}
                          {a.allow_negative_balance ? 'Negative balance permitted' : 'Protected (no negative)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create New Account Form */}
              <form onSubmit={handleCreateAccountSubmit} className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Create New Account</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Petty Cash, HDFC Bank"
                      value={newAccName}
                      data-testid="input-new-account-name"
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Account Type *
                    </label>
                    <select
                      value={newAccType}
                      data-testid="select-new-account-type"
                      onChange={(e) => setNewAccType(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                    >
                      <option value="cash">Cash Drawer</option>
                      <option value="bank">Bank Account</option>
                      <option value="wallet">Digital Wallet</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Initial Opening Balance ({currencySymbol})
                    </label>
                    <input
                      type="text"
                      value={newAccOpeningText}
                      data-testid="input-new-account-opening"
                      onChange={(e) => setNewAccOpeningText(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 font-mono"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAccAllowNegative}
                        data-testid="checkbox-new-account-allow-negative"
                        onChange={(e) => setNewAccAllowNegative(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Allow Negative Balance</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    data-testid="btn-save-new-account"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Save Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Inline Category Modal */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Add Cashbook Category</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCategoryMutation.mutate({ name: newCatName.trim(), category_type: newCatType });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Courier Charges"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Category Type *</label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as CategoryType)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                >
                  <option value="both">Both (Income & Expense)</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expense Only</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Inline Party Modal */}
      {/* ========================================================================= */}
      {isPartyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Add Cashbook Party</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPartyMutation.mutate({
                  name: newPartyName.trim(),
                  party_type: newPartyType,
                  phone: newPartyPhone ? newPartyPhone.trim() : null,
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe, ABC Corp"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Party Role *</label>
                <select
                  value={newPartyType}
                  onChange={(e) => setNewPartyType(e.target.value as PartyType)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 capitalize"
                >
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="employee">Employee</option>
                  <option value="owner">Owner / Partner</option>
                  <option value="lender">Lender</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+91 ..."
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* View & Print Voucher Dialog */}
      {/* ========================================================================= */}
      {viewingVoucher && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs no-print overflow-y-auto"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600 dark:text-lime-400" />
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm sm:text-base">
                  Voucher: {viewingVoucher.voucher_number}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Format Switcher */}
                <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setVoucherPrintFormat('a4')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      voucherPrintFormat === 'a4'
                        ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    A4 Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherPrintFormat('thermal80')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      voucherPrintFormat === 'thermal80'
                        ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    80mm Thermal
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handlePrint(viewingVoucher, voucherPrintFormat)}
                  data-testid="btn-print-voucher-dialog"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => setViewingVoucher(null)}
                  data-testid="btn-close-voucher-dialog"
                  className="p-1 text-slate-500 hover:text-slate-600 dark:hover:text-zinc-200 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Preview Area */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/70 dark:bg-zinc-950 flex justify-center">
              <div className="bg-white shadow-md rounded overflow-hidden">
                <PrintableVoucherDocument voucher={viewingVoucher} format={voucherPrintFormat} isPrintTarget={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
