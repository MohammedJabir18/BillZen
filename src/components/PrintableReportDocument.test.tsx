import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableReportDocument } from './PrintableReportDocument';
import type { ReportPrintData } from '../types/cashbook';

describe('PrintableReportDocument', () => {
  const dummyReportData: ReportPrintData = {
    businessName: 'Apex Traders',
    taxIdentifier: '32ABCDE1234F1Z5',
    phone: '+91 9876543210',
    currencyCode: 'INR',
    currencyExponent: 2,
    timezone: 'Asia/Kolkata',
    periodTitle: "Today's Summary",
    dateRangeText: '2026-10-20 to 2026-10-20',
    generatedAt: '2026-10-20 10:00:00',
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
          currency_code_snap: 'INR',
          account_id: 'acc1',
          account_name_snap: 'Main Cash',
          category_id: 'Sales',
          party_name_snap: 'Walk-in Customer',
          classification: 'operating_income',
          payment_method: 'cash',
          status: 'posted',
          created_at: 1000,
        } as unknown as import('../types/cashbook').CashbookVoucher,
        movement: {
          id: 'm1',
          voucher_id: 'v1',
          account_id: 'acc1',
          amount_minor: 25000,
          business_date: '2026-10-20',
          sequence_number: 1,
          created_at: 1000,
        },
        running_balance_minor: 35000,
      },
    ],
  };

  it('renders report document with header, summary cards, and table rows', () => {
    const html = renderToStaticMarkup(
      <PrintableReportDocument reportData={dummyReportData} isPrintTarget={true} />
    );

    expect(html).toContain('id="printable-report-root"');
    expect(html).toContain('Apex Traders');
    expect(html).toContain('32ABCDE1234F1Z5');
    expect(html).toContain('Today&#x27;s Summary');
    expect(html).toContain('100.00'); // Opening balance
    expect(html).toContain('+250.00'); // Receipts
    expect(html).toContain('−50.00'); // Payments
    expect(html).toContain('300.00'); // Closing balance
    expect(html).toContain('VCH-001');
    expect(html).toContain('Walk-in Customer');
    // Ensure "profit" is not used
    expect(html).toContain('This is not business profit.');
  });
});
