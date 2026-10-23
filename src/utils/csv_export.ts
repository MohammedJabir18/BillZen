import type { CashbookLedgerEntry, CashbookSummary } from '../types/cashbook';
import type { BusinessSettings } from '../types';
import { formatMinorUnits } from '../domain/financial';

export interface CsvExportOptions {
  settings: BusinessSettings;
  summary: CashbookSummary;
  entries: CashbookLedgerEntry[];
  startDate?: string;
  endDate?: string;
  accountName?: string;
  filterSummary?: string;
  categoryNames?: Record<string, string>;
}

/**
 * Sanitizes cell values to defend against CSV Formula Injection (CWE-1236).
 * If a cell string begins with =, +, -, @, \t, or \r, it is prepended with a single quote (').
 * Cells containing commas, double quotes, or newlines are quoted, with internal quotes escaped as "".
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Check for formula injection prefix
  const firstChar = str.charAt(0);
  if (
    firstChar === '=' ||
    firstChar === '+' ||
    firstChar === '-' ||
    firstChar === '@' ||
    firstChar === '\t' ||
    firstChar === '\r'
  ) {
    str = `'${str}`;
  }

  // Escape quotes and quote if needed
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180-compliant, formula-injection-safe CSV document representing
 * the complete selected dataset of cashbook transactions.
 */
export function exportTransactionsToCsv(options: CsvExportOptions): string {
  const { settings, summary, entries, startDate, endDate, accountName, filterSummary } = options;
  const exp = settings.currency_exponent ?? 2;
  const curr = settings.currency_code ?? 'INR';

  const rows: string[] = [];

  // Metadata / Header Block
  rows.push(`${sanitizeCsvCell('BillZen Company Cashbook Report')},${sanitizeCsvCell(settings.business_name || '')}`);
  if (settings.tax_identifier) {
    rows.push(`${sanitizeCsvCell('Tax ID')},${sanitizeCsvCell(settings.tax_identifier)}`);
  }
  rows.push(`${sanitizeCsvCell('Currency')},${sanitizeCsvCell(curr)}`);
  rows.push(`${sanitizeCsvCell('Timezone')},${sanitizeCsvCell(settings.timezone || 'Asia/Kolkata')}`);
  rows.push(`${sanitizeCsvCell('Date Range')},${sanitizeCsvCell(`${startDate || 'All Time'} to ${endDate || 'Present'}`)}`);
  if (accountName) {
    rows.push(`${sanitizeCsvCell('Account')},${sanitizeCsvCell(accountName)}`);
  }
  if (filterSummary) {
    rows.push(`${sanitizeCsvCell('Filter Applied')},${sanitizeCsvCell(filterSummary)}`);
  }
  rows.push(''); // Blank separator line

  // Financial Summary Block
  rows.push(`${sanitizeCsvCell('FINANCIAL SUMMARY')}`);
  rows.push(`${sanitizeCsvCell('Opening Balance')},${sanitizeCsvCell(formatMinorUnits(summary.opening_balance_minor, exp))}`);
  rows.push(`${sanitizeCsvCell('Total Receipts (Inflows)')},${sanitizeCsvCell(formatMinorUnits(summary.period_inflows_minor, exp))}`);
  rows.push(`${sanitizeCsvCell('Total Payments (Outflows)')},${sanitizeCsvCell(formatMinorUnits(summary.period_outflows_minor, exp))}`);
  const net = summary.closing_balance_minor - summary.opening_balance_minor;
  rows.push(`${sanitizeCsvCell('Net Cash Change')},${sanitizeCsvCell(formatMinorUnits(net, exp))}`);
  rows.push(`${sanitizeCsvCell('Closing Balance')},${sanitizeCsvCell(formatMinorUnits(summary.closing_balance_minor, exp))}`);
  rows.push(`${sanitizeCsvCell('Total Transactions')},${sanitizeCsvCell(entries.length)}`);
  rows.push(''); // Blank separator line

  // Column Headers
  const columns = [
    'Date',
    'Voucher Number',
    'Party / Counterparty',
    'Category',
    'Account',
    'Classification',
    'Payment Method',
    'Direction',
    'Receipt (+)',
    'Payment (-)',
    'Running Balance',
    'Reference / Notes',
    'Transfer In',
    'Transfer Out',
    'Transfer Number',
  ];
  rows.push(columns.map(sanitizeCsvCell).join(','));

  // Transaction Rows
  for (const entry of entries) {
    const v = entry.voucher;
    const transfer = v.classification === 'transfer';
    const isInflow = v.direction === 'inflow';
    const inflowStr = isInflow && !transfer ? formatMinorUnits(v.amount_minor, exp) : '';
    const outflowStr = !isInflow && !transfer ? formatMinorUnits(v.amount_minor, exp) : '';

    const row = [
      v.business_date,
      v.voucher_number,
      v.party_name_snap || '',
      (v.category_id && options.categoryNames?.[v.category_id]) || v.category_id || '',
      v.account_name_snap || '',
      v.classification,
      v.payment_method,
      v.direction,
      inflowStr,
      outflowStr,
      formatMinorUnits(entry.running_balance_minor, exp),
      v.notes || v.reference_note || '',
      transfer && isInflow ? formatMinorUnits(v.amount_minor, exp) : '',
      transfer && !isInflow ? formatMinorUnits(v.amount_minor, exp) : '',
      transfer ? v.voucher_number.replace(/-(IN|OUT)$/, '') : '',
    ];

    rows.push(row.map(sanitizeCsvCell).join(','));
  }

  return rows.join('\r\n');
}
