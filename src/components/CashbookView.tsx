import { TransferControls } from './TransferControls';
import { transferText } from '../i18n/transfers';
import React, { useState, useMemo, useRef } from 'react';
import { useEntryMotion } from '../hooks/useEntryMotion';
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
  CustomerReceiptIntent,
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
import { customerCashText } from '../i18n/customer_cashbook';
import { cashbookText } from '../i18n/cashbook';
import { CashbookDialog } from './CashbookDialog';
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
  customerReceiptIntent?: CustomerReceiptIntent | null;
  initialModal?: 'inflow' | 'outflow' | null;
  onClearInitialModal?: () => void;
}

export const CashbookView: React.FC<CashbookViewProps> = ({
  settings,
  language,
  onSetActivePrintDocument,
  initialModal,
  customerReceiptIntent,
  onClearInitialModal,
}) => {
  const c = (text: keyof typeof cashbookText) => language === 'en' ? text : cashbookText[text][language];
  const classificationLabel = (value: CashbookClassification) => c(({ operating_income: 'Operating Income', operating_expense: 'Operating Expense', capital: 'Capital', loan: 'Loan', advance: 'Advance', refund: 'Refund', transfer: 'Transfer', opening_balance: 'Opening Balance' } as const)[value]);
  const accountTypeLabel = (value: string) => c(({ cash: 'Cash Drawer', bank: 'Bank Account', wallet: 'Digital Wallet' } as const)[value as 'cash' | 'bank' | 'wallet'] ?? 'Other');
  const partyTypeLabel = (value: PartyType) => c(({ customer: 'Customer', supplier: 'Supplier', employee: 'Employee', owner: 'Owner / Partner', lender: 'Lender', other: 'Other' } as const)[value]);
  const fieldId = React.useId();
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
  const containerRef = useRef<HTMLDivElement>(null);

  // State: Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [entryDirection, setEntryDirection] = useState<MovementDirection>('inflow');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState<boolean>(false);
  const [selectedTransferVoucher, setSelectedTransferVoucher] = useState<CashbookVoucher | null>(null);
  const [viewingVoucher, setViewingVoucher] = useState<CashbookVoucher | null>(null);
  const [voucherPrintFormat, setVoucherPrintFormat] = useState<'a4' | 'thermal80'>('a4');
  const [reversingVoucher, setReversingVoucher] = useState<CashbookVoucher | null>(null);

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

  const errorNotice = errorMessage && <p role="alert" className="m-4 p-3 shrink-0 max-h-32 overflow-y-auto rounded-lg bg-brand-coral-subtle text-brand-coral text-sm break-words">{errorMessage}</p>;

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

  const { data: parties = [], isLoading: partiesLoading } = useQuery({
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

  const isSummaryUnavailable = isAccountsLoading || isLedgerLoading || Boolean(accountsError) || Boolean(ledgerError);
  const summaryAmount = (minor: number) => isSummaryUnavailable ? '—' : formatMinorUnits(minor, currencyExponent);

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

  useEntryMotion(containerRef, '.summary-card', [], 'cards', Boolean(ledgerData));

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
  const [receiptIntent, setReceiptIntent] = useState<CustomerReceiptIntent | null>(null);
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
  const handleOpenEntry = React.useCallback((dir: MovementDirection) => {
    setErrorMessage(null);
    setEntryDirection(dir);
    setFormClassification(dir === 'inflow' ? 'operating_income' : 'operating_expense');
    setFormAmountText('');
    setFormBusinessDate(getTodayBusinessDate(settings.timezone));
    setFormAccountId(activeAccounts[0]?.id || '');
    setFormCategoryId('');
    setFormPartyId('');
    setReceiptIntent(null);
    setFormPaymentMethod('cash');
    setFormReferenceNote('');
    setFormNotes('');
    setCurrentIdempotencyKey(generateIdempotencyKey());
    setIsEntryModalOpen(true);
  }, [activeAccounts, settings.timezone]);

  // Dashboard shortcuts must initialize exactly the same form as Cashbook actions.
  // Wait for the local account list so its default account is a real selection.
  React.useEffect(() => {
    if (!initialModal || isAccountsLoading || (customerReceiptIntent && partiesLoading)) return;
    handleOpenEntry(initialModal);
    if (customerReceiptIntent) {
      const party = parties.find(item => item.id === customerReceiptIntent.party_id);
      if (!party || party.is_archived || party.customer_id !== customerReceiptIntent.customer_id) {
        setIsEntryModalOpen(false);
        setErrorMessage(customerCashText(language, 'selection'));
      } else {
        setFormPartyId(party.id);
        setReceiptIntent(customerReceiptIntent);
      }
    }
    onClearInitialModal?.();
  }, [initialModal, isAccountsLoading, handleOpenEntry, onClearInitialModal, customerReceiptIntent, partiesLoading, parties, language]);

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
        setSuccessMessage(`${c('Voucher posted successfully')}: ${res.voucher_number}`);
        queryClient.invalidateQueries({ queryKey: ['cashbook_ledger'] });
        queryClient.invalidateQueries({ queryKey: ['cashbook_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['money_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['customer_cash_history'] });
      }
    },
    onError: (err: any) => {
      setIsSubmittingVoucher(false);
      const msg = typeof err === 'string' ? err : err?.message || c("Failed to post voucher");
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
      setErrorMessage(err.message || c("Invalid amount"));
      return;
    }

    if (amountMinor <= 0) {
      setErrorMessage(c("Amount must be greater than zero"));
      return;
    }

    if (!formAccountId) {
      setErrorMessage(c("Please select an account"));
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
        setSuccessMessage(`${c('Voucher reversed successfully')}: ${res.voucher_number}`);
        queryClient.invalidateQueries({ queryKey: ['cashbook_ledger'] });
        queryClient.invalidateQueries({ queryKey: ['cashbook_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['money_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['customer_cash_history'] });
      }
    },
    onError: (err: any) => {
      const msg = typeof err === 'string' ? err : err?.message || c("Failed to reverse voucher");
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
      setSuccessMessage(`${c('Account created successfully')}: ${newAcc.account_name}`);
      setFormAccountId(newAcc.id);
    },
    onError: (err: any) => {
      setErrorMessage(typeof err === 'string' ? err : err?.message || c("Failed to create account"));
    },
  });

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let openingMinor = 0;
    try {
      openingMinor = parseToMinorUnits(newAccOpeningText, currencyExponent);
    } catch {
      setErrorMessage(c("Invalid opening balance"));
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
      setSuccessMessage(`${c('Category created successfully')}: ${cat.name}`);
    },
    onError: (err: any) => setErrorMessage(typeof err === 'string' ? err : err?.message || c("Failed to create category")),
  });

  // Inline Party Creation
  const createPartyMutation = useMutation({
    mutationFn: createCashbookParty,
    onSuccess: (party) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook_parties'] });
      setIsPartyModalOpen(false);
      setFormPartyId(party.id);
      setSuccessMessage(`${c('Party created successfully')}: ${party.name}`);
    },
    onError: (err: any) => setErrorMessage(typeof err === 'string' ? err : err?.message || c("Failed to create party")),
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
    if (voucher.classification === 'transfer') { setSelectedTransferVoucher(voucher); return; }
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
    <div className="cashbook-screen space-y-6 min-w-0 text-text-main">
      {/* Toast Notifications */}
      <div className="sr-only" role="status" aria-live="polite">{successMessage}</div>
      <div className="sr-only" role="alert">{errorMessage}</div>
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-brand-coral" />
            <span>{errorMessage}</span>
          </div>
          <button aria-label={c('Close')} onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-emerald" />
            <span>{successMessage}</span>
          </div>
          <button aria-label={c('Close')} onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Browser storage notice (IndexedDB; native uses SQLite) */}
      {!isTauriEnvironment() && (
        <div data-testid="browser-mode-banner" className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5 text-amber-800 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <strong>{c("Browser Preview Mode:")}</strong>  {c("Browser cashbook data is stored on this device in this browser. Clearing site data can erase it. Export backups regularly. Desktop and Android use local SQLite.")}
          </div>
        </div>
      )}

      {/* Query Error State with Retry Button */}
      {(Boolean(accountsError) || Boolean(ledgerError)) && (
        <div data-testid="cashbook-error-banner" className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-brand-coral" />
            <span>{c("Failed to load cashbook data. Please retry.")}</span>
          </div>
          <button
            onClick={() => {
              refetchAccounts();
              refetchLedger();
            }}
            data-testid="btn-retry-cashbook-load"
            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
          >
            {c("Retry")}
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-brand-emerald" />
            <span>{c("Company Cashbook")}</span>
            {(isAccountsLoading || isLedgerLoading) && (
              <span className="w-4 h-4 border-2 border-brand-emerald border-t-transparent rounded-full animate-spin" title={c("Loading data...")} />
            )}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {c("Offline ledger for recording company receipts & payments with running balances.")}
          </p>
        </div>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2">
          <button
            onClick={() => handleOpenEntry('inflow')}
            data-testid="action-receive-money"
            className="min-w-0 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary-hover active:bg-emerald-900 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{c("Receive Money")}</span>
          </button>

          <button
            onClick={() => handleOpenEntry('outflow')}
            data-testid="action-pay-money"
            className="min-w-0 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{c("Pay Money")}</span>
          </button>

          <TransferControls settings={settings} language={language} accounts={accounts}
            selectedVoucher={selectedTransferVoucher} onCloseDetail={() => setSelectedTransferVoucher(null)}
            onSetActivePrintDocument={onSetActivePrintDocument}/>
          <button
            onClick={() => {
              setNewAccName('');
              setNewAccOpeningText('0');
              setNewAccBankName('');
              setNewAccNumber('');
              setIsAccountModalOpen(true);
            }}
            data-testid="action-manage-accounts"
            className="min-[400px]:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-subtle hover:bg-surface-subtle text-text-main rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-text-muted" />
            <span>{c("Accounts (")}{accounts.length})</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div ref={containerRef} data-testid="cashbook-summary" aria-busy={isAccountsLoading || isLedgerLoading} className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Cash Card */}
        <div className="summary-card bg-surface border border-border-subtle rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-xs font-medium text-text-muted tracking-wide block">
            {c("Total Cash (All Accounts)")}
          </span>
          <div className="mt-2 min-w-0">
            <span data-cashbook-amount className="block min-w-0 break-words text-xl sm:text-2xl font-semibold tabular-nums text-text-main">
              {currencySymbol} {summaryAmount(summary.total_cash_minor)}
            </span>
          </div>
          <span className="text-xs text-text-muted mt-1 block">
            {c("Active:")} {currencySymbol} {summaryAmount(summary.active_cash_minor)}
          </span>
        </div>

        {/* Period Inflows Card */}
        <div className="summary-card bg-surface border border-border-subtle rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-xs font-medium text-brand-emerald tracking-wide block flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>{c("Money Received")}</span>
          </span>
          <div className="mt-1">
            <span data-cashbook-amount className="block min-w-0 break-words text-xl sm:text-2xl font-semibold tabular-nums text-brand-emerald">
              + {currencySymbol} {summaryAmount(summary.period_inflows_minor)}
            </span>
          </div>
          <span className="text-xs text-text-muted mt-1 block truncate">
            {startDate || endDate ? c("Filtered Period") : c("All-time total")}
          </span>
        </div>

        {/* Period Outflows Card */}
        <div className="summary-card bg-surface border border-border-subtle rounded-xl p-3.5 sm:p-4 shadow-sm">
          <span className="text-xs font-medium text-brand-coral tracking-wide block flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{c("Money Paid")}</span>
          </span>
          <div className="mt-1">
            <span data-cashbook-amount className="block min-w-0 break-words text-xl sm:text-2xl font-semibold tabular-nums text-brand-coral">
              - {currencySymbol} {summaryAmount(summary.period_outflows_minor)}
            </span>
          </div>
          <span className="text-xs text-text-muted mt-1 block truncate">
            {startDate || endDate ? c("Filtered Period") : c("All-time total")}
          </span>
        </div>

        {/* Period Balances Card */}
        <div className="summary-card bg-brand-lime border border-border-subtle rounded-xl p-3.5 sm:p-4">
          <span className="text-xs font-medium text-text-main tracking-wide block">
            {c("Closing Balance")}
          </span>
          <div className="mt-1">
            <span data-cashbook-amount className="block min-w-0 break-words text-xl sm:text-2xl font-semibold tabular-nums text-text-main">
              {currencySymbol} {summaryAmount(summary.closing_balance_minor)}
            </span>
          </div>
          <span className="text-xs text-text-muted mt-1 block truncate">
            {c("Opening:")} {currencySymbol} {summaryAmount(summary.opening_balance_minor)}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-border-subtle rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Account Filter */}
          <div>
            <label htmlFor={fieldId + '-1'} className="block text-xs font-medium text-text-muted mb-1">
              {c("Account")}
            </label>
            <select id={fieldId + '-1'}
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              data-testid="filter-account"
              className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <option value="">{c("All Accounts")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} {a.is_archived ? `(${c('Archived')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <label htmlFor={fieldId + '-2'} className="block text-xs font-medium text-text-muted mb-1">
              {c("Start Date")}
            </label>
            <input id={fieldId + '-2'}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="filter-start-date"
              className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <label htmlFor={fieldId + '-3'} className="block text-xs font-medium text-text-muted mb-1">
              {c("End Date")}
            </label>
            <input id={fieldId + '-3'}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="filter-end-date"
              className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>

          {/* Classification Filter */}
          <div>
            <label htmlFor={fieldId + '-4'} className="block text-xs font-medium text-text-muted mb-1">
              {c("Classification")}
            </label>
            <select id={fieldId + '-4'}
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              data-testid="filter-classification"
              className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <option value="">{c("All Types")}</option>
              <option value="operating_income">{c("Operating Income")}</option>
              <option value="operating_expense">{c("Operating Expense")}</option>
              <option value="capital">{c("Capital")}</option>
              <option value="loan">{c("Loan")}</option>
              <option value="advance">{c("Advance")}</option>
              <option value="refund">{c("Refund")}</option>
            <option value="transfer">{c("Transfer")}</option>
              </select>
          </div>

          {/* Search Input */}
          <div>
            <label htmlFor={fieldId + '-5'} className="block text-xs font-medium text-text-muted mb-1">
              {c("Search")}
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute start-2.5 top-3.5" />
              <input id={fieldId + '-5'}
                type="text"
                placeholder={c("Voucher #, party, note...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="filter-search"
                className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg ps-8 p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus"
              />
            </div>
          </div>
        </div>

        {/* Secondary Filter toggles */}
        <div className="flex flex-wrap gap-3 items-center justify-between text-xs pt-3 border-t border-border-subtle text-text-muted">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded text-brand-emerald focus:ring-border-focus"
            />
            <span>{c("Include Archived Accounts")}</span>
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
              className="text-brand-emerald hover:underline font-medium cursor-pointer"
            >
              {c("Clear Filters")}
            </button>
          )}
        </div>
      </div>

      {/* Matching Search Results Banner (Decoupled from Financial Statement) */}
      {summary.matching_count !== undefined && summary.matching_count !== null && (
        <div className="p-3 bg-surface-subtle border border-border-medium rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-text-main">
            <SlidersHorizontal className="w-4 h-4 text-brand-emerald shrink-0" />
            <span>
              {c("Display Filter Active:")} <strong>{summary.matching_count}  {c("matching entries found")}</strong>{c(". Statement closing balance remains")} <strong>{currencySymbol} {summaryAmount(summary.closing_balance_minor)}</strong>.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 tabular-nums text-xs text-text-muted">
            <span>{c("Hits In: +")}{currencySymbol} {formatMinorUnits(summary.matching_inflows_minor ?? 0, currencyExponent)}</span>
            <span>{c("Hits Out: -")}{currencySymbol} {formatMinorUnits(summary.matching_outflows_minor ?? 0, currencyExponent)}</span>
          </div>
        </div>
      )}

      {/* Ledger Table / List Section */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        {isLedgerLoading ? (
          <p role="status" className="p-8 text-sm text-text-muted">{c("Loading data...")}</p>
        ) : ledgerError ? (
          <p className="p-8 text-sm text-brand-coral">{c("Failed to load cashbook data. Please retry.")}</p>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-text-main">{c("No cashbook transactions found")}</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-5">
              {accounts.length === 0
                ? c("Create a money account to start issuing receipts and payments.")
                : c("Adjust your filters or record a new receipt/payment.")}
            </p>
            {accounts.length === 0 ? (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary-hover"
              >
                <Plus className="w-4 h-4" />
                <span>{c("Create First Account")}</span>
              </button>
            ) : (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => handleOpenEntry('inflow')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{c("Receive Money")}</span>
                </button>
                <button
                  onClick={() => handleOpenEntry('outflow')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{c("Pay Money")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="cashbook-ledger-table">
                <thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase text-xs font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">{c("Date")}</th>
                    <th className="py-3 px-3.5">{c("Voucher #")}</th>
                    <th className="py-3 px-3.5">{c("Account")}</th>
                    <th className="py-3 px-3.5">{c("Party / Particulars")}</th>
                    <th className="py-3 px-3.5">{c("Classification")}</th>
                    <th className="py-3 px-3.5 text-right">{c("Inflow")}</th>
                    <th className="py-3 px-3.5 text-right">{c("Outflow")}</th>
                    <th className="py-3 px-3.5 text-right">{c("Running Balance")}</th>
                    <th className="py-3 px-3.5 text-center">{c("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {entries.map(({ voucher, movement, running_balance_minor }) => {
                    const isInflow = movement.amount_minor > 0;
                    return (
                      <tr
                        key={voucher.id}
                        className={`hover:bg-surface-subtle transition-colors ${
                          voucher.is_reversed ? 'bg-surface-subtle' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 text-text-muted whitespace-nowrap">
                          {movement.business_date}
                        </td>
                        <td className="py-3 px-3.5 tabular-nums font-medium text-text-main whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span><bdi dir="ltr">{voucher.voucher_number}</bdi></span>
                            {voucher.is_reversal && (
                              <span className="px-1.5 py-0.5 text-xs font-bold bg-surface-subtle text-text-muted rounded">
                                {c("REV")}
                              </span>
                            )}
                            {voucher.is_reversed && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-coral-subtle text-brand-coral rounded">
                                {c("VOID")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-text-muted whitespace-nowrap">
                          {voucher.account_name_snap}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-medium text-text-main">
                            {voucher.classification === 'transfer' ? transferText(language, voucher.direction === 'inflow' ? 'transferIn' : 'transferOut') : voucher.party_name_snap || c("Direct Counterparty")}
                          </div>
                          {voucher.reference_note && (
                            <div className="text-xs text-text-muted truncate max-w-xs">
                              {c("Ref:")} {voucher.reference_note}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-text-muted capitalize">
                          {classificationLabel(voucher.classification)}
                        </td>
                        <td className="py-3 px-3.5 text-right tabular-nums font-semibold text-brand-emerald whitespace-nowrap">
                          {isInflow ? `+${formatMinorUnits(movement.amount_minor, currencyExponent)}` : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-right tabular-nums font-semibold text-brand-coral whitespace-nowrap">
                          {!isInflow ? `-${formatMinorUnits(Math.abs(movement.amount_minor), currencyExponent)}` : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-right tabular-nums font-bold text-text-main whitespace-nowrap">
                          <bdi dir="ltr">{currencySymbol} {formatMinorUnits(running_balance_minor, currencyExponent)}</bdi>
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                if (voucher.classification === 'transfer') setSelectedTransferVoucher(voucher);
                                else setViewingVoucher(voucher);
                                setVoucherPrintFormat('a4');
                              }}
                              data-testid="btn-view-voucher"
                              title={c("View & Print Voucher")}
                              className="p-1 text-text-muted hover:text-brand-emerald hover:bg-surface-subtle rounded transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {voucher.classification !== 'transfer' && !voucher.is_reversed && !voucher.is_reversal && (
                              <button
                                onClick={() => setReversingVoucher(voucher)}
                                data-testid="btn-reverse-voucher"
                                title={c("Reverse Voucher")}
                                className="p-1 text-text-muted hover:text-brand-coral hover:bg-brand-coral-subtle rounded transition-colors"
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
            <div className="md:hidden divide-y divide-border-subtle">
              {entries.map(({ voucher, movement, running_balance_minor }) => {
                const isInflow = movement.amount_minor > 0;
                return (
                  <div key={voucher.id} className="p-4 space-y-3 min-w-0 break-words">
                    <div className="flex flex-col min-[480px]:flex-row min-[480px]:justify-between gap-2 min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="tabular-nums text-xs font-bold text-text-main">
                            {voucher.voucher_number}
                          </span>
                          {voucher.is_reversal && (
                            <span className="px-1 py-0.2 text-[9px] font-bold bg-surface-subtle text-text-muted rounded">
                              {c("REV")}
                            </span>
                          )}
                          {voucher.is_reversed && (
                            <span className="px-1 py-0.2 text-[9px] font-bold bg-brand-coral-subtle text-brand-coral rounded">
                              {c("VOID")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {movement.business_date} • {voucher.account_name_snap}
                        </p>
                      </div>

                      <div className="min-w-0 break-words text-start min-[480px]:text-end">
                        <span dir="ltr" className={`inline-block tabular-nums text-sm font-bold ${
                          isInflow ? 'text-brand-emerald' : 'text-brand-coral'
                        }`}>
                          {isInflow ? '+' : '-'}{currencySymbol} {formatMinorUnits(Math.abs(movement.amount_minor), currencyExponent)}
                        </span>
                        <div className="text-xs text-text-muted">
                          {c("Bal:")} <bdi dir="ltr">{currencySymbol} {formatMinorUnits(running_balance_minor, currencyExponent)}</bdi>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 items-start text-sm text-text-muted pt-3 border-t border-border-subtle">
                      <div>
                        <span>{voucher.classification === 'transfer' ? transferText(language, voucher.direction === 'inflow' ? 'transferIn' : 'transferOut') : voucher.party_name_snap || c("Direct Counterparty")}</span>
                        <span className="text-text-muted text-xs ms-1.5">({classificationLabel(voucher.classification)})</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            if (voucher.classification === 'transfer') setSelectedTransferVoucher(voucher);
                                else setViewingVoucher(voucher);
                            setVoucherPrintFormat('a4');
                          }}
                          className="px-2 py-1 bg-surface-subtle text-text-main rounded text-xs font-medium"
                        >
                          {c("View / Print")}
                        </button>
                        {voucher.classification !== 'transfer' && !voucher.is_reversed && !voucher.is_reversal && (
                          <button
                            onClick={() => setReversingVoucher(voucher)}
                            className="px-2 py-1 bg-brand-coral-subtle text-brand-coral rounded text-xs font-medium"
                          >
                            {c("Reverse")}
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
        <CashbookDialog label={entryDirection === 'inflow' ? c('Receive Money') : c('Pay Money')}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-overlay  animate-in fade-in duration-150"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)]">
            {errorNotice}
            <div className={`p-4 border-b flex items-center justify-between ${
              entryDirection === 'inflow'
                ? 'bg-brand-emerald-subtle border-border-subtle'
                : 'bg-brand-coral-subtle border-border-subtle'
            }`}>
              <div className="flex items-center gap-2">
                {entryDirection === 'inflow' ? (
                  <ArrowDownLeft className="w-5 h-5 text-brand-emerald" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-brand-coral" />
                )}
                <h2 className="text-base font-bold text-text-main">
                  {entryDirection === 'inflow' ? c("Receive Money (Receipt Voucher)") : c("Pay Money (Payment Voucher)")}
                </h2>
              </div>
              <button aria-label={c('Close')}
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Direction Toggle */}
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2 p-1 bg-surface-subtle rounded-lg">
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => {
                    setEntryDirection('inflow');
                    setFormClassification('operating_income');
                    setCurrentIdempotencyKey(generateIdempotencyKey());
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    entryDirection === 'inflow'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {c("Receipt (Inflow)")}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => {
                    setEntryDirection('outflow');
                    setFormClassification('operating_expense');
                    setCurrentIdempotencyKey(generateIdempotencyKey());
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    entryDirection === 'outflow'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {c("Payment (Outflow)")}
                </button>
              </div>

              {/* Amount and Account in a 2-col grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId + '-6'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Amount (")}{currencySymbol}) *
                  </label>
                  <input id={fieldId + '-6'}
                    type="text"
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    placeholder={currencyExponent === 3 ? '0.000' : '0.00'}
                    value={formAmountText}
                    onChange={(e) => setFormAmountText(e.target.value)}
                    data-testid="input-voucher-amount"
                    data-dialog-initial-focus inputMode="decimal" dir="ltr"
                    className="w-full text-base tabular-nums font-bold bg-surface-subtle border border-border-medium rounded-lg p-2.5 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor={fieldId + '-7'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Money Account *")}
                  </label>
                  <select id={fieldId + '-7'}
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    data-testid="select-voucher-account"
                    className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2.5 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>{c("Select Account")}</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({accountTypeLabel(a.account_type)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date and Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId + '-8'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Business Date *")}
                  </label>
                  <input id={fieldId + '-8'}
                    type="date"
                    required
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formBusinessDate}
                    onChange={(e) => setFormBusinessDate(e.target.value)}
                    data-testid="input-voucher-date"
                    className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2.5 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor={fieldId + '-9'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Financial Classification *")}
                  </label>
                  <select id={fieldId + '-9'}
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formClassification}
                    onChange={(e) => setFormClassification(e.target.value as CashbookClassification)}
                    data-testid="select-voucher-classification"
                    className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2.5 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus capitalize disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {entryDirection === 'inflow' ? (
                      <>
                        <option value="operating_income">{c("Operating Income (Revenue)")}</option>
                        <option value="capital">{c("Capital Infusion")}</option>
                        <option value="loan">{c("Loan Received")}</option>
                        <option value="refund">{c("Refund Received")}</option>
                      </>
                    ) : (
                      <>
                        <option value="operating_expense">{c("Operating Expense")}</option>
                        <option value="capital">{c("Owner Drawings / Capital Return")}</option>
                        <option value="loan">{c("Loan Repayment / Disbursement")}</option>
                        <option value="advance">{c("Supplier / Employee Advance")}</option>
                        <option value="refund">{c("Refund Paid")}</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Category with inline Add button */}
              <div>
                <div className="flex flex-wrap gap-2 justify-between items-center mb-1">
                  <label htmlFor={fieldId + '-category'} className="text-xs font-semibold text-text-main">
                    {c("Category (Optional)")}
                  </label>
                  <button
                    type="button"
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    onClick={() => {
                      setNewCatName('');
                      setNewCatType(entryDirection === 'inflow' ? 'income' : 'expense');
                      setErrorMessage(null);
                      setIsCategoryModalOpen(true);
                    }}
                    data-testid="action-new-category"
                    className="text-xs text-brand-emerald hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-60 disabled:no-underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{c("New Category")}</span>
                  </button>
                </div>
                <select
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  data-testid="select-voucher-category" id={fieldId + '-category'}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">{c("No Category")}</option>
                  {compatibleCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Party with inline Add button */}
              <div>
                <div className="flex flex-wrap gap-2 justify-between items-center mb-1">
                  <label htmlFor={fieldId + '-party'} className="text-xs font-semibold text-text-main">
                    {c("Party / Contact (Optional)")}
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(receiptIntent) || isSubmittingVoucher || submitVoucherMutation.isPending}
                    onClick={() => {
                      setNewPartyName('');
                      setNewPartyType(entryDirection === 'inflow' ? 'customer' : 'supplier');
                      setNewPartyPhone('');
                      setErrorMessage(null);
                      setIsPartyModalOpen(true);
                    }}
                    data-testid="action-new-party"
                    className="text-xs text-brand-emerald hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-60 disabled:no-underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{c("New Party")}</span>
                  </button>
                </div>
                {receiptIntent && <p className="text-sm text-text-muted" role="status">{customerCashText(language, 'confirm')}</p>}
                <select
                  disabled={Boolean(receiptIntent) || isSubmittingVoucher || submitVoucherMutation.isPending}
                  value={formPartyId}
                  onChange={(e) => setFormPartyId(e.target.value)}
                  data-testid="select-voucher-party" id={fieldId + '-party'}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">{c("Direct / Counter Party")}</option>
                  {parties.filter((p) => !p.is_archived).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({partyTypeLabel(p.party_type)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method and Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId + '-10'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Payment Method")}
                  </label>
                  <select id={fieldId + '-10'}
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="cash">{c("Cash")}</option>
                    <option value="upi">{c("UPI / QR")}</option>
                    <option value="card">{c("Card")}</option>
                    <option value="bank_transfer">{c("Bank Transfer (NEFT/RTGS)")}</option>
                    <option value="cheque">{c("Cheque")}</option>
                    <option value="other">{c("Other")}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={fieldId + '-11'} className="block text-xs font-semibold text-text-main mb-1">
                    {c("Reference / Cheque #")}
                  </label>
                  <input id={fieldId + '-11'}
                    type="text"
                    disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                    placeholder={c("Ref #, transaction ID...")}
                    value={formReferenceNote}
                    onChange={(e) => setFormReferenceNote(e.target.value)}
                    data-testid="input-voucher-reference"
                    className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor={fieldId + '-12'} className="block text-xs font-semibold text-text-main mb-1">
                  {c("Notes")}
                </label>
                <textarea id={fieldId + '-12'}
                  rows={2}
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  placeholder={c("Additional remarks...")}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  data-testid="input-voucher-notes"
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 text-text-main focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
                <button
                  type="button"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  onClick={() => setIsEntryModalOpen(false)}
                  data-testid="btn-cancel-voucher-entry"
                  className="px-4 py-2 border border-border-medium text-text-main rounded-lg text-xs font-medium hover:bg-surface-subtle cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {c("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher || submitVoucherMutation.isPending}
                  data-testid="btn-submit-voucher"
                  className={`px-5 py-2 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer ${
                    entryDirection === 'inflow'
                      ? 'bg-brand-primary hover:bg-brand-primary-hover'
                      : 'bg-red-700 hover:bg-red-800'
                  } ${(isSubmittingVoucher || submitVoucherMutation.isPending) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {(isSubmittingVoucher || submitVoucherMutation.isPending) && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>
                    {(isSubmittingVoucher || submitVoucherMutation.isPending)
                      ? c("Posting Voucher...")
                      : entryDirection === 'inflow'
                      ? c("Issue Receipt")
                      : c("Issue Payment")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Two-Step Negative Balance Confirmation Modal */}
      {/* ========================================================================= */}
      {negativeBalancePrompt && (
        <CashbookDialog label={c('Negative Balance Confirmation Required')}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-surface-overlay  animate-in fade-in duration-150"
        >
          <div className="bg-surface border border-amber-300 dark:border-amber-700 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            {errorNotice}
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">{c("Negative Balance Confirmation Required")}</h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              {c("Posting this payment will make the account balance negative. Since this account has strict negative balance protection enabled, your explicit confirmation as company operator is required to proceed.")}
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2 text-xs tabular-nums">
              <div className="flex flex-wrap justify-between gap-2 min-w-0 break-words">
                <span className="text-text-muted">{c("Current Balance:")}</span>
                <span className="font-bold text-text-main">
                  {currencySymbol} {formatMinorUnits(negativeBalancePrompt.currentBalanceMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between text-brand-coral">
                <span>{c("Payment Amount:")}</span>
                <span className="font-bold">
                  - {currencySymbol} {formatMinorUnits(negativeBalancePrompt.amountMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-between pt-1 border-t border-amber-200 dark:border-amber-800 font-bold text-red-600 dark:text-red-400 text-sm">
                <span>{c("Projected Balance:")}</span>
                <span>
                  {currencySymbol} {formatMinorUnits(negativeBalancePrompt.projectedBalanceMinor, currencyExponent)}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted italic">
              {c("Note: This confirmation will be logged immutably in the company cashbook audit trail.")}
            </p>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNegativeBalancePrompt(null)}
                data-testid="btn-cancel-negative-balance"
                className="px-4 py-2 border border-border-medium text-text-main rounded-lg text-xs font-medium hover:bg-surface-subtle"
              >
                {c("Cancel (Make No Changes)")}
              </button>
              <button
                type="button"
                onClick={handleConfirmNegativeBalance}
                data-testid="btn-confirm-negative-balance"
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                {c("Confirm & Post Payment")}
              </button>
            </div>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Reversal Confirmation Modal */}
      {/* ========================================================================= */}
      {reversingVoucher && (
        <CashbookDialog label={c('Reverse Voucher')}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay  animate-in fade-in duration-150"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            {errorNotice}
            <div className="flex items-center gap-2.5 text-brand-emerald">
              <RotateCcw className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-text-main">
                {c("Reverse Voucher")} {reversingVoucher.voucher_number}
              </h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              {c("Posted vouchers cannot be modified or deleted. Reversing will post an equal and opposite movement to restore the account balance, while permanently maintaining the original record and audit trail.")}
            </p>

            <div className="p-3 bg-surface-subtle rounded-lg border border-slate-200 dark:border-zinc-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Original Amount:")}</span>
                <span className="tabular-nums font-bold text-text-main">
                  {currencySymbol} {formatMinorUnits(reversingVoucher.amount_minor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Direction:")}</span>
                <span className="capitalize">{c(reversingVoucher.direction === 'inflow' ? 'Inflow' : 'Outflow')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Account:")}</span>
                <span>{reversingVoucher.account_name_snap}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversingVoucher(null)}
                disabled={reverseMutation.isPending}
                className="px-4 py-2 border border-border-medium text-text-main rounded-lg text-xs font-medium hover:bg-surface-subtle disabled:opacity-50 cursor-pointer"
              >
                {c("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => reverseMutation.mutate({ voucherId: reversingVoucher.id, confirmed: false })}
                disabled={reverseMutation.isPending}
                data-testid="btn-confirm-reversal"
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {reverseMutation.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{c("Confirm Reversal")}</span>
              </button>
            </div>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Reversal Negative Balance Confirmation Modal */}
      {/* ========================================================================= */}
      {reversalNegativeBalancePrompt && (
        <CashbookDialog label={c('Negative Cash Balance Warning (Reversal)')}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-surface-overlay  animate-in fade-in duration-150"
        >
          <div className="bg-surface border border-amber-300 dark:border-amber-700 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 shadow-2xl space-y-4">
            {errorNotice}
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-text-main">
                {c("Negative Cash Balance Warning (Reversal)")}
              </h3>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              {c("Reversing receipt voucher")} <strong>{reversalNegativeBalancePrompt.voucher.voucher_number}</strong>  {c("will deduct funds from the account, causing the cash balance to drop below zero. Owner confirmation is required to proceed.")}
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Original Voucher ID:")}</span>
                <span className="tabular-nums font-bold text-text-main">
                  {reversalNegativeBalancePrompt.voucher.voucher_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Current Balance:")}</span>
                <span className="tabular-nums text-text-main">
                  {currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.currentBalanceMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{c("Reversal Deduction:")}</span>
                <span className="tabular-nums text-brand-coral font-semibold">
                  -{currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.amountMinor, currencyExponent)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-between pt-1 border-t border-amber-200 dark:border-amber-900/40 font-bold">
                <span className="text-text-main">{c("Projected Balance:")}</span>
                <span className="tabular-nums text-brand-coral">
                  {currencySymbol} {formatMinorUnits(reversalNegativeBalancePrompt.projectedBalanceMinor, currencyExponent)}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted italic">
              {c("Note: This confirmation will be logged immutably in the company cashbook audit trail.")}
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReversalNegativeBalancePrompt(null);
                  setReversingVoucher(null);
                }}
                disabled={reverseMutation.isPending}
                data-testid="btn-cancel-reversal-negative-balance"
                className="px-4 py-2 border border-border-medium text-text-main rounded-lg text-xs font-medium hover:bg-surface-subtle disabled:opacity-50 cursor-pointer"
              >
                {c("Cancel (Make No Changes)")}
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
                <span>{c("Confirm (Proceed with Negative Balance)")}</span>
              </button>
            </div>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Account Management Modal */}
      {/* ========================================================================= */}
      {isAccountModalOpen && (
        <CashbookDialog label={c('Company Money Accounts')}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-overlay  animate-in fade-in duration-150"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)]">
            {errorNotice}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-emerald" />
                <span>{c("Company Money Accounts")}</span>
              </h2>
              <button aria-label={c('Close')}
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                data-testid="btn-close-account-modal"
                className="p-1 text-text-muted hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Existing Accounts List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-text-muted tracking-wide">{c("Existing Accounts")}</h3>
                <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
                  {accounts.map((a) => (
                    <div key={a.id} className="p-3 flex items-center justify-between bg-surface">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-text-main">{a.account_name}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-surface-subtle text-text-muted rounded uppercase">
                            {accountTypeLabel(a.account_type)}
                          </span>
                          {a.is_archived && (
                            <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                              {c("Archived")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {c("Opening:")} {currencySymbol} {formatMinorUnits(a.opening_balance_minor, currencyExponent)} •{' '}
                          {a.allow_negative_balance ? c("Negative balance permitted") : c("Protected (no negative)")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create New Account Form */}
              <form onSubmit={handleCreateAccountSubmit} className="pt-3 border-t border-border-subtle space-y-3">
                <h3 className="text-xs font-bold text-text-main">{c("Create New Account")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={fieldId + '-13'} className="block text-xs font-medium text-text-muted mb-1">
                      {c("Account Name *")}
                    </label>
                    <input id={fieldId + '-13'}
                      type="text"
                      required
                      placeholder={c("e.g. Petty Cash, HDFC Bank")}
                      value={newAccName}
                      data-testid="input-new-account-name"
                      data-dialog-initial-focus
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                    />
                  </div>

                  <div>
                    <label htmlFor={fieldId + '-14'} className="block text-xs font-medium text-text-muted mb-1">
                      {c("Account Type *")}
                    </label>
                    <select id={fieldId + '-14'}
                      value={newAccType}
                      data-testid="select-new-account-type"
                      onChange={(e) => setNewAccType(e.target.value)}
                      className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                    >
                      <option value="cash">{c("Cash Drawer")}</option>
                      <option value="bank">{c("Bank Account")}</option>
                      <option value="wallet">{c("Digital Wallet")}</option>
                      <option value="other">{c("Other")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={fieldId + '-15'} className="block text-xs font-medium text-text-muted mb-1">
                      {c("Initial Opening Balance (")}{currencySymbol})
                    </label>
                    <input id={fieldId + '-15'}
                      type="text"
                      value={newAccOpeningText}
                      data-testid="input-new-account-opening"
                      inputMode="decimal" dir="ltr"
                      onChange={(e) => setNewAccOpeningText(e.target.value)}
                      className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 tabular-nums"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAccAllowNegative}
                        data-testid="checkbox-new-account-allow-negative"
                        onChange={(e) => setNewAccAllowNegative(e.target.checked)}
                        className="rounded text-brand-emerald"
                      />
                      <span>{c("Allow Negative Balance")}</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    data-testid="btn-save-new-account"
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {c("Save Account")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Inline Category Modal */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <CashbookDialog label={c('Add Cashbook Category')}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-surface-overlay "
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-2xl space-y-3">
            {errorNotice}
            <h3 className="text-sm font-bold text-text-main">{c("Add Cashbook Category")}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCategoryMutation.mutate({ name: newCatName.trim(), category_type: newCatType });
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor={fieldId + '-16'} className="block text-xs font-medium text-text-muted mb-1">{c("Category Name *")}</label>
                <input id={fieldId + '-16'}
                  type="text"
                  required
                  placeholder={c("e.g. Courier Charges")}
                  data-dialog-initial-focus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                />
              </div>

              <div>
                <label htmlFor={fieldId + '-17'} className="block text-xs font-medium text-text-muted mb-1">{c("Category Type *")}</label>
                <select id={fieldId + '-17'}
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as CategoryType)}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                >
                  <option value="both">{c("Both (Income & Expense)")}</option>
                  <option value="income">{c("Income Only")}</option>
                  <option value="expense">{c("Expense Only")}</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 border border-border-medium rounded-lg text-xs"
                >
                  {c("Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-semibold"
                >
                  {c("Create")}
                </button>
              </div>
            </form>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* Inline Party Modal */}
      {/* ========================================================================= */}
      {isPartyModalOpen && (
        <CashbookDialog label={c('Add Cashbook Party')}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-surface-overlay "
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-2xl space-y-3">
            {errorNotice}
            <h3 className="text-sm font-bold text-text-main">{c("Add Cashbook Party")}</h3>
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
                <label htmlFor={fieldId + '-18'} className="block text-xs font-medium text-text-muted mb-1">{c("Party Name *")}</label>
                <input id={fieldId + '-18'}
                  type="text"
                  required
                  placeholder={c("e.g. John Doe, ABC Corp")}
                  data-dialog-initial-focus
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                />
              </div>

              <div>
                <label htmlFor={fieldId + '-19'} className="block text-xs font-medium text-text-muted mb-1">{c("Party Role *")}</label>
                <select id={fieldId + '-19'}
                  value={newPartyType}
                  onChange={(e) => setNewPartyType(e.target.value as PartyType)}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2 capitalize"
                >
                  <option value="customer">{c("Customer")}</option>
                  <option value="supplier">{c("Supplier")}</option>
                  <option value="employee">{c("Employee")}</option>
                  <option value="owner">{c("Owner / Partner")}</option>
                  <option value="lender">{c("Lender")}</option>
                  <option value="other">{c("Other")}</option>
                </select>
              </div>

              <div>
                <label htmlFor={fieldId + '-20'} className="block text-xs font-medium text-text-muted mb-1">{c("Phone (Optional)")}</label>
                <input id={fieldId + '-20'}
                  type="text"
                  placeholder="+91 ..."
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  className="w-full text-xs bg-surface-subtle border border-border-medium rounded-lg p-2"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPartyModalOpen(false)}
                  className="px-3 py-1.5 border border-border-medium rounded-lg text-xs"
                >
                  {c("Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-semibold"
                >
                  {c("Create")}
                </button>
              </div>
            </form>
          </div>
        </CashbookDialog>
      )}

      {/* ========================================================================= */}
      {/* View & Print Voucher Dialog */}
      {/* ========================================================================= */}
      {viewingVoucher && (
        <CashbookDialog label={c('View & Print Voucher')}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface-overlay  no-print overflow-y-auto"
        >
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)]">
            {errorNotice}
            <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-brand-emerald" />
                <h3 className="font-bold text-text-main text-sm sm:text-base">
                  {c("Voucher:")} {viewingVoucher.voucher_number}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Format Switcher */}
                <div className="flex bg-surface-subtle p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setVoucherPrintFormat('a4')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      voucherPrintFormat === 'a4'
                        ? 'bg-surface text-text-main shadow-xs'
                        : 'text-text-muted'
                    }`}
                  >
                    {c("A4 Voucher")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherPrintFormat('thermal80')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      voucherPrintFormat === 'thermal80'
                        ? 'bg-surface text-text-main shadow-xs'
                        : 'text-text-muted'
                    }`}
                  >
                    {c("80mm Thermal")}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handlePrint(viewingVoucher, voucherPrintFormat)}
                  data-testid="btn-print-voucher-dialog"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary-hover cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{c("Print")}</span>
                </button>

                <button aria-label={c('Close')}
                  onClick={() => setViewingVoucher(null)}
                  data-testid="btn-close-voucher-dialog"
                  className="p-1 text-text-muted hover:text-text-main rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Preview Area */}
            <div className="p-4 sm:p-6 overflow-auto bg-canvas min-h-0" dir="ltr">
              <div className="bg-white shadow-md rounded w-max mx-auto">
                <PrintableVoucherDocument voucher={viewingVoucher} format={voucherPrintFormat} isPrintTarget={false} />
              </div>
            </div>
          </div>
        </CashbookDialog>
      )}
    </div>
  );
};
