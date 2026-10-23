import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {navigateToAppTab} from './lib/navigation.js';
await fs.mkdir('test_artifacts/reports-refresh',{recursive:true});
const url='http://127.0.0.1:4198';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4198','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(15000);await page.goto(url+'/?tab=reports');
 await page.evaluate(async()=>{const api=await import('/src/adapters/tauri.ts');await api.updateBusinessSettings({...await api.getBusinessSettings(),is_setup_completed:true,guide_status:'completed'});const cash=await import('/src/adapters/cashbook.ts');const a=(await cash.getMoneyAccounts())[0];const date=(await import('/src/domain/financial.ts')).getTodayBusinessDate('Asia/Kolkata');for(let i=0;i<35;i++)await cash.postCashbookVoucher({account_id:a.id,idempotency_key:'responsive-'+i,business_date:date,direction:'inflow',classification:'operating_income',payment_method:'cash',amount_minor:100+i,notes:i===34?'LAST VISIBLE RECORD':'Synthetic row '+i});});await page.reload();
 await page.getByTestId('report-filters').waitFor();
 const group=page.getByTestId('report-period-control');assert.equal(await group.locator('[data-segmented-capsule]').count(),1);
 for(const id of ['month','year','today','custom','today']){await page.getByTestId('report-period-'+id).click();await page.waitForTimeout(600);const valid=await group.evaluate(el=>{const active=el.querySelector('[aria-pressed=true]'),capsule=el.querySelector('[data-segmented-capsule]');const inset=capsule.style.clipPath.match(/inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px/);return inset&&Math.abs(+inset[4]-active.offsetLeft)<1;});assert(valid,'capsule follows selected period');}
 // Retarget from current painted geometry instead of leaving queued/stacked pills.
 const clip=()=>group.locator('[data-segmented-capsule]').evaluate(el=>el.style.clipPath);
 const start=await clip();await page.getByTestId('report-period-year').click();await page.waitForTimeout(90);
 assert.notEqual(await clip(),start,'capsule moves during pointer transition');
 await page.getByTestId('report-period-month').click();await page.getByTestId('report-period-today').click();await page.waitForTimeout(650);
 await page.getByTestId('report-period-today').focus();await page.keyboard.press('End');assert.equal(await page.getByTestId('report-period-custom').getAttribute('aria-pressed'),'true');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByTestId('report-period-today').click();await page.waitForTimeout(50);
 assert.equal(await page.getByTestId('report-period-today').getAttribute('aria-pressed'),'true');
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const [width,height,lang] of [[360,420,'en'],[900,440,'ml'],[1080,540,'ar'],[1440,900,'en']]){
  await page.setViewportSize({width,height});await page.evaluate(lang=>localStorage.setItem('billzen_ui_language',lang),lang);await page.reload();await navigateToAppTab(page,'reports');
  await page.getByTestId('report-filters').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
  await page.locator('[data-testid^="report-row-"]').last().scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(150);
  const reachable=await page.locator('[data-testid^="report-row-"]').last().evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('.app-mobile-nav'),n=nav?.getBoundingClientRect();return r.bottom<=innerHeight+1&&(!n||!nav.getClientRects().length||r.bottom<=n.top+1);});if(!reachable)console.log({width,height,geometry:await page.evaluate(()=>({scrollY,innerHeight,scrollHeight:document.documentElement.scrollHeight,nav:document.querySelector('.app-mobile-nav')?.getBoundingClientRect().toJSON(),row:document.querySelector('[data-testid^="report-row-"]:last-child')?.getBoundingClientRect().toJSON(),padding:getComputedStyle(document.querySelector('.app-main')).paddingBottom}))});assert(reachable,'final report row reachable above fixed navigation');
  await page.screenshot({path:`test_artifacts/reports-refresh/reports-bottom-${width}-${height}-${lang}.png`,fullPage:false});
  await page.evaluate(()=>window.scrollTo(0,0));await page.getByTestId('report-filters').scrollIntoViewIfNeeded();await page.screenshot({path:`test_artifacts/reports-refresh/reports-filters-${width}-${height}-${lang}.png`,fullPage:false});
 }
 await page.setViewportSize({width:1280,height:800});
 for(const [tab,groupId,target] of [['dashboard','dashboard-period-control','period-month'],['dashboard','dashboard-mode-control','tab-analytics'],['settings','appearance-control','appearance-option-dark']]){
  await navigateToAppTab(page,tab);const controls=page.getByTestId(groupId);await controls.waitFor();
  await page.getByTestId(target).click();await page.waitForTimeout(650);
  assert(await controls.evaluate(el=>{const active=el.querySelector('[aria-pressed=true]'),capsule=el.querySelector('[data-segmented-capsule]');const inset=capsule.style.clipPath.match(/inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px/);return inset&&Math.abs(+inset[4]-active.offsetLeft)<1;}),'shared selection capsule aligns in '+groupId);
 }
 await navigateToAppTab(page,'reports');await page.getByTestId('report-filters').waitFor();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(650);await page.screenshot({path:'test_artifacts/reports-refresh/reports-dark.png'});
 const config=JSON.parse(await fs.readFile('src-tauri/tauri.conf.json','utf8'));assert(config.app.windows[0].minHeight<=420&&config.app.windows[0].minWidth<=390,'desktop allows responsive short/narrow windows');
 console.log('PASS Reports structure, shared capsule alignment, short-window scrolling and desktop minimum geometry');
}finally{await browser?.close();server.kill('SIGTERM');}
