import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {navigateToAppTab} from './lib/navigation.js';
const url='http://127.0.0.1:4196';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4196','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);
 await page.goto(url+'/?tab=cashbook',{waitUntil:'domcontentloaded',timeout:30000});
 const ids=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');await api.updateBusinessSettings({...await api.getBusinessSettings(),business_name:'Synthetic Transfer Shop',is_setup_completed:true,guide_status:'completed'});
  const cash=await import('/src/adapters/cashbook.ts');const ids=[];for(const [name,opening,type] of [['Shop Cash',500000,'cash'],['Shop Bank',100000,'bank']])ids.push((await cash.createMoneyAccount({account_name:name,account_type:type,opening_balance_minor:opening,allow_negative_balance:false})).id);return ids;
 });await page.reload();
 await page.getByTestId('action-transfer-money').click();
 await page.getByTestId('transfer-from').selectOption(ids[0]);await page.getByTestId('transfer-to').selectOption(ids[1]);await page.getByTestId('transfer-amount').fill('2000');
 await page.getByTestId('transfer-preview').click();assert.match(await page.getByTestId('transfer-projections').textContent(),/3000.00/);await page.getByTestId('transfer-confirm').click();
 await page.getByTestId('transfer-entry').waitFor({state:'hidden'});
 const transfer=await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers())[0]);
 assert(transfer,'created');
 const balances=await page.evaluate(async ids=>(await (await import('/src/adapters/cashbook.ts')).getMoneyAccounts()).filter(a=>ids.includes(a.id)).map(a=>a.current_balance_minor),ids);assert.deepEqual(balances,[300000,300000]);
 const rows=page.getByTestId('cashbook-ledger-table').getByRole('row').filter({hasText:transfer.transfer_number});assert.equal(await rows.count(),2);assert.equal(await rows.getByTestId('btn-reverse-voucher').count(),0);
 await rows.first().getByTestId('btn-view-voucher').click();await page.getByTestId('transfer-detail').waitFor();
 assert.match(await page.getByTestId('transfer-detail').textContent(),/Shop Cash/);assert.match(await page.getByTestId('transfer-detail').textContent(),/Shop Bank/);
 await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});await page.getByTestId('transfer-print').click();await page.waitForFunction(()=>window.__printed);
 await page.emulateMedia({media:'print'});assert(await page.locator('#printable-transfer-root').isVisible());
 assert(await page.locator('#printable-transfer-root').evaluate(root=>root.querySelector('table').getBoundingClientRect().right<root.getBoundingClientRect().right-1),'Table outer border has print clipping clearance');
 await fs.mkdir('test_artifacts/transfers',{recursive:true});await page.pdf({path:'test_artifacts/transfers/transfer-a4.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 const pdfText=execFileSync('pdftotext',['test_artifacts/transfers/transfer-a4.pdf','-'],{encoding:'utf8'});
 for(const text of ['Synthetic Transfer Shop',transfer.transfer_number,transfer.business_date,'Posted','Shop Cash','Shop Bank'])assert(pdfText.includes(text),'PDF missing '+text);
 const before=await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers()).length);assert.equal(before,1,'printing does not post');
 await page.getByTestId('transfer-detail-close').click();await navigateToAppTab(page,'reports');await page.getByTestId('report-classification-select').selectOption('transfer');
 await page.getByTestId('report-matching-banner').waitFor();assert.match(await page.getByTestId('report-matching-banner').textContent(),/0\.00/);
 const download=page.waitForEvent('download');await page.getByTestId('btn-export-csv').click();const csv=await fs.readFile(await (await download).path(),'utf8');assert.match(csv,/Transfer In/);assert.match(csv,/Transfer Out/);assert.match(csv,/TRF-/);
 // Mixed receipt/expense plus both transfer legs must never inflate analytics.
 await page.evaluate(async ids=>{
  const cash=await import('/src/adapters/cashbook.ts');const {getTodayBusinessDate}=await import('/src/domain/financial.ts');const date=getTodayBusinessDate('Asia/Kolkata');
  for(const [direction,classification,amount] of [['inflow','operating_income',10000],['outflow','operating_expense',2500]])await cash.postCashbookVoucher({account_id:ids[0],idempotency_key:crypto.randomUUID(),business_date:date,direction,classification,amount_minor:amount,payment_method:'cash'});
 },ids);
 await page.reload();await navigateToAppTab(page,'dashboard');await page.getByTestId('tab-analytics').click();
 for(const account of ['all',ids[0],ids[1]]){
  await page.getByLabel('Filter Account',{exact:true}).selectOption(account);
  for(const period of ['today','month','year','today','month','today']){
   await page.getByTestId(`period-${period}`).click();
   if(account===ids[1])await page.waitForFunction(()=>document.querySelectorAll('[data-testid="analytics-bars-container"] [role="graphics-symbol"]').length===0);
   else await page.getByTestId('analytics-bars-container').locator('[role="graphics-symbol"]').first().waitFor();
   const labels=await page.getByTestId('analytics-bars-container').locator('[role="graphics-symbol"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
   if(account===ids[1])assert.deepEqual(labels,[],'transfer-only bank has no receipt/payment bars');
   else{assert(labels.some(s=>/100\.00/.test(s)&&/25\.00/.test(s)),labels.join('|'));assert(labels.every(s=>!s.includes('2000.00')));}
  }
 }
 await navigateToAppTab(page,'cashbook');await page.getByTestId('cashbook-ledger-table').getByRole('row').filter({hasText:transfer.transfer_number}).first().getByTestId('btn-view-voucher').click();await page.getByTestId('transfer-reverse').click();await page.getByTestId('transfer-reverse-confirm').click();await page.getByTestId('transfer-reverse-confirm').waitFor({state:'hidden'});
 const headers=await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers()));assert.equal(headers.length,2);assert(headers.find(h=>h.id===transfer.id).is_reversed);
 // Simulate a lost acknowledgement AFTER IndexedDB commits, then retry the same intent.
 await page.getByTestId('transfer-detail-close').click();await page.getByTestId('action-transfer-money').click();
 await page.getByTestId('transfer-from').selectOption(ids[0]);await page.getByTestId('transfer-to').selectOption(ids[1]);await page.getByTestId('transfer-amount').fill('1');await page.getByTestId('transfer-preview').click();
 await page.evaluate(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');window.__completeDescriptor=descriptor;
  Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(handler){
   if(this.mode==='readwrite'&&this.objectStoreNames.contains('cashbook_transfers')){
    const tx=this;descriptor.set.call(this,function(event){if(!window.__lostAck){window.__lostAck=true;tx.onerror?.(new Event('error'));}else handler.call(tx,event);});
   }else descriptor.set.call(this,handler);
  }});
 });
 await page.getByTestId('transfer-confirm').click();await page.getByRole('alert').filter({hasText:'Not confirmed'}).waitFor();
 await page.evaluate(()=>Object.defineProperty(IDBTransaction.prototype,'oncomplete',window.__completeDescriptor));
 await page.getByTestId('transfer-confirm').click();await page.getByTestId('transfer-entry').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers()).length),3,'lost acknowledgement retry posted once');
 await page.getByTestId('action-transfer-money').click();await page.getByTestId('transfer-from').selectOption(ids[0]);await page.getByTestId('transfer-to').selectOption(ids[1]);await page.getByTestId('transfer-amount').fill('10000');await page.getByTestId('transfer-preview').click();await page.getByTestId('transfer-confirm').click();await page.getByTestId('transfer-warning').waitFor();
 assert.equal(await page.evaluate(async()=> (await (await import('/src/adapters/transfers.ts')).getCashbookTransfers()).length),3,'warning posts nothing');await page.getByTestId('transfer-edit').click();await page.getByTestId('transfer-amount').fill('10001');await page.getByTestId('transfer-preview').click();await page.getByTestId('transfer-confirm').click();await page.getByTestId('transfer-warning').waitFor();await page.getByTestId('transfer-confirm').click();await page.getByTestId('transfer-entry').waitFor({state:'hidden'});
 for(const [width,language,theme] of [[360,'en','light'],[390,'ml','dark'],[768,'ar','system'],[1280,'en','dark']]){
  await page.evaluate(({language,theme})=>{localStorage.setItem('billzen_ui_language',language);localStorage.setItem('billzen_appearance_pref',theme);},{language,theme});
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce',colorScheme:theme==='light'?'light':'dark'});await page.reload();await navigateToAppTab(page,'cashbook');
  const trigger=page.getByTestId('action-transfer-money');await trigger.focus();await page.keyboard.press('Enter');await page.getByTestId('transfer-entry').waitFor();
  const dialog=page.getByRole('dialog');const bounds=await dialog.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1,'dialog fits viewport');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no page overflow');
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'focus trapped');}
  await page.screenshot({path:`test_artifacts/transfers/dialog-${width}-${language}-${theme}.png`});
  await page.evaluate(()=>window.dispatchEvent(new Event('billzen-back-button')));await page.getByTestId('transfer-entry').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='action-transfer-money');
 }
 console.log('PASS mixed analytics Today/Month/Year/all/source/destination; lost acknowledgement retry; negative warning; responsive/theme/RTL/focus/Back');
 console.log('PASS Transfer UI: preview/post, correct balances, pair detail/print, report/CSV and paired reversal');
}finally{await browser?.close();server.kill('SIGTERM');}
