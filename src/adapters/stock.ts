import {invoke} from '@tauri-apps/api/core';
import {isTauriEnvironment} from './tauri';
import {withWebCatalog, type StockMovement} from './web_catalog';
import {MAX_QUANTITY_SCALED} from '../domain/financial';
export type {StockMovement} from './web_catalog';

export class StockAdjustmentRejected extends Error {}

export interface StockAdjustmentInput {
  id: string;
  product_id: string;
  quantity_delta_scaled: number;
  business_date: string;
  reason: string;
  reversal_of?: string | null;
}

function normalize(input: StockAdjustmentInput): StockAdjustmentInput {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) throw new StockAdjustmentRejected('Invalid adjustment identity');
  if (!Number.isSafeInteger(input.quantity_delta_scaled) || !input.quantity_delta_scaled || Math.abs(input.quantity_delta_scaled) > MAX_QUANTITY_SCALED) throw new StockAdjustmentRejected('Invalid stock quantity');
  const date = new Date(input.business_date+'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.business_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==input.business_date) throw new StockAdjustmentRejected('Invalid stock date');
  const reason = input.reason.trim();
  if (!reason || [...reason].length > 500) throw new StockAdjustmentRejected('A reason of up to500 characters is required');
  return {...input, reason, reversal_of: input.reversal_of?.trim() || null};
}

export async function postStockAdjustment(raw: StockAdjustmentInput): Promise<StockMovement> {
  const input = normalize(raw);
  if (isTauriEnvironment()) {
    try {return await invoke('post_stock_adjustment', {input});}
    catch (error) {
      if (typeof error === 'string' && error.startsWith('STOCK_REJECTED:')) throw new StockAdjustmentRejected(error.slice('STOCK_REJECTED:'.length));
      throw error;
    }
  }
  const result = await withWebCatalog(({products, stock_movements}) => {
    const notes = JSON.stringify({business_date: input.business_date, reason: input.reason});
    const previous = stock_movements.find(row => row.id === input.id);
    if (previous) {
      let meta;
      try {meta = JSON.parse(previous.notes || 'null');} catch { /* Non-adjustment opening records have plain notes. */ }
      if (previous.reference_type !== 'adjustment' || previous.product_id !== input.product_id ||
          previous.quantity_delta_scaled !== input.quantity_delta_scaled || previous.reference_id !== input.reversal_of ||
          meta?.business_date !== input.business_date || meta?.reason !== input.reason) throw new StockAdjustmentRejected('Adjustment identity already used for another intent');
      return {movement: previous, changed: false};
    }
    const product = products.find(row => row.id === input.product_id);
    if (!product) throw new StockAdjustmentRejected('Product not found');
    if (!product.is_active || !product.is_stock_tracked) throw new StockAdjustmentRejected('Only active stock-tracked products can be adjusted');
    const ledger = stock_movements.filter(row => row.product_id === product.id);
    if (ledger.reduce((sum,row) => sum+row.quantity_delta_scaled,0) !== product.current_stock_scaled) throw new StockAdjustmentRejected('Stock ledger mismatch');
    if (input.reversal_of) {
      const original = ledger.find(row => row.id === input.reversal_of);
      if (!original || original.reference_type !== 'adjustment' || original.reference_id ||
          input.quantity_delta_scaled !== -original.quantity_delta_scaled) throw new StockAdjustmentRejected('Invalid stock correction');
      if (ledger.some(row => row.reference_type === 'adjustment' && row.reference_id === original.id)) throw new StockAdjustmentRejected('Stock movement already corrected');
    }
    const next = product.current_stock_scaled+input.quantity_delta_scaled;
    if (!Number.isSafeInteger(next) || next<0 || next>MAX_QUANTITY_SCALED) throw new StockAdjustmentRejected('Insufficient stock or maximum stock exceeded');
    const now=Date.now();
    const movement: StockMovement = {id:input.id,product_id:product.id,reference_type:'adjustment',reference_id:input.reversal_of!,
      quantity_delta_scaled:input.quantity_delta_scaled,resulting_stock_scaled:next,notes,created_at:now};
    stock_movements.push(movement);
    product.current_stock_scaled=next;
    product.updated_at=now;
    return {movement,changed:true};
  }, true, result => result.changed);
  return result.movement;
}

export async function getStockHistory(productId: string): Promise<StockMovement[]> {
  if (isTauriEnvironment()) return invoke('get_stock_history', {productId});
  return withWebCatalog(({products,stock_movements}) => {
    if (!products.some(row => row.id===productId)) throw new StockAdjustmentRejected('Product not found');
    return stock_movements.filter(row => row.product_id===productId)
      .sort((a,b) => b.created_at-a.created_at || b.id.localeCompare(a.id));
  },false);
}
