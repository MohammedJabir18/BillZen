import { _android } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { navigateToAppTab } from './lib/navigation.js';
const adb=process.env.BILLZEN_ADB || '/home/jabir/.android-toolchain/android-sdk/platform-tools/adb';
const serial=process.env.BILLZEN_TEST_EMULATOR || 'emulator-5554';
const output='test_artifacts/android_candidate';fs.mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:30000}).trim();
assert.ok(serial.startsWith('emulator-'),'Only a dedicated emulator is accepted');
assert.ok(run('emu','avd','name').split(/\r?\n/)[0]==='billzen_test_avd','Refuse a non-test AVD');
const mode=process.argv[2];assert.ok(['snapshot','verify'].includes(mode),'Usage: snapshot | verify');
const checks=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const stage=message=>console.log(`[candidate] ${message}`);
const watchdog=setTimeout(()=>{console.error('Android candidate timed out after 180 seconds');process.exit(1);},180000);
async function connect(){
 stage('Starting native activity');
 run('shell','am','start','-n','com.billzen.desktop/.MainActivity');
 const devices=await _android.devices({host:'127.0.0.1',port:5037});
 const device=devices.find(device=>device.serial()===serial);
 assert.ok(device,'Dedicated test emulator must be connected');
 stage('Connecting test WebView');
 const webview=await device.webView({pkg:'com.billzen.desktop',timeout:30000});
 const page=await webview.page();
 page.setDefaultTimeout(30000);
 stage('Waiting for native IPC');
 await page.waitForFunction(()=>Boolean(window.__TAURI_INTERNALS__?.invoke));
 const browser=device;
 return {browser,page};
}
async function readState(page){return page.evaluate(async()=>{
 const invoke=window.__TAURI_INTERNALS__.invoke;
 const [settings,accounts,categories,parties,ledger,products,customers]=await Promise.all([
  invoke('get_business_settings'),invoke('get_money_accounts'),invoke('get_cashbook_categories'),invoke('get_cashbook_parties'),invoke('get_cashbook_ledger',{filter:{include_archived:true}}),invoke('get_products',{filter:{}}),invoke('get_customers',{filter:{}}),
 ]);
 return {settings,accounts,categories,parties,ledger:{entries:ledger[0],summary:ledger[1]},products,customers,language:localStorage.getItem('billzen_ui_language'),appearance:localStorage.getItem('billzen_appearance_pref')};
});}
const canonical=value=>Array.isArray(value)?value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
let browser;
try{
 let connected=await connect();browser=connected.browser;let page=connected.page;
 stage('Reading persisted native records');
 let state=await readState(page);
 const version=run('shell','dumpsys','package','com.billzen.desktop').match(/versionCode=(\d+)/)?.[1];
 if(mode==='snapshot'){
  // Seed only the dedicated test AVD when its ledger is empty, preserving all existing records.
  if(state.ledger.entries.length===0){
   const posted=await page.evaluate(async({account,exponent})=>{
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return window.__TAURI_INTERNALS__.invoke('post_cashbook_voucher',{input:{account_id:account,direction:'inflow',classification:'operating_income',payment_method:'cash',amount_minor:1233,business_date:date,party_id:null,category_id:null,reference_note:'UI4-UPGRADE-TEST',notes:'Dedicated emulator upgrade fixture',idempotency_key:crypto.randomUUID(),confirmed_negative_balance:false}});
   },{account:state.accounts.find(account=>!account.is_archived).id,exponent:state.settings.currency_exponent??2});
   assert.ok(posted.status!=='requires_confirmation','Receipt should not need a negative-balance override');
   state=await readState(page);
   assert.ok(state.ledger.entries.length>0,'Synthetic voucher must persist before upgrade');
  }
  fs.writeFileSync(`${output}/before.json`,JSON.stringify({version,state},null,2));
  console.log(`Captured dedicated emulator baseline v${version}; accounts=${state.accounts.length}, vouchers=${state.ledger.entries.length}, products=${state.products.length}, customers=${state.customers.length}`);
 }else{
  const before=JSON.parse(fs.readFileSync(`${output}/before.json`));
  check('Android versionCode increases',Number(version)>Number(before.version));
  for(const key of Object.keys(before.state))check(`In-place upgrade preserves ${key}`,JSON.stringify(canonical(state[key]))===JSON.stringify(canonical(before.state[key])));
  stage('Persisted records match; checking Settings and Reports');
  await page.locator('main').waitFor();
  const guide=page.locator('[data-testid=guide-skip-button]');if(await guide.isVisible())await guide.click();
  check('Native header has no language selector',await page.locator('header select').count()===0);
  check('Native shell has no platform diagnostics',!/(Tauri 2|Desktop \(|Android \(|SQLite WAL|IPC:)/.test(await page.locator('body').innerText()));
  await navigateToAppTab(page,'settings');
  await page.getByTestId('language-select').selectOption('ml');
  check('Native Settings changes Malayalam',await page.locator('html').getAttribute('lang')==='ml');
  await page.getByTestId('language-select').selectOption('ar');
  check('Native Settings applies Arabic RTL',await page.locator('html').getAttribute('dir')==='rtl');
  await navigateToAppTab(page,'reports');
  await page.getByTestId('report-period-year').click();
  await page.waitForFunction(()=>!document.querySelector('[data-testid=btn-export-csv]').disabled);
  check('Native Reports shows preserved transactions',await page.locator('[data-testid^=report-row-]').count()>0);
  check('Native Reports loads without error',await page.getByTestId('report-error').count()===0);
  check('Native Reports fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/reports-arabic.png`});
  stage('Checking cold restart');
  await browser.close();browser=null;
  run('shell','am','force-stop','com.billzen.desktop');
  connected=await connect();browser=connected.browser;page=connected.page;
  await page.waitForFunction(()=>document.documentElement.lang==='ar');
  check('Language persists across Android cold restart',await page.locator('html').getAttribute('lang')==='ar');
  const after=await readState(page);
  for(const key of ['accounts','ledger','products','customers'])check(`Post-UI restart preserves ${key}`,JSON.stringify(canonical(after[key]))===JSON.stringify(canonical(before.state[key])));
  fs.writeFileSync(`${output}/report.json`,JSON.stringify({beforeCode:before.version,afterCode:version,checks,passed:true},null,2));
  console.log(`PASS: ${checks.length} Android candidate assertions; in-place upgrade without uninstall/data clearing`);
 }
}finally{clearTimeout(watchdog);await browser?.close();}
