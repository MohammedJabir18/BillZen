const baseUrl=process.env.BILLZEN_TEST_URL || 'http://localhost:5173';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();
 const holder=await context.newPage();
 await context.route('**/upgrade-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}));
 await holder.goto(baseUrl+'/upgrade-fixture');
 await holder.evaluate(async()=>{window.heldDb=await new Promise((resolve,reject)=>{const r=indexedDB.open('BillZen_Web_DB',1);r.onupgradeneeded=()=>r.result.createObjectStore('money_accounts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});});
 const page=await context.newPage();await page.goto(baseUrl+'/upgrade-fixture');
 const message=await page.evaluate(async()=>{try{await (await import('/src/adapters/web_cashbook_db.ts')).openWebDb();return 'unexpected success';}catch(error){return String(error);}});
 assert.match(message,/Close other BillZen tabs/);
 await holder.evaluate(()=>window.heldDb.close());
 console.log('PASS blocked database upgrade explains close-other-tabs recovery');
}finally{await browser.close();}
