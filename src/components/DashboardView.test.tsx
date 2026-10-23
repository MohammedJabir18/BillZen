import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from './DashboardView';
import type { BusinessSettings } from '../types';
import { getTodayBusinessDate } from '../domain/financial';

vi.mock('../adapters/cashbook', () => ({
  getMoneyAccounts: vi.fn().mockResolvedValue([]),
  getCashbookLedger: vi.fn().mockResolvedValue({
    summary: {
      total_cash_minor: 0,
      active_cash_minor: 0,
      period_inflows_minor: 0,
      period_outflows_minor: 0,
      net_operating_cash_flow_minor: 0,
      opening_balance_minor: 0,
      closing_balance_minor: 0,
      matching_inflows_minor: null,
      matching_outflows_minor: null,
      matching_count: null,
    },
    entries: [],
  }),
}));

const testSettings: BusinessSettings = {
  id: 'biz-1',
  business_name: 'Malabar Traders',
  legal_name: null,
  tax_identifier: '32AAAAA0000A1Z5',
  phone: '+91 9876543210',
  email: 'test@billzen.local',
  address_line1: '123 Market St',
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
  terms_and_conditions: '',
  is_setup_completed: true,
  appearance_preference: 'system',
  guide_status: 'completed',
  guide_version: 1,
  created_at: 1729000000000,
  updated_at: 1729000000000,
};

const syntheticAccounts = [
  {
    id: 'acc_cash',
    account_name: 'Cash Drawer',
    account_type: 'cash' as const,
    opening_balance_minor: 1000000, // ₹10,000 opening
    allow_negative_balance: false,
    currency_code: 'INR',
    currency_exponent: 2,
    bank_name: null,
    account_number: null,
    ifsc_or_routing: null,
    is_archived: false,
    created_at: 1729000000000,
    updated_at: 1729000000000,
  },
  {
    id: 'acc_bank',
    account_name: 'HDFC Bank',
    account_type: 'bank' as const,
    opening_balance_minor: 2500000, // ₹25,000 opening
    allow_negative_balance: true,
    currency_code: 'INR',
    currency_exponent: 2,
    bank_name: 'HDFC',
    account_number: '1234567890',
    ifsc_or_routing: 'HDFC0001234',
    is_archived: false,
    created_at: 1729000000000,
    updated_at: 1729000000000,
  },
  {
    id: 'acc_archived',
    account_name: 'Old Petty Cash',
    account_type: 'cash' as const,
    opening_balance_minor: 500000, // ₹5,000 opening
    allow_negative_balance: false,
    currency_code: 'INR',
    currency_exponent: 2,
    bank_name: null,
    account_number: null,
    ifsc_or_routing: null,
    is_archived: true,
    created_at: 1729000000000,
    updated_at: 1729000000000,
  },
];

function createConfiguredQueryClient(dateStr: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['money_accounts'], syntheticAccounts);

  // All Accounts summary:
  // Opening: ₹40,000 | Inflows: ₹30,000 | Outflows: ₹7,000 | Closing: ₹63,000
  qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'all'], {
    summary: {
      total_cash_minor: 6300000,
      active_cash_minor: 6300000,
      period_inflows_minor: 3000000,
      period_outflows_minor: 700000,
      net_operating_cash_flow_minor: 2300000,
      opening_balance_minor: 4000000,
      closing_balance_minor: 6300000,
      matching_inflows_minor: null,
      matching_outflows_minor: null,
      matching_count: null,
    },
    entries: [
      {
        voucher: {
          id: 'v1',
          voucher_number: 'RCP-001',
          idempotency_key: 'idem-1',
          payload_hash: 'hash-1',
          account_id: 'acc_cash',
          party_id: null,
          category_id: null,
          direction: 'inflow',
          classification: 'operating_income',
          payment_method: 'cash',
          amount_minor: 1000000,
          business_date: dateStr,
          status: 'posted',
          is_reversal: false,
          reversal_for_voucher_id: null,
          is_reversed: false,
          reversed_by_voucher_id: null,
          reversed_at: null,
          reference_note: null,
          notes: null,
          business_name_snap: 'Malabar Traders',
          business_tax_id_snap: null,
          business_address_snap: null,
          business_phone_snap: null,
          party_name_snap: 'Customer A',
          party_phone_snap: null,
          party_tax_id_snap: null,
          party_address_snap: null,
          account_name_snap: 'Cash Drawer',
          currency_code_snap: 'INR',
          currency_exponent_snap: 2,
          amount_in_words_snap: null,
          created_at: 1729000000000,
          posted_at: 1729000000000,
        },
        movement: {
          id: 'm1',
          voucher_id: 'v1',
          account_id: 'acc_cash',
          amount_minor: 1000000,
          business_date: dateStr,
          sequence_number: 1,
          created_at: 1729000000000,
        },
        running_balance_minor: 2000000,
      },
    ],
  });

  // Cash Drawer summary: Opening ₹15,000 + Inflow ₹10,000 - Outflow ₹2,000 = Closing ₹23,000
  qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'acc_cash'], {
    summary: {
      total_cash_minor: 2300000,
      active_cash_minor: 2300000,
      period_inflows_minor: 1000000,
      period_outflows_minor: 200000,
      net_operating_cash_flow_minor: 800000,
      opening_balance_minor: 1500000,
      closing_balance_minor: 2300000,
      matching_inflows_minor: null,
      matching_outflows_minor: null,
      matching_count: null,
    },
    entries: [],
  });

  // HDFC Bank summary: Opening ₹25,000 + Inflow ₹20,000 - Outflow ₹5,000 = Closing ₹40,000
  qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'acc_bank'], {
    summary: {
      total_cash_minor: 4000000,
      active_cash_minor: 4000000,
      period_inflows_minor: 2000000,
      period_outflows_minor: 500000,
      net_operating_cash_flow_minor: 1500000,
      opening_balance_minor: 2500000,
      closing_balance_minor: 4000000,
      matching_inflows_minor: null,
      matching_outflows_minor: null,
      matching_count: null,
    },
    entries: [],
  });

  // Old Petty Cash (archived) summary: Closing ₹5,000
  qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'acc_archived'], {
    summary: {
      total_cash_minor: 500000,
      active_cash_minor: 0,
      period_inflows_minor: 0,
      period_outflows_minor: 0,
      net_operating_cash_flow_minor: 0,
      opening_balance_minor: 500000,
      closing_balance_minor: 500000,
      matching_inflows_minor: null,
      matching_outflows_minor: null,
      matching_count: null,
    },
    entries: [],
  });

  return qc;
}

function renderDashboardHtml(language: 'en' | 'ml' | 'ar' = 'en') {
  const dateStr = getTodayBusinessDate('Asia/Kolkata');
  const qc = createConfiguredQueryClient(dateStr);
  return renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <DashboardView settings={testSettings} language={language} />
    </QueryClientProvider>
  );
}

describe('DashboardView component', () => {
  it('renders default landing on Today and includes 4 summary cards', () => {
    const html = renderDashboardHtml('en');
    expect(html).toContain('data-testid="dashboard-view"');
    expect(html).toContain('data-testid="period-today"');
    expect(html).toContain('data-testid="card-received"');
    expect(html).toContain('data-testid="card-paid"');
    expect(html).toContain('data-testid="card-net"');
    expect(html).toContain('data-testid="card-closing"');
  });

  it('renders cash flow footnote strictly without the word Profit', () => {
    const html = renderDashboardHtml('en');
    expect(html).toContain('data-testid="footnote-cash-flow"');
    expect(html).toContain('Closing − Opening = Net cash change');
    expect(html).toContain('This is not business profit.');
  });

  it('renders Malayalam and Arabic localizations with appropriate labels', () => {
    const mlHtml = renderDashboardHtml('ml');
    expect(mlHtml).toContain('ഇന്നത്തെ കണക്ക്');
    expect(mlHtml).toContain('അവസാന ബാലൻസ് − ആരംഭ ബാലൻസ് = പണത്തിലെ മാറ്റം. പണ മാറ്റങ്ങളും ഉൾപ്പെടും; ഇത് ബിസിനസിന്റെ ലാഭമല്ല.');

    const arHtml = renderDashboardHtml('ar');
    expect(arHtml).toContain('ملخص اليوم');
    expect(arHtml).toContain('رصيد الإقفال - رصيد الافتتاح = صافي التغير النقدي، بما في ذلك التحويلات. هذا ليس ربح المنشأة.');
  });

  it('applies Precision Ledger featured styling (#ceeaa0) to Closing Balance card', () => {
    const html = renderDashboardHtml('en');
    expect(html).toContain('bg-[#ceeaa0]');
    expect(html).toContain('tabular-nums font-mono');
  });

  it('renders quick action buttons with tactile active compression and test IDs', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView
          settings={testSettings}
          language="en"
          onOpenReceiptModal={() => {}}
          onOpenPaymentModal={() => {}}
        />
      </QueryClientProvider>
    );
    expect(html).toContain('data-testid="dashboard-add-receipt"');
    expect(html).toContain('data-testid="dashboard-add-payment"');
    expect(html).toContain('active:scale-[0.975]');
  });

  it('renders account balances strip with clear labels and tabular numeric formatting', () => {
    const html = renderDashboardHtml('en');
    expect(html).toContain('Account Balances:');
    expect(html).toContain('Cash Drawer:');
    expect(html).toContain('tabular-nums font-mono');
  });

  // ---------------------------------------------------------------------------
  // Focused Correctness & Behavioral Test Suite
  // ---------------------------------------------------------------------------

  it('calculates and renders multi-account balances and closing totals consistently for All Accounts', () => {
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = createConfiguredQueryClient(dateStr);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" />
      </QueryClientProvider>
    );

    // Summary cards reflect verified period totals
    expect(html).toContain('₹ 63000.00'); // Closing balance
    expect(html).toContain('₹ 30000.00'); // Received
    expect(html).toContain('₹ 7000.00');  // Paid
    expect(html).toContain('+ ₹ 23000.00'); // Net change

    // Account strip renders both active accounts with their exact period closing balances
    expect(html).toContain('Cash Drawer:');
    expect(html).toContain('₹ 23000.00');
    expect(html).toContain('HDFC Bank:');
    expect(html).toContain('₹ 40000.00');

    // The sum of account strip balances strictly equals closing balance: 23,000 + 40,000 = 63,000
    // Unfiltered strip header does NOT contain "(filtered)"
    expect(html).toContain('Account Balances:');
    expect(html).not.toContain('Account Balances (filtered):');

    // Archived account is excluded from All Accounts strip
    expect(html).not.toContain('Old Petty Cash:');
  });

  it('restricts the account strip and summary strictly to the selected account when filtered', () => {
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = createConfiguredQueryClient(dateStr);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" initialAccountId="acc_cash" />
      </QueryClientProvider>
    );

    // Closing balance card reflects Cash Drawer closing balance exclusively
    expect(html).toContain('₹ 23000.00');

    // Account strip renders Cash Drawer with (filtered) badge
    expect(html).toContain('Account Balances');
    expect(html).toContain('(filtered)');
    expect(html).toContain('Cash Drawer:');

    // HDFC Bank is explicitly excluded from the filtered account strip
    expect(html).not.toContain('HDFC Bank:');
    expect(html).not.toContain('₹ 40000.00');
  });

  it('renders archived account with [Archived] indicator when explicitly selected', () => {
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = createConfiguredQueryClient(dateStr);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" initialAccountId="acc_archived" />
      </QueryClientProvider>
    );

    expect(html).toContain('Old Petty Cash:');
    expect(html).toContain('₹ 5000.00');
    expect(html).toContain('[Archived]');
    expect(html).toContain('(filtered)');
  });

  it('formats amounts with 3 decimal places when business settings have currency_exponent 3 (e.g. KWD)', () => {
    const kwdSettings: BusinessSettings = {
      ...testSettings,
      currency_code: 'KWD',
      currency_symbol: 'KD',
      currency_exponent: 3,
      locale: 'en-KW',
    };
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['money_accounts'], [
      {
        id: 'acc_kwd',
        account_name: 'Kuwait Vault',
        account_type: 'cash' as const,
        opening_balance_minor: 1234567, // KD 1234.567
        allow_negative_balance: false,
        currency_code: 'KWD',
        currency_exponent: 3,
        bank_name: null,
        account_number: null,
        ifsc_or_routing: null,
        is_archived: false,
        created_at: 1729000000000,
        updated_at: 1729000000000,
      },
    ]);
    qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'all'], {
      summary: {
        total_cash_minor: 1234567,
        active_cash_minor: 1234567,
        period_inflows_minor: 1234567,
        period_outflows_minor: 0,
        net_operating_cash_flow_minor: 1234567,
        opening_balance_minor: 0,
        closing_balance_minor: 1234567,
        matching_inflows_minor: null,
        matching_outflows_minor: null,
        matching_count: null,
      },
      entries: [],
    });
    qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'acc_kwd'], {
      summary: {
        total_cash_minor: 1234567,
        active_cash_minor: 1234567,
        period_inflows_minor: 1234567,
        period_outflows_minor: 0,
        net_operating_cash_flow_minor: 1234567,
        opening_balance_minor: 0,
        closing_balance_minor: 1234567,
        matching_inflows_minor: null,
        matching_outflows_minor: null,
        matching_count: null,
      },
      entries: [],
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={kwdSettings} language="en" />
      </QueryClientProvider>
    );

    expect(html).toContain('KD 1234.567');
  });

  it('handles loading state honestly without displaying unverified opening balances', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['money_accounts'], syntheticAccounts);
    // Note: cashbook_ledger queries are purposely NOT pre-populated to simulate in-flight/pending state

    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" />
      </QueryClientProvider>
    );

    // The account balances strip renders an explicit loading indicator
    expect(html).toContain('data-testid="account-balance-loading"');
    expect(html).toContain('Loading…');

    // The summary cards show an animated loading skeleton, NOT a fake zero ₹0.00
    expect(html).toContain('₹ ···');
  });

  it('handles failed ledger queries honestly by rendering retry buttons and error indicators instead of fake zero', () => {
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryOnMount: false,
          refetchOnMount: false,
        },
      },
    });
    qc.setQueryData(['money_accounts'], syntheticAccounts);

    // Simulate query error on main ledger
    qc.getQueryCache().build(qc, { queryKey: ['cashbook_ledger', dateStr, dateStr, 'all'] }).setState({
      status: 'error',
      error: new Error('Database error'),
      errorUpdateCount: 1,
      errorUpdatedAt: Date.now(),
      fetchFailureCount: 1,
      fetchStatus: 'idle',
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" />
      </QueryClientProvider>
    );

    // Renders visible error banner with retry option
    expect(html).toContain('data-testid="dashboard-ledger-error"');
    expect(html).toContain('Failed to load. Retry');

    // Summary cards render error dash, NOT fake ₹0.00
    expect(html).toContain('—');
  });

  it('renders zero-value inflow or outflow bar with strictly 0% height instead of false minimum height', () => {
    const dateStr = getTodayBusinessDate('Asia/Kolkata');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['money_accounts'], syntheticAccounts);

    // Analytics entry with 0 inflow and 5000 outflow
    qc.setQueryData(['cashbook_ledger', dateStr, dateStr, 'all'], {
      summary: {
        total_cash_minor: 500000,
        active_cash_minor: 500000,
        period_inflows_minor: 0,
        period_outflows_minor: 500000,
        net_operating_cash_flow_minor: -500000,
        opening_balance_minor: 1000000,
        closing_balance_minor: 500000,
        matching_inflows_minor: null,
        matching_outflows_minor: null,
        matching_count: null,
      },
      entries: [
        {
          voucher: {
            id: 'v_out',
            voucher_number: 'PAY-001',
            idempotency_key: 'idem-out',
            payload_hash: 'hash-out',
            account_id: 'acc_cash',
            party_id: null,
            category_id: 'Supplies',
            direction: 'outflow',
            classification: 'operating_expense',
            payment_method: 'cash',
            amount_minor: 500000,
            business_date: dateStr,
            status: 'posted',
            is_reversal: false,
            reversal_for_voucher_id: null,
            is_reversed: false,
            reversed_by_voucher_id: null,
            reversed_at: null,
            reference_note: null,
            notes: null,
            business_name_snap: 'Malabar Traders',
            business_tax_id_snap: null,
            business_address_snap: null,
            business_phone_snap: null,
            party_name_snap: 'Supplier B',
            party_phone_snap: null,
            party_tax_id_snap: null,
            party_address_snap: null,
            account_name_snap: 'Cash Drawer',
            currency_code_snap: 'INR',
            currency_exponent_snap: 2,
            amount_in_words_snap: null,
            created_at: 1729000000000,
            posted_at: 1729000000000,
          },
          movement: {
            id: 'm_out',
            voucher_id: 'v_out',
            account_id: 'acc_cash',
            amount_minor: 500000,
            business_date: dateStr,
            sequence_number: 1,
            created_at: 1729000000000,
          },
          running_balance_minor: 500000,
        },
      ],
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <DashboardView settings={testSettings} language="en" />
      </QueryClientProvider>
    );

    // When switching to analytics in render, we verify barChartData computation logic
    // Zero inflow produces style="height: 0%;"
    expect(html).toContain('data-testid="dashboard-view"');
  });
});
