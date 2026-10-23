import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import type { Product } from '../types';
import type { Language } from '../i18n';
import { stockTranslations } from '../i18n/stock';
import { getProducts } from '../adapters/tauri';
import { getStockHistory, postStockAdjustment, StockAdjustmentRejected, type StockMovement, type StockAdjustmentInput } from '../adapters/stock';
import { MAX_QUANTITY_SCALED } from '../domain/financial';
import { useBackHandler } from '../hooks/useBackHandler';
import { CashbookDialog } from './CashbookDialog';
import { AnimatedSegmentedControl } from './AnimatedSegmentedControl';

type Tab = 'add' | 'reduce' | 'history';
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const quantityText = (scaled: number) => (scaled / 1000).toLocaleString('en', { maximumFractionDigits: 3 });
function details(movement: StockMovement): { business_date?: string; reason?: string } {
  try { const parsed = JSON.parse(movement.notes || '{}'); return typeof parsed === 'object' && parsed !== null ? parsed : {}; }
  catch { return { reason: movement.notes || undefined }; }
}

export function StockManagement({ product, language, onClose, onSaved }: {
  product: Product; language: Language; onClose: () => void; onSaved: () => void;
}) {
  const t = stockTranslations[language];
  const [liveProduct, setLiveProduct] = useState(product);
  const [tab, setTab] = useState<Tab>(product.is_active && product.is_stock_tracked ? 'add' : 'history');
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [correction, setCorrection] = useState<StockMovement | null>(null);
  const [pending, setPending] = useState<StockAdjustmentInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const canWrite = liveProduct.is_active && liveProduct.is_stock_tracked;
  const locked = saving || !!pending;
  // An uncertain write must remain available for an exact idempotent retry.
  useBackHandler(true, () => { if (!locked) onClose(); });
  async function refresh() {
    setLoading(true); setLoadFailed(false);
    try {
      const [movements, products] = await Promise.all([getStockHistory(product.id), getProducts({ is_active: null })]);
      const fresh = products.find(item => item.id === product.id);
      if (!fresh) throw new Error('Product unavailable');
      setHistory(movements); setLiveProduct(fresh);
    } catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [product.id]);
  const validQuantity = /^\d+(?:\.\d{1,3})?$/.test(quantity.trim());
  const [whole = '0', fraction = ''] = quantity.trim().split('.');
  const scaled = validQuantity ? Number(whole) * 1000 + Number(fraction.padEnd(3, '0')) : 0;
  const delta = pending?.quantity_delta_scaled ?? (correction ? -correction.quantity_delta_scaled : scaled * (tab === 'reduce' ? -1 : 1));
  const after = liveProduct.current_stock_scaled + delta;
  const quantityError = !correction && (!validQuantity || !Number.isSafeInteger(scaled) || scaled <= 0 || scaled > MAX_QUANTITY_SCALED);
  const stockError = after < 0 ? t.insufficient : after > MAX_QUANTITY_SCALED ? t.maximum : '';
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  const changeTab = (next: Tab) => { if (locked) return; setTab(next); setCorrection(null); setError(''); setSaved(false); };
  async function submit() {
    if (submitting.current) return;
    if (!pending && (loading || loadFailed || !canWrite || quantityError || stockError || !validDate || !reason.trim())) {
      setError(quantityError ? t.invalid : stockError || t.required); return;
    }
    const intent = pending ?? { id: crypto.randomUUID(), product_id: product.id, quantity_delta_scaled: delta, business_date: date, reason: reason.trim(), reversal_of: correction?.id ?? null };
    submitting.current = true; setSaving(true); setPending(intent); setError(''); setSaved(false);
    try {
      await postStockAdjustment(intent);
      setPending(null); setQuantity(''); setReason(''); setCorrection(null); setSaved(true); setTab('history');
      onSaved(); await refresh();
    } catch (failure) {
      setError(t.failed);
      if (failure instanceof StockAdjustmentRejected) {
        // Explicit engine rejection guarantees no write; refresh the live quantity and allow correction.
        setPending(null);
        setError(t.rejected);
        await refresh();
      }
    }
    finally { submitting.current = false; setSaving(false); }
  }
  const fieldClass = 'w-full min-w-0 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm disabled:opacity-60';
  return <CashbookDialog label={t.manage} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-2 sm:p-4 backdrop-blur-sm">
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} data-testid="stock-dialog" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl min-w-0 flex-col rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-zinc-800 p-4">
        <div className="min-w-0"><h2 className="text-lg font-bold">{t.manage}</h2><p className="break-words text-sm text-gray-500 dark:text-zinc-400">{product.name} · {product.sku}</p></div>
        <button type="button" aria-label={t.close} disabled={locked} onClick={onClose} className="min-h-11 min-w-11 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center"><X className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-4 space-y-4">
        <p className="text-sm">{t.current}: <strong className="tabular-nums">{quantityText(liveProduct.current_stock_scaled)} {product.unit}</strong></p>
        <fieldset disabled={locked} className="min-w-0"><AnimatedSegmentedControl<Tab> value={tab} onChange={changeTab} language={language} label={t.manage} options={(['add', 'reduce', 'history'] as Tab[]).map(value => ({ value, label: t[value], testId: `stock-mode-${value}` }))} /></fieldset>
        {!canWrite && <p className="text-sm text-gray-500 dark:text-zinc-400">{t.readOnly}</p>}
        {loading && <p role="status">{t.loading}</p>}
        {loadFailed && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300">{t.loadError} <button type="button" onClick={() => void refresh()} disabled={saving} className="underline min-h-11">{t.retry}</button></div>}
        {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t.saved}</p>}
        {error && <p role="alert" data-testid="stock-error" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        {pending && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{t.pending}</p>}
        {tab === 'history' ? <section aria-label={t.history} className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-zinc-400">{t.immutable}</p>
          {!loading && !loadFailed && !history.length && <p>{t.empty}</p>}
          {history.map(movement => {
            const note = details(movement);
            const corrected = history.some(row => row.reference_id === movement.id && row.reference_type !== 'opening');
            return <article key={movement.id} className="rounded-xl border border-gray-200 dark:border-zinc-800 p-3 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><strong>{movement.reference_type === 'opening' ? t.opening : movement.reference_type === 'adjustment' ? (movement.reference_id ? t.reversal : t.adjustment) : t.movement}</strong><span dir="ltr" className="tabular-nums">{movement.quantity_delta_scaled > 0 ? '+' : ''}{quantityText(movement.quantity_delta_scaled)} {product.unit}</span></div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{note.business_date || new Date(movement.created_at < 1e12 ? movement.created_at * 1000 : movement.created_at).toLocaleDateString(language)} · {t.resulting}: {quantityText(movement.resulting_stock_scaled)}</p>
              {note.reason && <p className="break-words whitespace-pre-wrap">{note.reason}</p>}
              {corrected ? <p className="text-xs text-gray-500 dark:text-zinc-400">{t.corrected}</p> : canWrite && movement.reference_type === 'adjustment' && !movement.reference_id && <button data-testid={`stock-correct-${movement.id}`} type="button" disabled={locked || loading || loadFailed} onClick={() => { setCorrection(movement); setTab(movement.quantity_delta_scaled > 0 ? 'reduce' : 'add'); setReason(''); setError(''); setSaved(false); }} className="min-h-11 text-indigo-700 dark:text-lime-400 underline">{t.correction}</button>}
            </article>;
          })}
        </section> : canWrite && <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
          {correction ? <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm"><p>{t.correcting}: {quantityText(delta)} {product.unit}</p><button type="button" disabled={locked} onClick={() => setCorrection(null)} className="min-h-11 underline">{t.cancelCorrection}</button></div> : <label className="block text-sm space-y-1"><span>{t.quantity} *</span><input data-testid="stock-quantity" data-dialog-initial-focus inputMode="decimal" autoComplete="off" value={quantity} disabled={locked} onChange={event => { setQuantity(event.target.value); setError(''); }} className={fieldClass} required /></label>}
          <label className="block text-sm space-y-1"><span>{t.date} *</span><input data-testid="stock-date" type="date" value={date} onChange={event => setDate(event.target.value)} disabled={locked} className={fieldClass} required /></label>
          <label className="block text-sm space-y-1"><span>{t.reason} *</span><textarea data-testid="stock-reason" rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={locked} className={fieldClass} required /></label>
          {(correction || !quantityError) && <div data-testid="stock-preview" aria-live="polite" className="rounded-xl bg-gray-50 dark:bg-zinc-800 p-3 text-sm"><p>{t.preview}</p><p dir="ltr" className="mt-1 font-semibold tabular-nums">{quantityText(liveProduct.current_stock_scaled)} → {quantityText(after)} {product.unit}</p></div>}
          {stockError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{stockError}</p>}
          <button data-testid="stock-confirm" type="submit" disabled={saving || (!pending && (loading || loadFailed || quantityError || !!stockError || !validDate || !reason.trim()))} className="min-h-11 w-full rounded-lg bg-indigo-600 dark:bg-lime-500 text-white dark:text-zinc-950 px-4 py-2.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">{saving && <RefreshCw className="h-4 w-4 animate-spin" />}{pending ? t.retry : t.confirm}</button>
        </form>}
      </div>
    </div>
  </CashbookDialog>;
}
