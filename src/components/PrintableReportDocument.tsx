import React from 'react';
import type { ReportPrintData } from '../types/cashbook';
import { formatMinorUnits } from '../domain/financial';

export interface PrintableReportProps {
  reportData: ReportPrintData;
  isPrintTarget?: boolean;
}

export const PrintableReportDocument: React.FC<PrintableReportProps> = ({
  reportData,
  isPrintTarget = false,
}) => {
  const {
    summary,
    entries,
    periodTitle,
    dateRangeText,
    accountName,
    filterSummary,
    businessName = 'BillZen Retail',
    taxIdentifier,
    phone,
    currencyCode = 'INR',
    currencyExponent = 2,
    timezone = 'Asia/Kolkata',
    generatedAt,
  } = reportData;

  const netCashChange = summary.period_inflows_minor - summary.period_outflows_minor;

  return (
    <div
      id={isPrintTarget ? 'printable-report-root' : undefined}
      className="bg-white text-black p-8 max-w-[210mm] mx-auto text-xs leading-relaxed print:p-0 print:max-w-none print:w-full"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Report Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/brand/billzen-icon.svg"
              alt="BillZen"
              className="w-10 h-10 shrink-0"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                {businessName}
              </h1>
              {taxIdentifier && (
                <p className="text-xs text-slate-600 font-medium">Tax ID / GSTIN: {taxIdentifier}</p>
              )}
              {phone && <p className="text-xs text-slate-600">Tel: {phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block px-3 py-1 bg-slate-100 rounded text-xs font-bold uppercase tracking-wider text-slate-800 border border-slate-300">
              Cashbook Report
            </div>
            <p className="text-xs text-slate-500 mt-1">Currency: {currencyCode} ({currencyExponent} decimals)</p>
            <p className="text-xs text-slate-500">Timezone: {timezone}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs">
          <div>
            <span className="font-semibold text-slate-800">Period: </span>
            <span className="text-slate-700">{periodTitle} ({dateRangeText})</span>
            {accountName && (
              <span className="ml-3 font-semibold text-slate-800">
                • Account: <span className="font-normal text-slate-700">{accountName}</span>
              </span>
            )}
            {filterSummary && (
              <span className="ml-3 font-semibold text-slate-800">
                • Filter: <span className="font-normal text-slate-700">{filterSummary}</span>
              </span>
            )}
          </div>
          <div className="text-slate-500">
            Generated: {generatedAt || new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Financial Summary Box */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5 mb-6">
        <div className="text-[11px] font-bold uppercase text-slate-600 tracking-wider mb-2">
          Period Financial Summary
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-2 bg-white rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase font-medium">Opening Balance</div>
            <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
              {formatMinorUnits(summary.opening_balance_minor, currencyExponent)}
            </div>
          </div>
          <div className="p-2 bg-white rounded border border-slate-200">
            <div className="text-[10px] text-emerald-600 uppercase font-medium">Receipts (+)</div>
            <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
              +{formatMinorUnits(summary.period_inflows_minor, currencyExponent)}
            </div>
          </div>
          <div className="p-2 bg-white rounded border border-slate-200">
            <div className="text-[10px] text-rose-600 uppercase font-medium">Payments (−)</div>
            <div className="text-sm font-bold font-mono text-rose-700 mt-0.5">
              −{formatMinorUnits(summary.period_outflows_minor, currencyExponent)}
            </div>
          </div>
          <div className="p-2 bg-white rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase font-medium">Net Cash Change</div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${netCashChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netCashChange >= 0 ? '+' : ''}{formatMinorUnits(netCashChange, currencyExponent)}
            </div>
          </div>
          <div className="p-2 bg-emerald-50 rounded border border-emerald-300">
            <div className="text-[10px] text-emerald-800 uppercase font-bold">Closing Balance</div>
            <div className="text-sm font-bold font-mono text-emerald-900 mt-0.5">
              {formatMinorUnits(summary.closing_balance_minor, currencyExponent)}
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
          <span>Operating Cash Flow: {formatMinorUnits(summary.net_operating_cash_flow_minor, currencyExponent)}</span>
          <span>Total Records: {entries.length}</span>
        </div>
      </div>

      {/* Transactions Table */}
      <table className="w-full text-left border-collapse border border-slate-300 mb-6">
        <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300" style={{ display: 'table-header-group' }}>
          <tr>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase">Date</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase">Voucher #</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase">Party / Counterparty</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase">Category</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase">Account</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase text-right">Receipt (+)</th>
            <th className="py-2 px-2.5 border-r border-slate-300 text-[10px] uppercase text-right">Payment (−)</th>
            <th className="py-2 px-2.5 text-[10px] uppercase text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                No cashbook transactions found for this period and filter criteria.
              </td>
            </tr>
          ) : (
            entries.map((entry, index) => {
              const v = entry.voucher;
              const isInflow = v.direction === 'inflow';
              return (
                <tr
                  key={v.id || index}
                  className="hover:bg-slate-50"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                    {v.business_date}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap font-medium text-slate-900">
                    {v.voucher_number}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 text-[11px]">
                    <div className="font-medium text-slate-800">{v.party_name_snap || '—'}</div>
                    {(v.notes || v.reference_note) && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {v.notes || v.reference_note}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 text-[11px] text-slate-700">
                    {(v.category_id && reportData.categoryNames?.[v.category_id]) || v.category_id || '—'}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 text-[11px] text-slate-700 whitespace-nowrap">
                    {v.account_name_snap || '—'}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-[11px] text-right text-emerald-700 whitespace-nowrap font-medium">
                    {isInflow ? `+${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-200 font-mono text-[11px] text-right text-rose-700 whitespace-nowrap font-medium">
                    {!isInflow ? `−${formatMinorUnits(v.amount_minor, currencyExponent)}` : ''}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px] text-right whitespace-nowrap font-semibold text-slate-900">
                    {formatMinorUnits(entry.running_balance_minor, currencyExponent)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Footer / Document Disclaimer */}
      <div className="border-t border-slate-300 pt-3 flex justify-between items-center text-[10px] text-slate-500">
        <div>
          <span>Receipts − Payments = Net cash change. This is not business profit.</span>
        </div>
        <div>
          <span>BillZen Offline Accounting • Generated locally on device</span>
        </div>
      </div>
    </div>
  );
};
