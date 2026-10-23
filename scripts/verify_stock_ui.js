import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {navigateToAppTab} from './lib/navigation.js';
await fs.mkdir('test_artifacts/stock',{recursive:true});
const url='http://127.0.0.1:4197';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}if(i===99)throw Error('Server unavailable');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});await page.goto(url);
 await page.evaluate(async()=>{const api=await import('/src/adapters/tauri.ts');await api.updateBusinessSettings({...await api.getBusinessSettings(),is_setup_completed:true,guide_status:'completed'});await api.createProduct({sku:'UI-STOCK',name:'Sample product',unit_price_minor:25000,is_stock_tracked:true,opening_stock_scaled:50000});});
 await page.reload();await navigateToAppTab(page,'products');await page.getByTestId('manage-stock-UI-STOCK').click();
 await page.getByTestId('stock-quantity').fill('20');await page.getByTestId('stock-reason').fill('Received delivery');
 assert((await page.getByTestId('stock-preview').innerText()).includes('70'));
 await page.getByTestId('stock-confirm').click();
 const balance=()=>page.evaluate(async()=>{const p=(await (await import('/src/adapters/tauri.ts')).getProducts({})).find(p=>p.sku==='UI-STOCK');return p.current_stock_scaled;});
 await page.waitForFunction(async()=>{const p=(await (await import('/src/adapters/tauri.ts')).getProducts({})).find(p=>p.sku==='UI-STOCK');return p.current_stock_scaled===70000;});
 // Dialog can stay open after save; reopen if the component intentionally closes.
 if(!await page.getByTestId('stock-dialog').isVisible())await page.getByTestId('manage-stock-UI-STOCK').click();
 await page.getByTestId('stock-mode-reduce').click();await page.getByTestId('stock-quantity').fill('71');await page.getByTestId('stock-reason').fill('Damaged');
 assert(await page.getByTestId('stock-confirm').isDisabled(),'insufficient stock blocked');
 await page.getByTestId('stock-quantity').fill('2');await page.getByTestId('stock-confirm').click();
 await page.waitForFunction(async()=>{const p=(await (await import('/src/adapters/tauri.ts')).getProducts({})).find(p=>p.sku==='UI-STOCK');return p.current_stock_scaled===68000;});
 if(!await page.getByTestId('stock-dialog').isVisible())await page.getByTestId('manage-stock-UI-STOCK').click();
 await page.getByTestId('stock-mode-history').click();
 const original=await page.evaluate(async()=>{const api=await import('/src/adapters/tauri.ts'),s=await import('/src/adapters/stock.ts');const p=(await api.getProducts({})).find(p=>p.sku==='UI-STOCK');return (await s.getStockHistory(p.id)).find(m=>m.quantity_delta_scaled===20000).id;});
 await page.getByTestId('stock-correct-'+original).click();await page.getByTestId('stock-reason').fill('Wrong delivery count');await page.getByTestId('stock-confirm').click();
 await page.waitForFunction(async()=>{const p=(await (await import('/src/adapters/tauri.ts')).getProducts({})).find(p=>p.sku==='UI-STOCK');return p.current_stock_scaled===48000;});
 if(await page.getByTestId('stock-dialog').isVisible())await page.keyboard.press('Escape');
 assert.equal(await balance(),48000);
 // Unknown storage failure keeps one exact retry; known stale-balance rejection unlocks editing.
 await page.getByTestId('manage-stock-UI-STOCK').click();await page.getByTestId('stock-mode-add').click();
 await page.getByTestId('stock-quantity').fill('1');await page.getByTestId('stock-reason').fill('Retry delivery');
 await page.evaluate(()=>{window.__originalStockPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='stock_movements')throw Error('Injected storage failure');return window.__originalStockPut.call(this,value,...args);};});
 await page.getByTestId('stock-confirm').click();await page.getByTestId('stock-error').waitFor();
 assert(await page.getByTestId('stock-quantity').isDisabled(),'unknown outcome freezes intent');assert.equal(await balance(),48000);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__originalStockPut;});await page.getByTestId('stock-confirm').click();
 await page.waitForFunction(async()=>{const p=(await (await import('/src/adapters/tauri.ts')).getProducts({})).find(p=>p.sku==='UI-STOCK');return p.current_stock_scaled===49000;});
 await page.getByTestId('stock-mode-reduce').click();await page.getByTestId('stock-quantity').fill('49');await page.getByTestId('stock-reason').fill('Stale stock test');
 await page.evaluate(async()=>{const api=await import('/src/adapters/tauri.ts'),s=await import('/src/adapters/stock.ts');const p=(await api.getProducts({})).find(p=>p.sku==='UI-STOCK');await s.postStockAdjustment({id:crypto.randomUUID(),product_id:p.id,quantity_delta_scaled:-1000,business_date:'2026-10-23',reason:'Concurrent adjustment'});});
 await page.getByTestId('stock-confirm').click();await page.getByTestId('stock-error').waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-testid="stock-quantity"]').disabled);assert.equal(await balance(),48000);await page.keyboard.press('Escape');
 for(const [width,height,language,theme] of [[360,420,'en','light'],[900,440,'ml','dark'],[390,700,'ar','dark']]){
  await page.setViewportSize({width,height});await page.evaluate(({language,theme})=>{localStorage.setItem('billzen_ui_language',language);localStorage.setItem('billzen_appearance_pref',theme);},{language,theme});await page.reload();await navigateToAppTab(page,'products');
  const trigger=page.getByTestId(width>=768?'manage-stock-UI-STOCK':'manage-stock-mobile-UI-STOCK');
  await trigger.click();await page.getByTestId('stock-mode-history').click();await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
  const dialog=page.getByTestId('stock-dialog');assert(await dialog.isVisible());
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'focus contained');}
  await page.screenshot({path:`test_artifacts/stock/ui-${width}-${language}-${theme}.png`});
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
 }
 console.log('PASS stock UI: preview/add/reduce/insufficient/correction/history, short viewport, themes, RTL and keyboard');
}finally{await browser?.close();server.kill('SIGTERM');}
