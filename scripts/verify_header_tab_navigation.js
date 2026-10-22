import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { navigateToAppTab } from './lib/navigation.js';
const server = spawn('node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', '4194', '--strictPort'], {stdio:'pipe'});
let browser;
const passed=[];
const check=(name,value)=>{assert.ok(value,name);passed.push(name);};
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4194')).ok)break;}catch{} if(i===99)throw Error('Preview unavailable');await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:800}});
  await context.addInitScript(()=>localStorage.setItem('billzen_guide_status','completed'));
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4194',{waitUntil:'networkidle'});
  check(`${width}: language selector absent from header`,await page.locator('header select').count()===0);
  check(`${width}: platform/framework diagnostics absent`,!/(Tauri 2|Desktop \(|Android \(|Browser Mode|SQLite WAL|IPC:)/.test(await page.locator('body').innerText()));
  check(`${width}: developer print probe absent from navigation`,await page.getByTestId('tab-print').count()===0);
  if(width===320){await page.getByTestId('mobile-nav-more').click();check('Mobile More excludes developer print probe',await page.getByTestId('mobile-tab-print').count()===0);}
  await navigateToAppTab(page,'settings');
  await page.getByTestId('language-select').selectOption('ml');
  check(`${width}: Malayalam preference applied`,await page.locator('html').getAttribute('lang')==='ml');
  await page.reload({waitUntil:'networkidle'});
  await navigateToAppTab(page,'settings');
  check(`${width}: preference survives restart`,await page.getByTestId('language-select').inputValue()==='ml');
  await page.getByTestId('language-select').selectOption('ar');
  check(`${width}: Arabic RTL applied`,await page.locator('html').getAttribute('dir')==='rtl');
  await navigateToAppTab(page,'reports');
  check(`${width}: no main-interface language control`,await page.getByTestId('language-select').count()===0);
  check(`${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
 }
 console.log(`PASS: ${passed.length} Settings language/header assertions`);
} finally {
 fs.mkdirSync('test_artifacts/header',{recursive:true});
 fs.writeFileSync('test_artifacts/header/report.json',JSON.stringify({passed},null,2));
 await browser?.close();server.kill('SIGTERM');
}
