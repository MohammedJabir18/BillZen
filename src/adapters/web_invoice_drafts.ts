import {workspaceTransaction} from './web_workspace';
import {normalizeDraftOptional,calculateDraftTotals,draftDate,normalizeDraftRequest,draftHash} from '../domain/invoice_drafts';
import {calculateLineItem,getTodayBusinessDate} from '../domain/financial';
import type {CreateDraftInvoiceRequest,UpdateDraftInvoiceRequest,InvoiceDraftDetailDto,InvoiceDraftSummaryDto,DraftItemInput} from '../types/invoice_drafts';
type Tables=Record<string,any[]>;
function detail(t:Tables,id:string):InvoiceDraftDetailDto{
 const i=t.invoices.find(r=>r.id===id&&r.status==='draft');if(!i)throw Error('DRAFT_REJECTED: Draft not found');
 const c=t.customers.find(c=>c.id===i.customer_id),settings=t.business_settings[0];
 return {id:i.id,draft_version:i.draft_version,customer_id:i.customer_id,customer_name:c?.name??null,customer_archived:c? !c.is_active:false,business_date:i.business_date,notes:i.notes,currency_code:settings.currency_code,currency_exponent:i.snapshot_currency_exponent,subtotal_minor:i.subtotal_minor,discount_total_minor:i.discount_total_minor,taxable_amount_minor:i.taxable_amount_minor,tax_total_minor:i.tax_total_minor,grand_total_minor:i.grand_total_minor,created_at:i.created_at,updated_at:i.updated_at,
 items:t.invoice_items.filter(l=>l.invoice_id===id).sort((a,b)=>a.line_number-b.line_number).map(l=>({id:l.id,line_number:l.line_number,product_id:l.product_id,product_name:l.product_name_snap,product_sku:normalizeDraftOptional(l.product_sku_snap),unit:l.unit_snap,cost_price_minor:l.cost_price_minor_snap,quantity_scaled:l.quantity_scaled,unit_price_minor:l.unit_price_minor,discount_minor:l.discount_minor,tax_rate_bp:l.tax_rate_bp,product_archived:l.product_id? !t.products.find(p=>p.id===l.product_id)?.is_active:false,gross_minor:l.taxable_minor+l.discount_minor,taxable_minor:l.taxable_minor,tax_minor:l.tax_minor,line_total_minor:l.line_total_minor}))};
}
function refs(t:Tables,customer:string|null,items:DraftItemInput[],old?:InvoiceDraftDetailDto){
 if(customer){const c=t.customers.find(c=>c.id===customer);if(!c||(!c.is_active&&old?.customer_id!==customer))throw Error('DRAFT_REJECTED: Customer missing or archived');}
 for(const i of items)if(i.product_id){const p=t.products.find(p=>p.id===i.product_id);if(!p||(!p.is_active&&!old?.items.some(l=>l.product_id===i.product_id)))throw Error('DRAFT_REJECTED: Product missing or archived');}
}
function lines(t:Tables,id:string,items:DraftItemInput[],now:number){
 t.invoice_items=t.invoice_items.filter(l=>l.invoice_id!==id);
 for(const [index,i] of items.entries()){
 const l=calculateLineItem(i.quantity_scaled,i.unit_price_minor,i.discount_minor,i.tax_rate_bp);
 t.invoice_items.push({id:crypto.randomUUID(),invoice_id:id,product_id:i.product_id,line_number:index+1,product_name_snap:i.product_name,product_sku_snap:i.product_sku||'',unit_snap:i.unit,cost_price_minor_snap:i.cost_price_minor,quantity_scaled:i.quantity_scaled,unit_price_minor:i.unit_price_minor,discount_minor:i.discount_minor,taxable_minor:l.taxable_minor,tax_rate_bp:i.tax_rate_bp,tax_minor:l.tax_minor,line_total_minor:l.line_total_minor,created_at:now});}
}
export async function createWebDraft(raw:CreateDraftInvoiceRequest):Promise<InvoiceDraftDetailDto>{
 const r=normalizeDraftRequest(raw),key='draft-create:'+r.idempotency_key;
 r.business_date=await workspaceTransaction(false,t=>{
 const prior=t.draft_create_operations.find(j=>j.idempotency_key===key);return draftDate(r.business_date||(prior?JSON.parse(prior.request_json).business_date:getTodayBusinessDate(t.business_settings[0].timezone)));});
 const json=JSON.stringify(r),hash=await draftHash(json);let changed=false;
 return workspaceTransaction(true,t=>{
 const prior=t.draft_create_operations.find(j=>j.idempotency_key===key);
 if(prior){if(prior.request_json!==json)throw Error('IDEMPOTENCY_CONFLICT: Creation key has different content');if(prior.deleted_at!==null)throw Error('DRAFT_DELETED: Creation key belongs to a deleted draft');return detail(t,prior.invoice_id);}
 if(!raw.business_date&&getTodayBusinessDate(t.business_settings[0].timezone)!==r.business_date)throw Error('DRAFT_REJECTED: Business date changed; retry');
 refs(t,r.customer_id,r.items);const now=Date.now(),id=crypto.randomUUID();
 const invoice:any={id,invoice_number:null,sequence_number:null,idempotency_key:key,request_fingerprint:hash,draft_version:1,customer_id:r.customer_id,status:'draft',business_date:r.business_date,...calculateDraftTotals(r.items),notes:r.notes,created_at:now,updated_at:now,finalized_at:null,snapshot_currency_exponent:t.business_settings[0].currency_exponent};
 for(const field of ['business_name_snap','business_legal_name_snap','business_address_snap','business_phone_snap','business_email_snap','business_tax_id_snap','currency_code_snap','currency_symbol_snap','terms_snap','customer_name_snap','customer_phone_snap','customer_address_snap','customer_tax_id_snap'])invoice[field]=null;
 t.invoices.push(invoice);lines(t,id,r.items,now);t.draft_create_operations.push({idempotency_key:key,request_fingerprint:hash,request_json:json,invoice_id:id,created_at:now,deleted_at:null,deleted_version:null});changed=true;return detail(t,id);
 },()=>changed);
}
export async function updateWebDraft(raw:UpdateDraftInvoiceRequest):Promise<InvoiceDraftDetailDto>{
 const r=normalizeDraftRequest({...raw,idempotency_key:'update'});
 return workspaceTransaction(true,t=>{
 const old=detail(t,raw.id);if(old.draft_version!==raw.expected_version||!Number.isSafeInteger(raw.expected_version)||raw.expected_version>=Number.MAX_SAFE_INTEGER)throw Error('CONCURRENT_MODIFICATION_ERROR: Reload saved draft');
 refs(t,r.customer_id,r.items,old);const i=t.invoices.find(i=>i.id===raw.id),now=Date.now();
 Object.assign(i,calculateDraftTotals(r.items),{customer_id:r.customer_id,business_date:draftDate(r.business_date||old.business_date),notes:r.notes,draft_version:old.draft_version+1,updated_at:now});lines(t,i.id,r.items,now);return detail(t,i.id);
 });
}
export async function getWebDraft(id:string){return workspaceTransaction(false,t=>detail(t,id));}
export async function listWebDrafts():Promise<InvoiceDraftSummaryDto[]>{return workspaceTransaction(false,t=>t.invoices.filter(i=>i.status==='draft').sort((a,b)=>b.updated_at-a.updated_at||b.id.localeCompare(a.id)).map(i=>{const d=detail(t,i.id);return {id:d.id,draft_version:d.draft_version,customer_id:d.customer_id,customer_name:d.customer_name,customer_archived:d.customer_archived,business_date:d.business_date,item_count:d.items.length,grand_total_minor:d.grand_total_minor,currency_code:d.currency_code,currency_exponent:d.currency_exponent,updated_at:d.updated_at};}));}
export async function deleteWebDraft(id:string,version:number):Promise<void>{
 let changed=false;return workspaceTransaction(true,t=>{
 const j=t.draft_create_operations.find(j=>j.invoice_id===id);if(j?.deleted_at!==null&&j?.deleted_at!==undefined){if(j.deleted_version===version)return;throw Error('CONCURRENT_MODIFICATION_ERROR: Deleted at another version');}
 const old=detail(t,id);if(old.draft_version!==version)throw Error('CONCURRENT_MODIFICATION_ERROR: Reload saved draft');if(!j)throw Error('DRAFT_REJECTED: Draft creation journal missing');
 j.deleted_at=Date.now();j.deleted_version=version;t.invoices=t.invoices.filter(i=>i.id!==id);t.invoice_items=t.invoice_items.filter(i=>i.invoice_id!==id);changed=true;
 },()=>changed);
}
