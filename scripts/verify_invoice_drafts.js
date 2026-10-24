import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const url='http://127.0.0.1:4208';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4208','--strictPort'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto(url);
 // Reconstruct the actual populated v4 store shape, then let production upgrade it.
 await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');await api.updateBusinessSettings(await api.getBusinessSettings());
  await api.createProduct({sku:'UPGRADE',barcode:null,name:'Upgrade tea',description:null,category_id:null,unit:'kg',unit_price_minor:1001,cost_price_minor:20,tax_rate_bp:500,is_stock_tracked:true,min_stock_threshold_scaled:0});
  const ws=await import('/src/adapters/web_workspace.ts'),db=await (await import('/src/adapters/web_cashbook_db.ts')).openWebDb();
  const t=await ws.workspaceTransaction(false,t=>t);db.close();
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('BillZen_Web_DB');r.onsuccess=resolve;r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const r=indexedDB.open('BillZen_Web_DB',4);r.onupgradeneeded=()=>{for(const [name,rows]of Object.entries(t)){if(['invoices','invoice_items','draft_create_operations'].includes(name))continue;const store=r.result.createObjectStore(name,{keyPath:name==='cashbook_sequences'?'sequence_key':name==='category_merges'?'merged_category_id':'id'});for(const row of rows)store.add(row);}};r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
 });
 await page.reload();
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/tauri.ts')).getProducts({})).some(p=>p.sku==='UPGRADE')),true,'populated v4 upgrade preserves catalog');
 const ids=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');await api.updateBusinessSettings(await api.getBusinessSettings());
  const drafts=await import('/src/adapters/invoice_drafts.ts');const ws=await import('/src/adapters/web_workspace.ts');
  const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+': '+JSON.stringify(a));};
  const rejects=async(fn,label)=>{try{await fn();}catch{return;}throw Error('Accepted '+label);};
  const item={product_id:null,product_name:' Tea ',product_sku:null,unit:'kg',cost_price_minor:20,quantity_scaled:1500,unit_price_minor:1001,discount_minor:2,tax_rate_bp:500};
  const input={idempotency_key:'create-one',customer_id:null,business_date:'2026-10-24',notes:' held ',items:[item,item]};
  const effects=()=>ws.workspaceTransaction(false,t=>JSON.stringify(Object.fromEntries(Object.entries(t).filter(([k])=>!['invoices','invoice_items','draft_create_operations'].includes(k)))));
  const before=await effects();const [a,b]=await Promise.all([drafts.createInvoiceDraft(input),drafts.createInvoiceDraft(input)]);eq(a.id,b.id,'concurrent retry');eq(a.grand_total_minor,3150,'exact total');eq(a.notes,'held','notes');
  await rejects(()=>drafts.createInvoiceDraft({...input,notes:'changed'}),'creation conflict');
  const u={id:a.id,expected_version:1,customer_id:null,business_date:input.business_date,notes:'edited',items:[item]};const [r1,r2]=await Promise.allSettled([drafts.updateInvoiceDraft(u),drafts.updateInvoiceDraft(u)]);eq([r1,r2].filter(r=>r.status==='fulfilled').length,1,'update conflict');
  const saved=await drafts.getInvoiceDraft(a.id);eq(saved.draft_version,2,'version');eq(saved.grand_total_minor,1575,'updated total');
  await rejects(()=>drafts.deleteInvoiceDraft(a.id,1),'stale delete');
  const add=IDBObjectStore.prototype.add;let seen=0;const snap=await ws.workspaceTransaction(false,t=>JSON.stringify(t));
  IDBObjectStore.prototype.add=function(value,...args){if(this.name==='invoice_items'&&value.invoice_id!==a.id&&++seen===2)throw new DOMException('Injected second line','QuotaExceededError');return add.call(this,value,...args);};
  try{await rejects(()=>drafts.createInvoiceDraft({...input,idempotency_key:'rollback'}),'rollback');}finally{IDBObjectStore.prototype.add=add;}
  eq(await ws.workspaceTransaction(false,t=>JSON.stringify(t)),snap,'atomic rollback');
  const clear=IDBObjectStore.prototype.clear;IDBObjectStore.prototype.clear=function(){throw Error('No-op writes');};
  try{eq((await drafts.createInvoiceDraft(input)).id,a.id,'no-op retry');}finally{IDBObjectStore.prototype.clear=clear;}
  const second=await drafts.createInvoiceDraft({...input,idempotency_key:'second'});await drafts.deleteInvoiceDraft(a.id,2);await drafts.deleteInvoiceDraft(a.id,2);await rejects(()=>drafts.createInvoiceDraft(input),'deleted key');eq(await effects(),before,'zero effects');
  const backup=await api.exportWorkspaceBackup();eq(backup.format_version,'1.2','journal backup format');await api.restoreWorkspaceBackup(backup);await rejects(()=>drafts.createInvoiceDraft(input),'restored tombstone');
  const crypto=await import('/src/domain/backup_crypto.ts');
  for(const mutate of [b=>b.invoices[0].grand_total_minor++,b=>b.invoice_items[0].invoice_id='missing',b=>b.draft_create_operations[0].request_fingerprint='bad',b=>b.invoices[0].invoice_number='INV-1']){
   const bad=structuredClone(backup);mutate(bad);const {checksum_sha256,...payload}=bad;bad.checksum_sha256=await crypto.computePayloadChecksum(payload);await rejects(()=>api.restoreWorkspaceBackup(bad),'malformed backup');
  }
  eq((await drafts.getInvoiceDraft(second.id)).grand_total_minor,3150,'invalid restore preserves saved draft');return {id:second.id,deleted:a.id};
 });
 await page.reload();assert.equal(await page.evaluate(async id=>(await (await import('/src/adapters/invoice_drafts.ts')).getInvoiceDraft(id)).grand_total_minor,ids.id),3150);
 if(process.env.BILLZEN_NATIVE_DRAFT_FIXTURE){
  const fixture=JSON.parse(await readFile(process.env.BILLZEN_NATIVE_DRAFT_FIXTURE,'utf8'));
  const output=await page.evaluate(async fixture=>{
   const api=await import('/src/adapters/tauri.ts');await api.restoreWorkspaceBackup(fixture);const output=await api.exportWorkspaceBackup();const canonical=(await import('/src/domain/backup_crypto.ts')).canonicalizeJson;
   const sorted=rows=>rows.slice().sort((a,b)=>(a.id||a.idempotency_key).localeCompare(b.id||b.idempotency_key));
   for(const key of ['invoices','invoice_items','draft_create_operations'])if(canonical(sorted(output[key]))!==canonical(sorted(fixture[key])))throw Error('Interop changed '+key);
   return output;
  },fixture);await writeFile(process.env.BILLZEN_WEB_DRAFT_FIXTURE,JSON.stringify(output));
 }
 console.log('PASS IndexedDB invoice drafts: concurrent lifecycle, retry/tombstone, zero effects, abort, backup, invalid restore, reload');
}finally{await browser?.close();server.kill('SIGTERM');}
