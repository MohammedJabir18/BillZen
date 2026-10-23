import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const url = process.env.BILLZEN_TEST_URL || 'http://127.0.0.1:4195';
const server = process.env.BILLZEN_TEST_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4195','--strictPort'], {stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}if(i===99)throw Error('Test server unavailable');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();await page.goto(url);
 const result=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');
  await api.updateBusinessSettings(await api.getBusinessSettings());
  const cash=await import('/src/adapters/cashbook.ts');
  const tr=await import('/src/adapters/transfers.ts');
  const ws=await import('/src/adapters/web_workspace.ts');
  const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+': '+JSON.stringify(a)+' != '+JSON.stringify(b));};
  const rejects=async(fn,label)=>{let rejected=false;try{await fn();}catch{rejected=true;}if(!rejected)throw Error('Accepted '+label);};
  const a=await cash.createMoneyAccount({account_name:'Transfer cash',account_type:'cash',opening_balance_minor:500000,allow_negative_balance:false});
  const b=await cash.createMoneyAccount({account_name:'Transfer bank',account_type:'bank',opening_balance_minor:100000,allow_negative_balance:false});
  const input={idempotency_key:'concurrent-transfer',from_account_id:a.id,to_account_id:b.id,amount_minor:200000,business_date:'2026-10-23'};
  const [one,two]=await Promise.all([tr.postCashbookTransfer(input),tr.postCashbookTransfer(input)]);
  eq(one.status,'posted','posted');eq(one.transfer.id,two.transfer.id,'concurrent retry');
  await rejects(()=>tr.postCashbookTransfer({...input,amount_minor:1}),'changed retry');
  const balances=async()=> (await cash.getMoneyAccounts()).filter(x=>[a.id,b.id].includes(x.id)).sort((x,y)=>x.id.localeCompare(y.id)).map(x=>[x.id,x.current_balance_minor]);
  const postedBalances=await balances();eq(postedBalances.map(x=>x[1]),[300000,300000],'paired balances');
  const ledger=await cash.getCashbookLedger({account_id:a.id,classification:'transfer'});
  eq([ledger.summary.period_inflows_minor,ledger.summary.period_outflows_minor,ledger.summary.matching_inflows_minor,ledger.summary.matching_outflows_minor],[0,0,0,0],'transfer metrics');
  eq(ledger.summary.closing_balance_minor,300000,'full closing balance');
  for(const id of [one.transfer.out_voucher_id,one.transfer.in_voucher_id])await rejects(()=>cash.reverseCashbookVoucher(id),'half reversal');
  await rejects(()=>cash.postCashbookVoucher({idempotency_key:'__billzen_transfer__:spoof',account_id:a.id,amount_minor:1,business_date:'2026-10-23',direction:'inflow',classification:'operating_income',payment_method:'cash'}),'reserved ordinary key');
  const legacy=await import('/src/adapters/web_cashbook_db.ts');
  await rejects(()=>legacy.exportWebCashbookTables(),'legacy partial export');
  await rejects(()=>legacy.restoreWebCashbookTables({}),'legacy partial restore');
  const snapshot=()=>ws.workspaceTransaction(false,t=>JSON.stringify(t));
  const before=await snapshot();
  const clear=IDBObjectStore.prototype.clear;
  IDBObjectStore.prototype.clear=function(){throw Error('No-op must not write');};
  let warning;
  try{await tr.postCashbookTransfer(input);warning=await tr.postCashbookTransfer({...input,idempotency_key:'negative',amount_minor:700000});}finally{IDBObjectStore.prototype.clear=clear;}
  eq(warning.status,'requires_confirmation','negative warning');eq(await snapshot(),before,'warning writes nothing');
  // Abort after the first movement has been enqueued: all stores must roll back.
  const oldMovementIds=new Set(await ws.workspaceTransaction(false,t=>t.cashbook_movements.map(m=>m.id)));
  const add=IDBObjectStore.prototype.add;let seen=0;
  IDBObjectStore.prototype.add=function(value,...args){if(this.name==='cashbook_movements'&&!oldMovementIds.has(value.id)&&++seen===2)throw new DOMException('Injected second leg failure','QuotaExceededError');return add.call(this,value,...args);};
  try{await rejects(()=>tr.postCashbookTransfer({...input,idempotency_key:'abort'}),'second leg abort');}finally{IDBObjectStore.prototype.add=add;}
  eq(await snapshot(),before,'aborted post changes no store');
  seen=0;
  IDBObjectStore.prototype.add=function(value,...args){if(this.name==='cashbook_movements'&&!oldMovementIds.has(value.id)&&++seen===2)throw new DOMException('Injected reverse second leg failure','QuotaExceededError');return add.call(this,value,...args);};
  try{await rejects(()=>tr.reverseCashbookTransfer({transfer_id:one.transfer.id}),'reverse second leg abort');}finally{IDBObjectStore.prototype.add=add;}
  eq(await snapshot(),before,'aborted reversal preserves flags and every store');
  const reversed=await tr.reverseCashbookTransfer({transfer_id:one.transfer.id});
  eq(reversed.status,'posted','paired reverse');eq((await tr.reverseCashbookTransfer({transfer_id:one.transfer.id})).transfer.id,reversed.transfer.id,'reverse retry');
  await rejects(()=>tr.reverseCashbookTransfer({transfer_id:reversed.transfer.id}),'reverse reversal');
  eq((await balances()).map(x=>x[1]).sort((x,y)=>x-y),[100000,500000],'reversal balances');
  const negative=await tr.postCashbookTransfer({...input,idempotency_key:'negative',amount_minor:700000,confirmed_negative_balance:true});eq(negative.status,'posted','confirmed negative');
  const rows=await ws.workspaceTransaction(false,t=>({headers:t.cashbook_transfers,vouchers:t.cashbook_vouchers,movements:t.cashbook_movements,audits:t.cashbook_audit_events}));
  eq([rows.headers.length,rows.vouchers.length,rows.movements.length],[3,6,6],'exact pair count');
  if(!rows.audits.some(e=>e.event_type==='negative_balance_confirmed'))throw Error('Missing override audit');
  const backup=await api.exportWorkspaceBackup();eq(backup.format_version,'1.1','new backup version');
  const checksum=await import('/src/domain/backup_crypto.ts');
  const resign=async b=>{const {checksum_sha256,...payload}=b;b.checksum_sha256=await checksum.computePayloadChecksum(payload);};
  for(const mode of ['missing_header','missing_leg','sequence','snapshot','half_reverse','hash','legacy_injection','raw_key']){
   const bad=structuredClone(backup);
   if(mode==='missing_header')bad.cashbook_transfers=[];
   if(mode==='missing_leg')bad.cashbook_vouchers.pop();
   if(mode==='sequence')bad.cashbook_sequences=[];
   if(mode==='snapshot')bad.cashbook_vouchers[0].business_name_snap='tampered';
   if(mode==='half_reverse')bad.cashbook_vouchers.find(v=>v.is_reversed).is_reversed=false;
   if(mode==='hash')bad.cashbook_transfers[0].payload_hash='wrong';
   if(mode==='raw_key')bad.cashbook_transfers.find(h=>!h.is_reversal).idempotency_key=' concurrent-transfer ';
   if(mode==='legacy_injection')bad.format_version='1.0';
   await resign(bad);const beforeInvalid=await snapshot();await rejects(()=>api.restoreWorkspaceBackup(bad),mode);eq(await snapshot(),beforeInvalid,'rejected restore preserves workspace');
  }
  const restoreBefore=await snapshot();
  IDBObjectStore.prototype.add=function(value,...args){if(this.name==='cashbook_transfers')throw new DOMException('Injected header failure','QuotaExceededError');return add.call(this,value,...args);};
  try{await rejects(()=>api.restoreWorkspaceBackup(backup),'restore storage failure');}finally{IDBObjectStore.prototype.add=add;}
  eq(await snapshot(),restoreBefore,'failed restore preserves every store');
  await api.restoreWorkspaceBackup(backup);eq(await snapshot(),restoreBefore,'complete transfer backup restore');
  return {ids:[one.transfer.id,reversed.transfer.id,negative.transfer.id],account:a.id};
 });
 await page.reload();
 const ids=await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers({})).map(t=>t.id));
 for(const id of result.ids)assert(ids.includes(id),'Transfer survives reload');
 if(process.env.BILLZEN_NATIVE_TRANSFER_FIXTURE){
  const fixture=JSON.parse(await readFile(process.env.BILLZEN_NATIVE_TRANSFER_FIXTURE,'utf8'));
  const output=await page.evaluate(async fixture=>{
   const api=await import('/src/adapters/tauri.ts');await api.restoreWorkspaceBackup(fixture);const b=await api.exportWorkspaceBackup();
   const canonical=(await import('/src/domain/backup_crypto.ts')).canonicalizeJson;
   const normalize=rows=>rows.map(row=>{const r={...row};for(const key of ['is_reversal','is_reversed'])if(key in r)r[key]=Boolean(r[key]);return r;}).sort((a,b)=>a.id.localeCompare(b.id));
   for(const key of ['cashbook_transfers','cashbook_vouchers','cashbook_movements','cashbook_audit_events'])if(canonical(normalize(b[key]))!==canonical(normalize(fixture[key])))throw Error('Interop changed '+key);
   return b;
  },fixture);
  await writeFile(process.env.BILLZEN_WEB_TRANSFER_FIXTURE,JSON.stringify(output));
 }
 // A genuine transfer-free legacy envelope is checked before any normalization.
 await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');const crypto=await import('/src/domain/backup_crypto.ts');const ws=await import('/src/adapters/web_workspace.ts');
  const b=await api.exportWorkspaceBackup();for(const key of Object.keys(b))if(Array.isArray(b[key]))b[key]=[];
  b.format_version='1.0';delete b.cashbook_transfers;const {checksum_sha256,...p}=b;b.checksum_sha256=await crypto.computePayloadChecksum(p);
  await api.restoreWorkspaceBackup(b);if((await ws.workspaceTransaction(false,t=>t.cashbook_transfers.length))!==0)throw Error('Legacy normalization failed');
  const bad={...b,cashbook_transfers:[]};let rejected=false;try{await api.restoreWorkspaceBackup(bad);}catch{rejected=true;}if(!rejected)throw Error('Checksum normalization bypass');
 });
 await page.reload();
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers()).length),0,'Legacy restore survives reload');
 console.log('PASS real IndexedDB transfers: concurrency, conflict, balance, warning, atomic abort, paired reversal, metrics, audit, reload');
} finally {await browser?.close();server?.kill('SIGTERM');}
