import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,channel:"chrome"});
try {
 const page = await browser.newPage();
 await page.route('**/upgrade-fixture', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Upgrade fixture</title>'}));
 await page.goto('http://localhost:5173/upgrade-fixture');
 await page.evaluate(async()=> {
  await new Promise((resolve,reject)=> {
   const r=indexedDB.open('BillZen_Web_DB',1);
   r.onupgradeneeded=()=> {
    for(const name of ['money_accounts','cashbook_categories','cashbook_parties','cashbook_vouchers','cashbook_movements','cashbook_sequences','cashbook_audit_events']) r.result.createObjectStore(name,{keyPath:name==='cashbook_sequences'?'sequence_key':'id'});
   };
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=> {const db=r.result;const tx=db.transaction('money_accounts','readwrite');tx.objectStore('money_accounts').put({id:'upgrade-marker',account_name:'Preserved account',opening_balance_minor:12345});tx.oncomplete=()=>{db.close();resolve();};};
  });
 });
 await page.goto('http://localhost:5173');
 const id = await page.evaluate(async()=> {
  const api=await import('/src/adapters/tauri.ts');
  const c=await api.createCustomer({name:'Persistent customer',country:'IND'});
  await api.createCategory({name:'Persistent category'});
  await api.createProduct({sku:'PERSIST',name:'Persistent product',unit:'unit',unit_price_minor:1000,cost_price_minor:600,tax_rate_bp:0,is_stock_tracked:true,opening_stock_scaled:2000,min_stock_threshold_scaled:1000});
  const db=await (await import('/src/adapters/web_cashbook_db.ts')).openWebDb();
  await new Promise((resolve,reject)=> {const tx=db.transaction('money_accounts');const r=tx.objectStore('money_accounts').get('upgrade-marker');r.onsuccess=()=>r.result?.opening_balance_minor===12345?resolve():reject(Error('Upgrade lost account'));});
  return c.id;
 });
 await page.reload();
 const result=await page.evaluate(async()=> {
  const api=await import('/src/adapters/tauri.ts');
  return {customers:await api.getCustomers(),products:await api.getProducts(),categories:await api.getCategories()};
 });
 assert(result.customers.some(c=>c.id===id),'Customer must survive browser reload');
 assert.equal(result.products[0].current_stock_scaled,2000);
 assert.equal(result.categories[0].name,'Persistent category');
 await page.evaluate(async(id)=> {
  const api=await import('/src/adapters/tauri.ts');
  await api.archiveCustomer(id);
  const rows=await api.getCustomers({is_active:false});
  if (!rows.some(c=>c.id===id)) throw Error('Archive missing');
  await api.restoreCustomer(id);
  await Promise.all(Array.from({length:5},(_,n)=>api.createCustomer({name:'Concurrent '+n,country:'IND'})));
  let rejected=false;
  try {await api.createCategory({name:'persistent CATEGORY'});} catch {rejected=true;}
  if (!rejected) throw Error('Duplicate category accepted');
  if ((await api.getCategories()).length!==1) throw Error('Failed write was not rolled back');
  const product=(await api.getProducts())[0];
  await api.updateProduct({...product,name:'Updated product'});
  await api.archiveProduct(product.id);
  await api.restoreProduct(product.id);
 },id);
 await page.reload();
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/tauri.ts')).getCustomers()).length),6);
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/tauri.ts')).getProducts())[0].name),'Updated product');
 console.log('PASS: v1 upgrade preserved cashbook; reload, archive/restore, concurrent writes, duplicate rejection');
} finally {await browser.close();}
