import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const url='http://127.0.0.1:4196';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4196','--strictPort'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}if(i===99)throw Error('Test server unavailable');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto(url);
 const result=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts'),stock=await import('/src/adapters/stock.ts');
  const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label+': '+JSON.stringify(a));};
  const rejects=async(fn,label)=>{let rejected=false;try{await fn();}catch{rejected=true;}if(!rejected)throw Error('Accepted '+label);};
  await api.updateBusinessSettings({...await api.getBusinessSettings(),is_setup_completed:true,guide_status:'completed'});
  const product=await api.createProduct({sku:'STOCK-TEST',name:'Stock test',unit_price_minor:100,is_stock_tracked:true,opening_stock_scaled:50000});
  const input={id:crypto.randomUUID(),product_id:product.id,quantity_delta_scaled:20000,business_date:'2026-10-23',reason:'Purchased20'};
  const [a,b]=await Promise.all([stock.postStockAdjustment(input),stock.postStockAdjustment(input)]);
  eq(a.id,b.id,'retry');eq(a.resulting_stock_scaled,70000,'restock');
  await rejects(()=>stock.postStockAdjustment({...input,quantity_delta_scaled:1000}),'changed retry');
  const fresh=async()=> (await api.getProducts({})).find(p=>p.id===product.id);
  await stock.postStockAdjustment({...input,id:crypto.randomUUID(),quantity_delta_scaled:-2000,reason:'Damaged2'});
  eq((await fresh()).current_stock_scaled,68000,'reduction');
  const history=await stock.getStockHistory(product.id);eq(history.length,3,'opening and adjustments');
  for(const patch of [{quantity_delta_scaled:-69000},{quantity_delta_scaled:0},{quantity_delta_scaled:.5},{reason:''},{business_date:'2026-02-30'},{quantity_delta_scaled:1000000001},{id:'invalid'}])
   await rejects(()=>stock.postStockAdjustment({...input,id:crypto.randomUUID(),...patch}),'invalid '+JSON.stringify(patch));
  const reversal={...input,id:crypto.randomUUID(),quantity_delta_scaled:-20000,reason:'Correction',reversal_of:a.id};
  const undone=await stock.postStockAdjustment(reversal);eq(undone.resulting_stock_scaled,48000,'corrected balance');
  await stock.postStockAdjustment(reversal);
  await rejects(()=>stock.postStockAdjustment({...reversal,id:crypto.randomUUID()}),'second correction');
  await rejects(()=>stock.postStockAdjustment({...input,id:crypto.randomUUID(),quantity_delta_scaled:20000,reversal_of:undone.id}),'correct correction');
  const before=await stock.getStockHistory(product.id);
  const clear=IDBObjectStore.prototype.clear;
  IDBObjectStore.prototype.clear=function(){throw Error('No-op retry must not write');};
  try{await stock.postStockAdjustment(input);}finally{IDBObjectStore.prototype.clear=clear;}

  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...args){if(this.name==='stock_movements'&&value.id===input.abortId)throw Error('Injected write failure');return put.call(this,value,...args);};
  input.abortId=crypto.randomUUID();
  try{await rejects(()=>stock.postStockAdjustment({...input,id:input.abortId}),'aborted write');}finally{IDBObjectStore.prototype.put=put;}
  eq((await fresh()).current_stock_scaled,48000,'failed transaction balance');eq((await stock.getStockHistory(product.id)).length,before.length,'failed transaction history');
  const backup=await api.exportWorkspaceBackup();await api.restoreWorkspaceBackup(backup);
  eq((await fresh()).current_stock_scaled,48000,'backup balance');eq((await stock.getStockHistory(product.id)).length,4,'backup history');
  await api.archiveProduct(product.id);await stock.postStockAdjustment(input);
  await rejects(()=>stock.postStockAdjustment({...input,id:crypto.randomUUID()}),'archived');
  eq((await stock.getStockHistory(product.id)).length,4,'archived history');await api.restoreProduct(product.id);
  const untracked=await api.createProduct({sku:'SERVICE',name:'Service',unit_price_minor:100,is_stock_tracked:false});
  await rejects(()=>stock.postStockAdjustment({...input,id:crypto.randomUUID(),product_id:untracked.id}),'untracked');
  const tiny=await api.createProduct({sku:'TINY',name:'Tiny stock',unit_price_minor:1,is_stock_tracked:true});
  const small={...input,id:crypto.randomUUID(),product_id:tiny.id,quantity_delta_scaled:1};
  await stock.postStockAdjustment(small);
  await Promise.all([stock.postStockAdjustment({...small,id:crypto.randomUUID()}),stock.postStockAdjustment({...small,id:crypto.randomUUID()})]);
  eq((await api.getProducts({})).find(p=>p.id===tiny.id).current_stock_scaled,3,'concurrent distinct fractional stock');
  await stock.postStockAdjustment({...small,id:crypto.randomUUID(),quantity_delta_scaled:999999997});
  await rejects(()=>stock.postStockAdjustment({...small,id:crypto.randomUUID()}),'maximum result');
  return product.id;
 });
 assert(result);await page.reload();const count=await page.evaluate(async id=>(await (await import('/src/adapters/stock.ts')).getStockHistory(id)).length,result);assert.equal(count,4);
 console.log('PASS stock browser engine: exact quantities, concurrent retries, guards, corrections, atomic rollback, backup and reload');
}finally{await browser?.close();server.kill('SIGTERM');}
