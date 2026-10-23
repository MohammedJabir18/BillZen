import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BusinessSettings, Customer } from '../types';
import type { CustomerReceiptIntent, CustomerReportFilter } from '../types/cashbook';
import type { Language } from '../i18n';
import { customerCashText } from '../i18n/customer_cashbook';
import { getCashbookParties, getMoneyAccounts } from '../adapters/cashbook';
import { customerPartyError, ensureCustomerCashbookParty, getCustomerCashHistory } from '../adapters/customer_cashbook';
import { getTodayBusinessDate, formatMinorUnits } from '../domain/financial';
import { CashbookDialog } from './CashbookDialog';
import { useBackHandler } from '../hooks/useBackHandler';

export function CustomerCashHistory({ customer, settings, language, onClose, onReceive, onReport }: {
  customer: Customer; settings: BusinessSettings; language: Language; onClose: () => void;
  onReceive?: (intent: CustomerReceiptIntent) => void;
  onReport?: (partyId: string, filter?: CustomerReportFilter) => void;
}) {
  const text = (key: Parameters<typeof customerCashText>[1]) => customerCashText(language, key);
  const client = useQueryClient();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [account, setAccount] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validRange = !start || !end || start <= end;
  const filter = { customer_id: customer.id, start_date: start || undefined, end_date: end || undefined, account_id: account || undefined };
  const history = useQuery({ queryKey: ['customer_cash_history', filter], queryFn: () => getCustomerCashHistory(filter), enabled: validRange });
  const parties = useQuery({ queryKey: ['cashbook_parties'], queryFn: getCashbookParties });
  const accounts = useQuery({ queryKey: ['cashbook_accounts'], queryFn: getMoneyAccounts });
  useBackHandler(true, onClose);
  const money = (minor: number) => `${settings.currency_symbol} ${formatMinorUnits(minor, settings.currency_exponent)}`;
  const unavailable = !validRange || history.isPending || history.isFetching || history.isError;
  const reportFilter = (): CustomerReportFilter => {
    const dates = history.data?.entries.map(entry => entry.movement.business_date).sort() ?? [];
    const today = getTodayBusinessDate(settings.timezone);
    return { start_date: start || dates[0] || end || today, end_date: end || dates.at(-1) || start || today, account_id: account || undefined };
  };
  const ensureParty = async (receive: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const party = await ensureCustomerCashbookParty({ customer_id: customer.id, existing_party_id: selectedParty || undefined });
      await client.invalidateQueries({ queryKey: ['cashbook_parties'] });
      await client.invalidateQueries({ queryKey: ['customer_cash_history'] });
      setSelectedParty(party.id);
      if (receive) onReceive?.({ customer_id: customer.id, party_id: party.id });
    } catch (cause) {
      const detail = customerPartyError(cause);
      setError(detail.code === 'PARTY_SELECTION_REQUIRED' ? text('selection') : detail.message);
    } finally { setBusy(false); }
  };
  const control = 'min-h-[44px] rounded-lg border border-border-medium bg-surface text-text-main px-3 py-2 max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus';
  return <CashbookDialog label={`${text('history')} — ${customer.name}`} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6">
    <section data-testid="customer-cash-history" dir={language === 'ar' ? 'rtl' : 'ltr'} className="bg-surface text-text-main border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-start justify-between gap-3"><h2 className="font-bold text-xl break-words min-w-0">{customer.name} — {text('history')}</h2><button className={control} onClick={onClose}>{text('close')}</button></header>
      <p className="text-sm text-text-muted">{text('notice')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm">{text('start')}<input className={`${control} block w-full`} type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="text-sm">{text('end')}<input className={`${control} block w-full`} type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label className="text-sm">{text('allAccounts')}<select className={`${control} block w-full`} value={account} onChange={e => setAccount(e.target.value)}><option value="">{text('allAccounts')}</option>{accounts.data?.map(item => <option key={item.id} value={item.id}>{item.account_name}{item.is_archived ? ` (${text('archived')})` : ''}</option>)}</select></label>
      </div>
      {!validRange && <p role="alert">{text('invalidRange')}</p>}
      {history.isError && <p role="alert">{customerPartyError(history.error).message} <button className={control} onClick={() => history.refetch()}>{text('retry')}</button></p>}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">{([
        ['received', 'received_minor'], ['paid', 'paid_minor'], ['net', 'net_movement_minor'],
      ] as const).map(([label, field]) => <div key={field} className="p-3 bg-surface-subtle rounded-xl min-w-0"><dt className="text-sm text-text-muted">{text(label)}</dt><dd data-testid={label === 'net' ? 'customer-net-movement' : `customer-cash-${label}`} className="font-bold tabular-nums break-words">{unavailable ? '—' : money(history.data?.[field] ?? 0)}</dd></div>)}</dl>
      {customer.is_active && <div className="space-y-3 border-y border-border-subtle py-3">
        <label className="block text-sm">{text('choose')}<select data-testid="customer-party-select" className={`${control} block w-full`} value={selectedParty} onChange={e => setSelectedParty(e.target.value)} disabled={busy || parties.isPending || parties.isError}>
          <option value="">{text('choose')}</option>{parties.data?.map(party => <option key={party.id} value={party.id} disabled={party.is_archived || Boolean(party.customer_id && party.customer_id !== customer.id)}>{party.name}{party.phone || party.email ? ` · ${party.phone || party.email}` : ''}{party.is_archived ? ` (${text('archived')})` : party.customer_id && party.customer_id !== customer.id ? ` (${text('linkedElsewhere')})` : ''}</option>)}
        </select></label>
        {parties.isError && <p role="alert">{customerPartyError(parties.error).message} <button className={control} onClick={() => parties.refetch()}>{text('retry')}</button></p>}
        {error && <p role="alert" className="text-brand-coral">{error}</p>}
        <div className="flex flex-wrap gap-2"><button className={control} disabled={!selectedParty || busy || parties.isError} onClick={() => ensureParty(false)}>{text('link')}</button>
        {onReceive && <button data-testid="customer-receive-money" className={`${control} font-semibold`} disabled={busy || parties.isPending || parties.isError} onClick={() => ensureParty(true)}>{busy ? text('loading') : text('receive')}</button>}</div>
      </div>}
      {onReport && <div className="flex flex-wrap gap-2">{parties.data?.filter(party => party.customer_id === customer.id).map(party => <button className={control} key={party.id} disabled={unavailable} onClick={() => onReport(party.id, reportFilter())}>{text('reports')}: {party.name}{party.phone || party.email ? ` · ${party.phone || party.email}` : ''}</button>)}</div>}
      {history.isPending ? <p role="status">{text('loading')}</p> : !unavailable && !history.data?.entries.length ? <p>{text('empty')}</p> : null}
      <ol className="divide-y divide-border-subtle">{!unavailable && history.data?.entries.map(({ voucher, movement }) => <li key={movement.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
        <div className="min-w-0 break-words"><strong>{voucher.voucher_number}</strong><p>{movement.business_date} · {voucher.party_name_snap} · {voucher.account_name_snap}</p>{(voucher.is_reversal || voucher.is_reversed) && <p>{voucher.is_reversal ? text('reversal') : text('reversed')}</p>}</div><span className="font-semibold tabular-nums">{money(movement.amount_minor)}</span>
      </li>)}</ol>
    </section>
  </CashbookDialog>;
}
