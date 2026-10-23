const baseUrl=process.env.BILLZEN_TEST_URL || 'http://localhost:5173';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();await page.goto(baseUrl);
 const result=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');
  const crypto=await import('/src/domain/backup_crypto.ts');
  const product=await api.createProduct({sku:'RESTORE',name:'Stock',unit:'unit',unit_price_minor:1000,is_stock_tracked:true,opening_stock_scaled:2500});
  const customer=await api.createCustomer({name:'Restore customer',country:'IND'});
  const cash=await import('/src/adapters/cashbook.ts');
  const bridge=await import('/src/adapters/web_customer_cashbook.ts');
  const party=await bridge.ensureWebCustomerCashbookParty({customer_id:customer.id});
  const account=(await cash.getMoneyAccounts())[0];
  const posted=await cash.postCashbookVoucher({idempotency_key:'restore-receipt',account_id:account.id,party_id:party.id,amount_minor:12000,business_date:'2026-10-23',direction:'inflow',classification:'operating_income',payment_method:'cash'});
  await cash.reverseCashbookVoucher(posted.id,false);
  const backup=await api.exportWorkspaceBackup();
  if(backup.stock_movements.length!==1) throw Error('Missing opening stock ledger');
  await api.archiveCustomer(customer.id);
  let currencyBlocked=false;
  try{await api.updateBusinessProfile({...await api.getBusinessSettings(),currency_code:'KWD',currency_exponent:3});}catch{currencyBlocked=true;}
  if(!currencyBlocked)throw Error('Historical currency change accepted');
  const restored=await api.restoreWorkspaceBackup(backup);
  if(!(await api.getCustomers()).find(c=>c.id===customer.id)?.is_active) throw Error('Catalog not restored');
  if(!restored.restored_tables.includes('stock_movements')) throw Error('Incomplete restore coverage');
  const invalid=structuredClone(backup); invalid.products[0].category_id='missing';
  const {checksum_sha256,...payload}=invalid;invalid.checksum_sha256=await crypto.computePayloadChecksum(payload);
  let rejected=false;try{await api.restoreWorkspaceBackup(invalid);}catch{rejected=true;}
  if(!rejected)throw Error('Dangling reference accepted');
  const unsupported=structuredClone(backup);unsupported.invoices=[{id:'unsupported'}];
  const {checksum_sha256:_,...payload2}=unsupported;unsupported.checksum_sha256=await crypto.computePayloadChecksum(payload2);
  rejected=false;try{await api.restoreWorkspaceBackup(unsupported);}catch{rejected=true;}
  if(!rejected)throw Error('Unsupported commercial data silently accepted');
  for(const corrupt of ['sequence','reversal','movement']) {
   const b=structuredClone(backup);
   if(corrupt==='sequence') b.cashbook_sequences=[];
   if(corrupt==='reversal') b.cashbook_vouchers.find(v=>!v.is_reversal).is_reversed=false;
   if(corrupt==='movement') b.cashbook_movements[0].amount_minor++;
   const {checksum_sha256,...p}=b;b.checksum_sha256=await crypto.computePayloadChecksum(p);
   rejected=false;try{await api.restoreWorkspaceBackup(b);}catch{rejected=true;}
   if(!rejected)throw Error('Corrupt '+corrupt+' accepted');
  }
  const add=IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add=function(value,...args){if(this.name==='customers')throw new DOMException('Injected quota failure','QuotaExceededError');return add.call(this,value,...args);};
  rejected=false;try{await api.restoreWorkspaceBackup(backup);}catch{rejected=true;}finally{IDBObjectStore.prototype.add=add;}
  if(!rejected)throw Error('Injected storage failure ignored');
  const after=await api.exportWorkspaceBackup();
  if(JSON.stringify(after.products)!==JSON.stringify(backup.products)) throw Error('Rejected restore changed workspace');
  if(JSON.stringify(after.cashbook_vouchers)!==JSON.stringify(backup.cashbook_vouchers))throw Error('Failed restore changed vouchers');
  // Fresh database restore also preserves IDs and complete linked history.
  const db=await (await import('/src/adapters/web_cashbook_db.ts')).openWebDb();db.close();
  return {product:product.id,customer:customer.id,backup};
 });
 // A new origin sandbox database is cleared only in this ephemeral browser context.
 await page.goto(baseUrl+'/@vite/client');
 await page.evaluate(async()=>new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('BillZen_Web_DB');r.onsuccess=resolve;r.onerror=()=>reject(r.error);}));
 await page.goto(baseUrl);
 await page.evaluate(async(backup)=>{await (await import('/src/adapters/tauri.ts')).restoreWorkspaceBackup(backup);},result.backup);
 await page.reload();
 assert(await page.evaluate(async({product,customer})=>{
  const api=await import('/src/adapters/tauri.ts');return (await api.getProducts()).some(p=>p.id===product)&&(await api.getCustomers()).some(c=>c.id===customer&&c.is_active);
 },result));
 await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');const crypto=await import('/src/domain/backup_crypto.ts');
  const b=await api.exportWorkspaceBackup();for(const [key,value] of Object.entries(b))if(Array.isArray(value))b[key]=[];
  b.business_settings={...b.business_settings,business_name:'Empty KWD business',currency_code:'KWD',currency_exponent:3,tax_identifier:null};
  const {checksum_sha256,...payload}=b;b.checksum_sha256=await crypto.computePayloadChecksum(payload);await api.restoreWorkspaceBackup(b);
  localStorage.setItem('billzen_browser_settings',JSON.stringify({...b.business_settings,business_name:'Stale cache',currency_code:'INR',currency_exponent:2}));
 });
 await page.reload();
 await page.evaluate(async()=>{const api=await import('/src/adapters/tauri.ts');const cash=await import('/src/adapters/cashbook.ts');const b=await api.exportWorkspaceBackup();if(b.money_accounts.length||b.cashbook_categories.length)throw Error('Reload reseeded restored empty workspace');if((await api.getBusinessSettings()).currency_code!=='KWD')throw Error('Stale cache overrides restored settings');const a=await cash.createMoneyAccount({account_name:'KWD cash',account_type:'cash',opening_balance_minor:0,allow_negative_balance:false});if(a.currency_code!=='KWD'||a.currency_exponent!==3)throw Error('Cashbook ignores durable settings');});
 console.log('PASS workspace opening ledger, restore, references, unsupported data rejection, reload');
}finally{await browser.close();}
