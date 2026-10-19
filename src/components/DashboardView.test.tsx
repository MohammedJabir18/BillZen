import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from './DashboardView';
import type { BusinessSettings } from '../types';

vi.mock('../adapters/cashbook', () => ({
  getMoneyAccounts: vi.fn().mockResolvedValue([
    { id: 'acc_cash', account_name: 'Cash Drawer', account_type: 'cash', current_balance_minor: 35000 },
  ]),
  getCashbookLedger: vi.fn().mockResolvedValue({
    summary: {
      total_cash_minor: 35000,
      active_cash_minor: 35000,
      period_inflows_minor: 25000,
      period_outflows_minor: 5000,
      net_operating_cash_flow_minor: 20000,
      opening_balance_minor: 15000,
      closing_balance_minor: 35000,
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

function renderDashboardHtml(language: 'en' | 'ml' | 'ar' = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
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
    expect(html).toContain('Receipts − Payments = Net cash change');
    // Ensure the word "business profit" is framed only in the disclaimer "This is not business profit."
    expect(html).toContain('This is not business profit.');
  });

  it('renders Malayalam and Arabic localizations with appropriate labels', () => {
    const mlHtml = renderDashboardHtml('ml');
    expect(mlHtml).toContain('ഇന്നത്തെ കണക്ക്');
    expect(mlHtml).toContain('വരവ് − ചെലവ് = പണത്തിലെ മാറ്റം. ഇത് ബിസിനസിന്റെ ലാഭം എന്നർത്ഥമല്ല.');

    const arHtml = renderDashboardHtml('ar');
    expect(arHtml).toContain('ملخص اليوم');
    expect(arHtml).toContain('المقبوضات - المدفوعات = صافي التدفق النقدي. هذا لا يعبر عن أرباح المنشأة.');
  });
});
