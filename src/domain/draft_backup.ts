import {normalizeDraftItems,calculateDraftTotals} from './invoice_drafts';
import {calculateLineItem} from './financial';
import {draftDate,normalizeDraftRequest,draftHash} from './invoice_drafts';
type Tables=Record<string,any>;
const check=(ok:unknown,message:string)=>{if(!ok)throw Error('Invalid draft backup: '+message);};
const integer=(n:unknown,min=0)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min;
export function validateDraftWorkspace(t:Tables){
 for(const key of ['invoices','invoice_items','draft_create_operations'])check(Array.isArray(t[key]),'missing '+key);
 const invoices=new Map<string,any>(),journals=new Map<string,any>();const keys=new Set();const lineIds=new Set();
 for(const i of t.invoices){check(i.status==='draft','unsupported finalized/cancelled invoice');check(typeof i.id==='string'&&i.id&&!invoices.has(i.id),'invoice identity');invoices.set(i.id,i);}
 for(const l of t.invoice_items){check(invoices.has(l.invoice_id),'line owner');check(typeof l.id==='string'&&l.id&&!lineIds.has(l.id),'line identity');lineIds.add(l.id);}
 for(const j of t.draft_create_operations){
  check(typeof j.idempotency_key==='string'&&j.idempotency_key.startsWith('draft-create:')&&!keys.has(j.idempotency_key)&&typeof j.invoice_id==='string'&&j.invoice_id&&!journals.has(j.invoice_id),'journal identity');keys.add(j.idempotency_key);journals.set(j.invoice_id,j);
  check(integer(j.created_at)&&typeof j.request_json==='string'&&/^[a-f0-9]{64}$/.test(j.request_fingerprint),'journal metadata');
  const original=JSON.parse(j.request_json),normalized=normalizeDraftRequest(original);draftDate(normalized.business_date!);check(JSON.stringify(normalized)===j.request_json&&j.idempotency_key==='draft-create:'+normalized.idempotency_key,'journal canonical intent');
  if(j.deleted_at!==null){check(integer(j.deleted_at)&&integer(j.deleted_version,1)&&!invoices.has(j.invoice_id),'tombstone');}
  else{check(j.deleted_version===null&&invoices.has(j.invoice_id),'live journal owner');const i=invoices.get(j.invoice_id);check(i.idempotency_key===j.idempotency_key&&i.request_fingerprint===j.request_fingerprint&&i.created_at===j.created_at,'invoice creation evidence');}
 }
 for(const i of invoices.values()){
  check(journals.has(i.id)&&integer(i.draft_version,1)&&integer(i.created_at)&&integer(i.updated_at),'invoice version/journal');draftDate(i.business_date);
  check(i.customer_id===null||t.customers.some((c:any)=>c.id===i.customer_id),'customer reference');check(i.snapshot_currency_exponent===t.business_settings.currency_exponent,'currency exponent');
  for(const key of ['invoice_number','sequence_number','finalized_at','business_name_snap','business_legal_name_snap','business_address_snap','business_phone_snap','business_email_snap','business_tax_id_snap','currency_code_snap','currency_symbol_snap','terms_snap','customer_name_snap','customer_phone_snap','customer_address_snap','customer_tax_id_snap'])check(i[key]===null,'finalization field '+key);
  check(i.notes===null||typeof i.notes==='string'&&Array.from(i.notes).length<=2000,'notes');
  const lines=t.invoice_items.filter((l:any)=>l.invoice_id===i.id).sort((a:any,b:any)=>a.line_number-b.line_number);
  const inputs=lines.map((l:any,index:number)=>{
   check(l.line_number===index+1&&integer(l.created_at),'line order');check(l.product_id===null||t.products.some((p:any)=>p.id===l.product_id),'product reference');
   const raw={product_id:l.product_id,product_name:l.product_name_snap,product_sku:l.product_sku_snap||null,unit:l.unit_snap,cost_price_minor:l.cost_price_minor_snap,quantity_scaled:l.quantity_scaled,unit_price_minor:l.unit_price_minor,discount_minor:l.discount_minor,tax_rate_bp:l.tax_rate_bp};
   const input=normalizeDraftItems([raw])[0];check(JSON.stringify(raw)===JSON.stringify(input),'line canonical input');
   const calc=calculateLineItem(input.quantity_scaled,input.unit_price_minor,input.discount_minor,input.tax_rate_bp);for(const key of ['taxable_minor','tax_minor','line_total_minor'] as const)check(l[key]===calc[key],'line arithmetic');return input;
  });
  const totals=calculateDraftTotals(inputs);for(const [key,value] of Object.entries(totals))check(i[key]===value,'invoice totals '+key);
 }
}
export async function verifyDraftHashes(t:Tables){for(const j of t.draft_create_operations)check(await draftHash(j.request_json)===j.request_fingerprint,'journal hash');}
