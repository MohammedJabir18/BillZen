import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsView } from './ReportsView';
import type { BusinessSettings } from '../types';

vi.mock('../adapters/cashbook', () => ({
  getMoneyAccounts: vi.fn().mockResolvedValue([
    { id: 'acc1', account_name: 'Cash Register', account_type: 'cash' },
  ]),
  getCashbookCategories: vi.fn().mockResolvedValue([
    { id: 'cat1', name: 'General Sales', category_type: 'income' },
  ]),
  getCashbookLedger: vi.fn().mockResolvedValue({
    summary: {
      total_cash_minor: 30000,
      active_cash_minor: 30000,
      opening_balance_minor: 10000,
      period_inflows_minor: 25000,
      period_outflows_minor: 5000,
      closing_balance_minor: 30000,
      net_operating_cash_flow_minor: 20000,
      matching_inflows_minor: 0,
      matching_outflows_minor: 0,
      matching_count: 0,
    },
    entries: [
      {
        voucher: {
          id: 'v1',
          voucher_number: 'VCH-001',
          business_date: '2026-10-20',
          direction: 'inflow',
          amount_minor: 25000,
          currency: 'INR',
          account_id: 'acc1',
          account_name_snap: 'Cash Register',
          category_id: 'General Sales',
          party_name_snap: 'Retail Buyer',
          classification: 'operating_income',
          payment_method: 'cash',
          status: 'posted',
          created_at: 1000,
        },
        running_balance_minor: 35000,
      },
    ],
  }),
}));

describe('ReportsView', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const dummySettings: BusinessSettings = {
    id: 'default',
    business_name: 'SuperStore Retail',
    currency_code: 'INR',
    currency_symbol: '₹',
    currency_exponent: 2,
    timezone: 'Asia/Kolkata',
  } as BusinessSettings;

  it('renders period switch, export buttons, and summary bar', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ReportsView settings={dummySettings} language="en" />
      </QueryClientProvider>
    );

    expect(html).toContain('data-testid="report-period-today"');
    expect(html).toContain('data-testid="report-period-month"');
    expect(html).toContain('data-testid="report-period-year"');
    expect(html).toContain('data-testid="report-period-custom"');
    expect(html).toContain('data-testid="btn-print-report"');
    expect(html).toContain('data-testid="btn-export-csv"');
    expect(html).toContain('data-testid="report-search-input"');
    expect(html).toContain('data-testid="report-opening-balance"');
    expect(html).toContain('data-testid="report-closing-balance"');
  });
});

it('waits for category labels before enabling a ready ledger export', async () => {
  const { getTodayBusinessDate } = await import('../domain/financial');
  const date = getTodayBusinessDate('Asia/Kolkata');
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['money_accounts'], []);
  client.setQueryData(['cashbook_ledger', { account_id: null, start_date: date, end_date: date, search: null, classification: null, include_archived: false }], {
    summary: { total_cash_minor: 100, active_cash_minor: 100, opening_balance_minor: 0, period_inflows_minor: 100, period_outflows_minor: 0, closing_balance_minor: 100, net_operating_cash_flow_minor: 100 }, entries: [],
  });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><ReportsView settings={{ currency_exponent: 2, currency_symbol: '₹', timezone: 'Asia/Kolkata' } as BusinessSettings} language="en" /></QueryClientProvider>);
  const exportButton = html.match(/<button\b[^>]*data-testid="btn-export-csv"[^>]*>/)?.[0];
  expect(exportButton).toContain('disabled');
  client.setQueryData(['cashbook_categories'], []);
  const readyHtml = renderToStaticMarkup(<QueryClientProvider client={client}><ReportsView settings={{ currency_exponent: 2, currency_symbol: '₹', timezone: 'Asia/Kolkata' } as BusinessSettings} language="en" /></QueryClientProvider>);
  expect(readyHtml.match(/<button\b[^>]*data-testid="btn-export-csv"[^>]*>/)?.[0]).not.toContain('disabled');
  client.clear();
});
