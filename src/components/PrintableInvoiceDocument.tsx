import React from 'react';
import type { InvoiceDTO } from '../types';
import {
  CalculatedInvoiceViewModel,
  createInvoiceViewModel,
  SAMPLE_TWO_LINE_INVOICE_DTO,
} from '../domain/invoice_view_model';

export interface PrintableInvoiceProps {
  invoice?: CalculatedInvoiceViewModel | InvoiceDTO;
}

export const PrintableInvoiceDocument: React.FC<PrintableInvoiceProps> = ({
  invoice,
}) => {
  const vm: CalculatedInvoiceViewModel = React.useMemo(() => {
    if (!invoice) {
      return createInvoiceViewModel(SAMPLE_TWO_LINE_INVOICE_DTO);
    }
    // If already a CalculatedInvoiceViewModel
    if ('rawTotals' in invoice) {
      return invoice as CalculatedInvoiceViewModel;
    }
    // Else compute from InvoiceDTO
    return createInvoiceViewModel(invoice as InvoiceDTO);
  }, [invoice]);

  return (
    <div
      id="printable-invoice-root"
      className="bg-white text-gray-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto text-xs leading-relaxed"
    >
      {/* Sample Banner if marked as sample */}
      {vm.isSample && (
        <div className="mb-4 py-1.5 px-3 bg-amber-50 border border-amber-300 text-amber-900 font-bold uppercase tracking-wider text-center text-[10px] rounded">
          SAMPLE / DRAFT TAX INVOICE — FOR FEASIBILITY TESTING ONLY — NOT A LEGAL TAX INVOICE
        </div>
      )}

      {/* Header: Business & Document Metadata */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">TAX INVOICE</h1>
          <h2 className="text-sm font-semibold text-gray-800 mt-1">{vm.businessName}</h2>
          {vm.businessLegalName && (
            <p className="text-gray-500 text-[11px]">{vm.businessLegalName}</p>
          )}
          <p className="text-gray-600 mt-0.5">{vm.businessAddress}</p>
          <p className="text-gray-600 mt-0.5">
            <strong>{vm.taxIdLabel}:</strong> <bdi className="font-mono">{vm.businessTaxId}</bdi> | <strong>Tel:</strong> <bdi>{vm.businessPhone}</bdi>
          </p>
        </div>
        <div className="text-end text-right">
          <div className="inline-block px-2.5 py-1 bg-gray-100 border border-gray-300 font-bold text-gray-800 text-[11px] rounded mb-1">
            {vm.isSample ? 'SAMPLE' : 'ORIGINAL'}
          </div>
          <p className="font-mono text-gray-700">
            <strong>Invoice #:</strong> <bdi className="font-semibold text-gray-900">{vm.invoiceNumber}</bdi>
          </p>
          <p className="text-gray-600 mt-0.5">
            <strong>Date:</strong> <bdi>{vm.date}</bdi>
          </p>
        </div>
      </div>

      {/* Customer Information */}
      <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
        <div>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Billed To (ഉപഭോക്താവ്):</span>
          <p className="font-semibold text-gray-800 text-sm mt-0.5">{vm.customerName}</p>
          <p className="text-gray-600">{vm.customerAddress}</p>
          <p className="text-gray-600">
            <strong>{vm.taxIdLabel}:</strong> <bdi className="font-mono">{vm.customerTaxId}</bdi>
          </p>
        </div>
        <div className="text-end text-right">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Payment & Terms:</span>
          <p className="font-semibold text-emerald-700 mt-0.5">{vm.settlementStatusText}</p>
          <p className="text-gray-600">Currency: {vm.currencySymbol} ({vm.currencyCode})</p>
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full text-left text-xs mt-4 border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 text-gray-700 font-semibold uppercase text-[10px]">
            <th className="py-2 text-start">#</th>
            <th className="py-2 text-start">Item Description / വിവരണം</th>
            <th className="py-2 text-end text-right">Qty</th>
            <th className="py-2 text-end text-right">Unit Price</th>
            <th className="py-2 text-end text-right">Disc</th>
            <th className="py-2 text-end text-right">Tax%</th>
            <th className="py-2 text-end text-right">{vm.itemTaxHeader}</th>
            <th className="py-2 text-end text-right">{vm.itemTotalHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {vm.items.map((item, index) => (
            <tr key={item.id} className="align-top">
              <td className="py-2.5 text-gray-500 font-mono text-[10px]">{index + 1}</td>
              <td className="py-2.5">
                <div className="font-semibold text-gray-900">{item.name}</div>
                {item.nameMalayalam && (
                  <div className="text-[10px] text-gray-600">{item.nameMalayalam}</div>
                )}
                {item.nameArabic && (
                  <div className="text-[10px] text-gray-600" dir="rtl">
                    <bdi>{item.nameArabic}</bdi>
                  </div>
                )}
                <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                  SKU: {item.sku} | HSN: {item.hsn}
                </div>
              </td>
              <td className="py-2.5 text-end text-right font-mono tabular-nums">
                {item.quantityFormatted} {item.unit}
              </td>
              <td className="py-2.5 text-end text-right font-mono tabular-nums">{item.unitPriceFormatted}</td>
              <td className="py-2.5 text-end text-right font-mono tabular-nums text-gray-600">
                {item.discountFormatted}
              </td>
              <td className="py-2.5 text-end text-right font-mono tabular-nums">{item.taxRatePercent}</td>
              <td className="py-2.5 text-end text-right font-mono tabular-nums">{item.taxAmountFormatted}</td>
              <td className="py-2.5 text-end text-right font-mono font-semibold text-gray-900 tabular-nums">
                {item.lineTotalFormatted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Totals & Footnotes */}
      <div className="border-t-2 border-gray-800 pt-4 mt-6">
        <div className="flex justify-between items-start">
          <div className="max-w-xs space-y-2">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Notes & Terms:</span>
              <p className="text-gray-600 text-[11px] mt-0.5">{vm.notes}</p>
            </div>
            <div className="pt-2 text-[10px] text-gray-400">
              Generated by BillZen Offline Desktop System.
            </div>
          </div>

          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-700">
              <span>Gross Subtotal:</span>
              <span className="font-mono tabular-nums">{vm.subtotalGrossFormatted}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Total Discounts:</span>
              <span className="font-mono tabular-nums">-{vm.discountTotalFormatted}</span>
            </div>
            <div className="flex justify-between text-gray-700 font-medium">
              <span>Taxable Subtotal:</span>
              <span className="font-mono tabular-nums">{vm.taxableSubtotalFormatted}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>{vm.taxLabel}:</span>
              <span className="font-mono tabular-nums">{vm.taxTotalFormatted}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-sm border-t-2 border-gray-900 pt-2 mt-2">
              <span>Grand Total:</span>
              <span className="font-mono tabular-nums">{vm.grandTotalFormatted}</span>
            </div>
          </div>
        </div>

        {/* Signature Line */}
        <div className="mt-12 flex justify-between items-end text-xs text-gray-500 pt-4 border-t border-dashed border-gray-300">
          <div>Customer Signature</div>
          <div className="text-end text-right">
            For {vm.businessName}
            <br />
            <br />
            <span className="text-gray-400">(Authorized Signatory)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
