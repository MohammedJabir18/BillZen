import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const folder='test_artifacts/updates';fs.mkdirSync(folder,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4191','--strictPort'],{stdio:'ignore'});
let browser;const reports=[];
try{
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4191')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 for(const theme of ['light','dark'])for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  await context.addInitScript(theme=>{localStorage.setItem('billzen_appearance_pref',theme);localStorage.setItem('billzen_mock_fresh_user','false');localStorage.setItem('billzen_guide_status','completed');},theme);
  const page=await context.newPage();await page.goto('http://127.0.0.1:4191');
  await page.getByRole('button',{name:'Settings',exact:true}).last().click();
  const section=page.locator('section[aria-labelledby="updates-title"]');await section.waitFor();
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await page.getByText('In-app updates are available in supported Android installations.',{exact:false}).waitFor();
  assert.equal(await section.getByRole('button',{name:'Install update',exact:true}).count(),0);
  await context.setOffline(true);await page.getByText('You are offline. Billing and records remain available.',{exact:true}).waitFor();
  assert.equal(await section.getByRole('button',{name:'Check for updates',exact:true}).isDisabled(),true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await section.screenshot({path:`${folder}/${theme}-${width}.png`});
  reports.push({theme,width,unsupported:true,offline:true,noInstall:true,noOverflow:true});await context.close();
 }
 fs.writeFileSync(`${folder}/report.json`,JSON.stringify(reports,null,2));console.log(`${reports.length}/4 update screen scenarios passed`);
}finally{await browser?.close();server.kill();}
