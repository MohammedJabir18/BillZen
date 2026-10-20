import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { navigateToAppTab } from './lib/navigation.js';
const output='test_artifacts/reports-ui4';fs.mkdirSync(output,{recursive:true});
const server=spawn('node_modules/.bin/vite',['preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'pipe'});
let browser;const passed=[];const check=(name,value)=>{assert.ok(value,name);passed.push(name);};
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4197')).ok)break;}catch{}if(i===99)throw Error('Preview unavailable');await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const language of ['en','ml','ar'])for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:850},colorScheme:width===320?'dark':'light'});
  await context.addInitScript(({language,dark})=>{localStorage.setItem('billzen_guide_status','completed');localStorage.setItem('billzen_ui_language',language);localStorage.setItem('billzen_appearance_pref',dark?'dark':'light');},{language,dark:width===320});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4197/?tab=cashbook',{waitUntil:'networkidle'});
  await page.getByTestId('action-receive-money').click();
  await page.getByTestId('action-new-category').click();
  const dialog=page.getByRole('dialog').last();
  const categoryName='Retail sales — Kerala GCC';
  await dialog.locator('input[type=text]').fill(categoryName);
  await dialog.locator('button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[role=dialog]').length===1);
  const categoryId=await page.getByTestId('select-voucher-category').inputValue();
  await page.getByTestId('input-voucher-amount').fill('125.50');
  await page.getByTestId('btn-submit-voucher').click();
  await page.waitForFunction(()=>document.querySelectorAll('[role=dialog]').length===0);
  await page.getByTestId('action-receive-money').click();
  await page.getByTestId('input-voucher-amount').fill('50.25');
  await page.getByTestId('btn-submit-voucher').click();
  await page.waitForFunction(()=>document.querySelectorAll('[role=dialog]').length===0);
  await navigateToAppTab(page,'reports');
  await page.waitForFunction(()=>document.querySelector('[data-testid=report-closing-balance]')?.textContent.includes('175.75'));
  const closing=await page.getByTestId('report-closing-balance').innerText();
  const categorySelect=page.getByTestId('report-category-select');
  await categorySelect.selectOption({label:categoryName});
  await page.waitForTimeout(150);
  check(`${language}/${width}: category selection uses identity`,await categorySelect.inputValue()===categoryId);
  check(`${language}/${width}: category filter retains matching receipt`,await page.locator('[data-testid^=report-row-]').count()===1);
  check(`${language}/${width}: human-readable category`,(await page.locator('[data-testid=report-row-0]').innerText()).includes(categoryName));
  check(`${language}/${width}: full statement balance unchanged`,await page.getByTestId('report-closing-balance').innerText()===closing);
  const downloadPromise=page.waitForEvent('download');await page.getByTestId('btn-export-csv').click();const download=await downloadPromise;
  const csv=fs.readFileSync(await download.path(),'utf8');
  check(`${language}/${width}: CSV exports matching entries`,csv.includes('125.50')&&!csv.includes('50.25'));
  check(`${language}/${width}: filter is named`,await categorySelect.evaluate(el=>Boolean(el.getAttribute('aria-label')||el.labels?.length)));
  check(`${language}/${width}: populated page fits viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const label=await categorySelect.locator('option[value=all]').innerText();
  check(`${language}/${width}: localized filter copy`,language==='en'||label!=='All Categories');
  await page.getByTestId('report-period-custom').click();
  const end = await page.getByTestId('report-custom-end-date').inputValue();
  await page.getByTestId('report-custom-start-date').fill('2099-12-31');
  check(`${language}/${width}: reversed date range shows validation`, await page.getByTestId('report-error').isVisible());
  check(`${language}/${width}: invalid-range export disabled`, await page.getByTestId('btn-export-csv').isDisabled());
  check(`${language}/${width}: invalid range has no invented zero balance`, (await page.getByTestId('report-closing-balance').innerText()).includes('—'));
  await page.getByTestId('report-custom-start-date').fill(end);
  await page.waitForFunction(()=>!document.querySelector('[data-testid=btn-export-csv]').disabled);
  if(language==='en' && width===1280){
    await page.evaluate(()=>{window.print=()=>{};});
    await page.getByTestId('btn-print-report').click();
    await page.locator('#printable-report-root').waitFor({state:'attached'});
    const pdfPath=`${output}/populated-report-a4.pdf`;
    await page.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true});
    const info=execFileSync('pdfinfo',[pdfPath],{encoding:'utf8'});
    const text=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});
    const dimensions=info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
    check('Reports PDF: A4 paper dimensions',dimensions && Math.abs(Number(dimensions[1])-595.276)<1 && Math.abs(Number(dimensions[2])-841.89)<1);
    check('Reports PDF: readable category names',['Retail', 'sales', 'Kerala', 'GCC'].every(word=>text.includes(word)) && !text.includes(categoryId));
  }
  await page.screenshot({path:`${output}/${language}-${width}.png`,fullPage:true});
  await context.close();
 }
 console.log(`PASS: ${passed.length} Reports UI assertions`);
}finally{fs.writeFileSync(`${output}/report.json`,JSON.stringify({passed},null,2));await browser?.close();server.kill('SIGTERM');}
