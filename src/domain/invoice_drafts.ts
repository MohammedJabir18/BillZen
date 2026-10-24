import type {DraftItemInput,CreateDraftInvoiceRequest} from '../types/invoice_drafts';
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

export function draftDate(value:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('DRAFT_REJECTED: Invalid business date');return value;
}
export function normalizeDraftRequest(r:CreateDraftInvoiceRequest):CreateDraftInvoiceRequest{
 const key=r.idempotency_key.trim();const notes=normalizeDraftOptional(r.notes);
 if(!key||new TextEncoder().encode(key).length>200||Array.from(notes||'').length>2000)throw Error('DRAFT_REJECTED: Invalid retry key or notes');
 const items=normalizeDraftItems(r.items).map(i=>({product_id:i.product_id,product_name:i.product_name,product_sku:i.product_sku,unit:i.unit,cost_price_minor:i.cost_price_minor,quantity_scaled:i.quantity_scaled,unit_price_minor:i.unit_price_minor,discount_minor:i.discount_minor,tax_rate_bp:i.tax_rate_bp}));
 calculateDraftTotals(items);
 return {idempotency_key:key,customer_id:normalizeDraftOptional(r.customer_id),business_date:r.business_date,notes,items};
}
export async function draftHash(json:string):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
