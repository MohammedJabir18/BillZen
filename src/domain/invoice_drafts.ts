import type {DraftItemInput} from '../types/invoice_drafts';
import {calculateLineItem,calculateInvoiceTotals,MAX_MONEY_MINOR} from './financial';
export const normalizeDraftOptional=(value:string|null):string|null=>value?.trim()||null;
const length=(value:string)=>Array.from(value).length;
export function normalizeDraftItems(items:DraftItemInput[]):DraftItemInput[]{
  if(items.length>500)throw new Error('DRAFT_REJECTED: Too many lines (maximum 500)');
  return items.map(item=>{
    const normalized={...item,product_id:normalizeDraftOptional(item.product_id),product_sku:normalizeDraftOptional(item.product_sku),product_name:item.product_name.trim(),unit:item.unit.trim()};
    if(!normalized.product_name||length(normalized.product_name)>200||!normalized.unit||length(normalized.unit)>50||length(normalized.product_sku||'')>100)throw new Error('DRAFT_REJECTED: Invalid item name, SKU or unit');
    return normalized;
  });
}
export function calculateDraftTotals(items:DraftItemInput[]){
  const lines=items.map(i=>{
    if(!Number.isSafeInteger(i.cost_price_minor)||i.cost_price_minor<0||i.cost_price_minor>MAX_MONEY_MINOR)throw new Error('DRAFT_REJECTED: Invalid cost price');
    return calculateLineItem(i.quantity_scaled,i.unit_price_minor,i.discount_minor,i.tax_rate_bp);
  });
  return calculateInvoiceTotals(lines,0);
}
