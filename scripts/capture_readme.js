// Reproducible product media: isolated browser context and fictional records only.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {navigateToAppTab} from './lib/navigation.js';
const out='docs/assets/current';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const url=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const seed=await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts'),cash=await import('/src/adapters/cashbook.ts');
  const current=await api.getBusinessSettings();
  await api.updateBusinessSettings({...current,business_name:'Palm & Pine Trading',is_setup_completed:true,guide_status:'completed',appearance_preference:'dark'});
  localStorage.setItem('billzen_appearance_pref','dark');localStorage.setItem('billzen_ui_language','en');
  const today=(await import('/src/domain/financial.ts')).getTodayBusinessDate(current.timezone);
  const prior=days=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-days);return date.toISOString().slice(0,10);};
  const till=await cash.createMoneyAccount({account_name:'Shop Cash',account_type:'cash',opening_balance_minor:2500000,allow_negative_balance:false});
  const bank=await cash.createMoneyAccount({account_name:'Business Bank',account_type:'bank',opening_balance_minor:8000000,allow_negative_balance:false});
  const parties=[];
  for(const name of ['Aster Cafe','Harbor Studio','Orchid Market']){
   const customer=await api.createCustomer({name,country:'India'});
   parties.push(await(await import('/src/adapters/customer_cashbook.ts')).ensureCustomerCashbookParty({customer_id:customer.id}));
  }
  for(let i=0;i<8;i++){
   await cash.postCashbookVoucher({account_id:till.id,party_id:parties[i%3].id,business_date:prior(i),direction:'inflow',classification:'operating_income',payment_method:'cash',amount_minor:[185000,342000,128000,472000,291000,368000,215000,427000][i],notes:['Project payment','Counter collection','Service payment'][i%3],idempotency_key:crypto.randomUUID()});
   await cash.postCashbookVoucher({account_id:till.id,business_date:prior(i),direction:'outflow',classification:'operating_expense',payment_method:'cash',amount_minor:[48500,92000,36000,154000,82000,115000,56000,68000][i],notes:['Packaging supplies','Shop utilities','Courier charges'][i%3],idempotency_key:crypto.randomUUID()});
  }
  await(await import('/src/adapters/transfers.ts')).postCashbookTransfer({from_account_id:till.id,to_account_id:bank.id,amount_minor:500000,business_date:prior(2),reference_note:'Weekly cash deposit',idempotency_key:crypto.randomUUID()});
  for(const [sku,name,price,stock]of[['NOTE-A5','A5 desk notebook',12900,50000],['ROLL-80','80 mm receipt roll',6900,24000],['USB-C','USB-C charging cable',24900,8000],['WRAP','Premium gift wrap',4900,120000]]){
   const product=await api.createProduct({sku,name,unit_price_minor:price,is_stock_tracked:true,opening_stock_scaled:stock});
   if(sku==='NOTE-A5')await(await import('/src/adapters/stock.ts')).postStockAdjustment({id:crypto.randomUUID(),product_id:product.id,quantity_delta_scaled:20000,business_date:today,reason:'New delivery received'});
  }
  return {today,synthetic:true};
 });
 await page.reload();await page.waitForTimeout(900);
 const capture=async(name)=>{await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(650);await page.screenshot({path:`${out}/${name}.png`});};
 await navigateToAppTab(page,'dashboard');await capture('dashboard-dark');
 await page.getByTestId('tab-analytics').click();await page.getByTestId('period-month').click();await capture('analytics-dark');
 await navigateToAppTab(page,'cashbook');await capture('cashbook-dark');
 await navigateToAppTab(page,'reports');await page.getByTestId('report-period-month').click();await capture('reports-dark');
 await navigateToAppTab(page,'products');await capture('products-dark');
 await page.getByTestId('manage-stock-NOTE-A5').click();await page.getByTestId('stock-mode-history').click();await capture('stock-history-dark');await page.keyboard.press('Escape');
 await navigateToAppTab(page,'customers');await capture('customers-dark');
 await navigateToAppTab(page,'settings');await page.getByTestId('appearance-option-light').click();await capture('settings-light');
 await navigateToAppTab(page,'dashboard');await capture('dashboard-light');
 await page.setViewportSize({width:390,height:844});await capture('dashboard-mobile');
 await page.evaluate(()=>localStorage.setItem('billzen_ui_language','ar'));await page.reload();await navigateToAppTab(page,'dashboard');await capture('dashboard-arabic-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await fs.writeFile('test_artifacts/readme-refresh/media-capture.json',JSON.stringify({...seed,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),viewport:[1440,960],mobile:[390,844],storage:'IndexedDB in isolated browser context',nativePersistenceEvidence:false},null,2));
 console.log('Captured11 current screens with fictional persistent browser data. No real/native workspace touched.');
}finally{await browser.close();await server.close();}
