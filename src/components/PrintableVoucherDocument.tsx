import React from 'react';
import type { CashbookVoucher } from '../types/cashbook';
import { formatMinorUnits } from '../domain/financial';
import { minorUnitsToWords } from '../domain/number_to_words';

export interface PrintableVoucherProps {
  voucher: CashbookVoucher;
  format?: 'a4' | 'thermal80';
  isPrintTarget?: boolean;
}

export const PrintableVoucherDocument: React.FC<PrintableVoucherProps> = ({
  voucher,
  format = 'a4',
  isPrintTarget = false,
}) => {
  const currencyCode = voucher.currency_code_snap || 'INR';
  const currencyExponent = voucher.currency_exponent_snap ?? 2;
  const formattedAmount = formatMinorUnits(voucher.amount_minor, currencyExponent);
  const amountWords = minorUnitsToWords(voucher.amount_minor, currencyCode, currencyExponent);

  const voucherTitle = React.useMemo(() => {
    if (voucher.is_reversal) {
      return voucher.direction === 'inflow'
        ? 'PAYMENT REVERSAL VOUCHER'
        : 'RECEIPT REVERSAL VOUCHER';
    }
    return voucher.direction === 'inflow' ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';
  }, [voucher.is_reversal, voucher.direction]);

  const paymentMethodLabel = React.useMemo(() => {
    switch (voucher.payment_method) {
      case 'cash':
        return 'Cash';
      case 'upi':
        return 'UPI / QR';
      case 'card':
        return 'Debit / Credit Card';
      case 'bank_transfer':
        return 'Bank Transfer (NEFT/RTGS/IMPS)';
      case 'cheque':
        return 'Cheque';
      default:
        return 'Other';
    }
  }, [voucher.payment_method]);

  const classificationLabel = React.useMemo(() => {
    return voucher.classification
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }, [voucher.classification]);

  if (format === 'thermal80') {
    return (
      <div
        id={isPrintTarget ? 'printable-voucher-root' : undefined}
        className="bg-white text-black font-mono p-4 max-w-[80mm] mx-auto text-[11px] leading-tight"
      >
        <div className="text-center pb-2 border-b border-dashed border-black">
          <div className="flex justify-center mb-1">
            <img src="/brand/billzen-icon.svg" alt="BillZen" className="w-8 h-8" />
          </div>
          <h1 className="text-sm font-bold uppercase">{voucher.business_name_snap || 'BillZen Cashbook'}</h1>
          {voucher.business_tax_id_snap && (
            <p className="text-[10px]">Tax ID: {voucher.business_tax_id_snap}</p>
          )}
          {voucher.business_phone_snap && (
            <p className="text-[10px]">Tel: {voucher.business_phone_snap}</p>
          )}
        </div>

        <div className="text-center py-2 border-b border-dashed border-black">
          <h2 className="text-xs font-bold uppercase tracking-wider">{voucherTitle}</h2>
          {voucher.is_reversed && (
            <div className="text-center font-bold text-red-600 border border-red-600 my-1 py-0.5">
              *** VOID / REVERSED ***
            </div>
          )}
        </div>

        <div className="py-2 border-b border-dashed border-black space-y-1">
          <div className="flex justify-between">
            <span>Voucher #:</span>
            <span className="font-bold">{voucher.voucher_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{voucher.business_date}</span>
          </div>
          <div className="flex justify-between">
            <span>Account:</span>
            <span>{voucher.account_name_snap}</span>
          </div>
          {voucher.party_name_snap && (
            <div className="flex justify-between">
              <span>Party:</span>
              <span className="font-semibold">{voucher.party_name_snap}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Method:</span>
            <span>{paymentMethodLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Category/Class:</span>
            <span>{classificationLabel}</span>
          </div>
          {voucher.reference_note && (
            <div className="flex justify-between">
              <span>Ref #:</span>
              <span>{voucher.reference_note}</span>
            </div>
          )}
        </div>

        <div className="py-2.5 border-b border-dashed border-black">
          <div className="flex justify-between items-baseline text-sm font-bold">
            <span>TOTAL AMOUNT:</span>
            <span>{currencyCode} {formattedAmount}</span>
          </div>
          <p className="text-[9px] italic mt-1 text-gray-700">{amountWords}</p>
        </div>

        {voucher.notes && (
          <div className="py-2 border-b border-dashed border-black text-[10px]">
            <span className="font-bold">Notes: </span>
            <span>{voucher.notes}</span>
          </div>
        )}

        {voucher.is_reversal && voucher.reversal_for_voucher_id && (
          <div className="py-1 text-[9px] border-b border-dashed border-black">
            Reversal for Voucher ID: {voucher.reversal_for_voucher_id}
          </div>
        )}

        <div className="pt-8 pb-2 flex justify-between text-center text-[9px]">
          <div>
            <div className="w-20 border-t border-black mb-1" />
            <span>Prepared By</span>
          </div>
          <div>
            <div className="w-24 border-t border-black mb-1" />
            <span>Receiver / Auth</span>
          </div>
        </div>
      </div>
    );
  }

  // A4 Standard Voucher Layout
  return (
    <div
      id={isPrintTarget ? 'printable-voucher-root' : undefined}
      className="bg-white text-gray-900 font-sans p-8 sm:p-12 max-w-[210mm] mx-auto text-xs leading-relaxed border border-gray-200"
    >
      {/* Top Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-5">
        <div className="flex items-center gap-3">
          <img src="/brand/billzen-icon.svg" alt="BillZen Logo" className="w-12 h-12" />
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">
              {voucher.business_name_snap || 'BillZen Cashbook'}
            </h1>
            {voucher.business_address_snap && (
              <p className="text-gray-600 mt-0.5">{voucher.business_address_snap}</p>
            )}
            <p className="text-gray-600 mt-0.5">
              {voucher.business_tax_id_snap && (
                <>
                  <strong>Tax ID:</strong> <bdi className="font-mono">{voucher.business_tax_id_snap}</bdi>{' '}
                </>
              )}
              {voucher.business_phone_snap && (
                <>
                  | <strong>Tel:</strong> <bdi>{voucher.business_phone_snap}</bdi>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="text-end text-right">
          <div className={`inline-block px-3 py-1 font-bold text-xs uppercase rounded mb-2 ${
            voucher.is_reversal
              ? 'bg-purple-100 text-purple-900 border border-purple-300'
              : voucher.direction === 'inflow'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}>
            {voucherTitle}
          </div>
          <p className="font-mono text-gray-800 text-sm">
            <strong>Voucher #:</strong> <bdi className="font-bold text-gray-900">{voucher.voucher_number}</bdi>
          </p>
          <p className="text-gray-600 mt-1">
            <strong>Business Date:</strong> <bdi>{voucher.business_date}</bdi>
          </p>
        </div>
      </div>

      {/* Void Banner if reversed */}
      {voucher.is_reversed && (
        <div className="my-4 py-2 px-4 bg-red-50 border-2 border-red-600 text-red-800 font-bold uppercase tracking-widest text-center text-sm rounded">
          *** VOID — REVERSED VOUCHER (REF: {voucher.reversed_by_voucher_id}) ***
        </div>
      )}

      {/* Party & Financial Metadata Grid */}
      <div className="grid grid-cols-2 gap-6 my-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            {voucher.direction === 'inflow' ? 'Received From (Payer)' : 'Paid To (Payee)'}
          </h2>
          {voucher.party_name_snap ? (
            <div>
              <p className="text-sm font-bold text-gray-900">{voucher.party_name_snap}</p>
              {voucher.party_phone_snap && (
                <p className="text-gray-600 text-[11px] mt-0.5">Phone: {voucher.party_phone_snap}</p>
              )}
              {voucher.party_address_snap && (
                <p className="text-gray-600 text-[11px] mt-0.5">{voucher.party_address_snap}</p>
              )}
              {voucher.party_tax_id_snap && (
                <p className="text-gray-600 text-[11px] mt-0.5">Tax ID: {voucher.party_tax_id_snap}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Direct Counter Party / Ad-hoc</p>
          )}
        </div>

        <div>
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            Payment & Account Particulars
          </h2>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">Account:</td>
                <td className="py-0.5 text-right font-bold text-gray-900">{voucher.account_name_snap}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">Payment Method:</td>
                <td className="py-0.5 text-right text-gray-800">{paymentMethodLabel}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-600 font-medium">Classification:</td>
                <td className="py-0.5 text-right text-gray-800">{classificationLabel}</td>
              </tr>
              {voucher.reference_note && (
                <tr>
                  <td className="py-0.5 text-gray-600 font-medium">Reference / Cheque #:</td>
                  <td className="py-0.5 text-right font-mono text-gray-900">{voucher.reference_note}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Financial Amount Display */}
      <div className="border border-gray-300 rounded-lg overflow-hidden my-6">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex justify-between items-center font-bold text-gray-700">
          <span>DESCRIPTION / PARTICULAR</span>
          <span>AMOUNT ({currencyCode})</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {voucher.direction === 'inflow' ? 'Cash/Bank Receipt' : 'Cash/Bank Payment'} — {classificationLabel}
            </p>
            {voucher.notes && <p className="text-gray-600 text-xs mt-1">{voucher.notes}</p>}
            {voucher.is_reversal && (
              <p className="text-purple-700 text-xs mt-1 font-medium">
                * Equal and opposite movement reversing original voucher.
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-xl font-bold font-mono text-gray-900">
              {currencyCode} {formattedAmount}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-t border-gray-200">
          <p className="text-xs text-gray-700">
            <strong>Amount in Words:</strong> <span className="italic">{amountWords}</span>
          </p>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="pt-16 mt-12 border-t border-gray-300 flex justify-between items-end text-center text-xs">
        <div>
          <div className="w-48 border-t border-gray-900 mb-1.5" />
          <p className="font-semibold text-gray-800">Prepared By</p>
          <p className="text-gray-500 text-[10px]">Cashier / Accountant</p>
        </div>
        <div>
          <div className="w-56 border-t border-gray-900 mb-1.5" />
          <p className="font-semibold text-gray-800">Received / Authorized Signatory</p>
          <p className="text-gray-500 text-[10px]">Company Stamp / Payee</p>
        </div>
      </div>

      <div className="mt-8 pt-2 border-t border-slate-100 text-[10px] text-gray-400 text-center">
        Generated by BillZen Offline Company Cashbook • Frozen snapshot verified
      </div>
    </div>
  );
};
