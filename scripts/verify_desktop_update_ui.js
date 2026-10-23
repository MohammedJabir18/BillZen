import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cacheDir=mkdtempSync(join(tmpdir(),'billzen-updates-vite-'));
import {chromium} from 'playwright';
const server=await createServer({configFile:false,cacheDir,optimizeDeps:{entries:['scripts/fixtures/updates-harness.tsx']},plugins:[react(),{name:'updates-ui-harness',configureServer(vite){
 vite.middlewares.use('/__updates-test',async(_req,res)=>{
  res.setHeader('Content-Type','text/html');
  res.end(await vite.transformIndexHtml('/__updates-test','<!doctype html><div id="root"></div><script type="module" src="/scripts/fixtures/updates-harness.tsx"></script>'));
 });
}}],server:{port:0,host:'127.0.0.1',watch:null,hmr:false}});
await server.listen();
const harnessUrl=`http://127.0.0.1:${server.httpServer.address().port}/__updates-test`;
await server.environments.client.warmupRequest('/scripts/fixtures/updates-harness.tsx');
await server.environments.client.waitForRequestsIdle();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 page.setDefaultTimeout(15000);
 page.setDefaultNavigationTimeout(45000);
 const pending=new Set();page.on('request',request=>pending.add(request.url()));page.on('requestfinished',request=>pending.delete(request.url()));page.on('requestfailed',request=>pending.delete(request.url()));
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.addInitScript(()=>{
  window.calls=[];window.updateInfo={status:'ready',message:'Ready to install',version:'0.1.6'};window.installMode='pending';
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   window.calls.push({command,args});
   if(command==='get_desktop_update_status')return {...window.updateInfo};
   if(command==='install_desktop_update'){
    if(window.installMode==='error')throw new Error('Backup could not be completed');
    return new Promise(resolve=>{window.finishInstall=resolve;});
   }
   if(command==='check_desktop_update')return window.updateInfo={status:'available',message:'Update available'};
   if(command==='download_desktop_update')return window.updateInfo={status:'downloading',message:'Downloading',downloadedBytes:4,totalBytes:10};
   if(command==='cancel_desktop_update'){window.updateInfo={status:'available',message:'Download cancelled'};return;}
   throw new Error('Unexpected command: '+command);
  }};
 });
 await page.goto(harnessUrl).catch(error=>{console.error('Pending harness requests:',[...pending]);throw error;});
 const install=page.getByRole('button',{name:'Install update',exact:true});
 await install.waitFor();
 for(const flags of [[true,false,false],[false,true,false],[false,false,true]]){
  await page.evaluate(flags=>window.renderUpdates(...flags),flags);
  await page.waitForFunction(()=>document.querySelector('button:last-child')?.disabled===true);
  assert.equal(await install.isDisabled(),true,'dirty/workspace/mutation must disable install');
 }
 await page.evaluate(()=>window.renderUpdates());
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Install update')?.disabled===false);
 await page.evaluate(()=>{const dialog=document.createElement('div');dialog.role='dialog';dialog.id='other-dialog';document.body.append(dialog);});
 await install.click();
 assert.equal(await page.evaluate(()=>window.calls.some(c=>c.command==='install_desktop_update')),false,'another dialog must prevent install');
 await page.evaluate(()=>document.getElementById('other-dialog').remove());
 await page.evaluate(()=>{const form=document.createElement('form');form.id='dirty-form';const input=document.createElement('input');input.defaultValue='saved';input.value='unsaved';form.append(input);document.body.append(form);});
 await install.click();
 assert.equal(await page.evaluate(()=>window.calls.some(c=>c.command==='install_desktop_update')),false,'dirty DOM form must prevent install');
 await page.evaluate(()=>document.getElementById('dirty-form').remove());
 await install.click();
 const overlay=page.getByRole('dialog',{name:'Installing update'});await overlay.waitFor();
 assert.equal(await overlay.getByRole('button',{name:'Return to BillZen'}).count(),0,'desktop active installation has no resume escape');
 assert.match(await overlay.textContent(),/restart/i);
 assert.doesNotMatch(await overlay.textContent(),/Android/);
 // Updates must lock keyboard and programmatic focus as well as pointer access.
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 assert.equal(await overlay.evaluate(node=>node.contains(document.activeElement)),true,'focus stays in active installer');
 assert.equal(await page.evaluate(()=>document.getElementById('background-input').closest('[inert]')!==null),true,'workspace is inert during install');
 await page.evaluate(()=>document.getElementById('background-input').focus());
 await page.keyboard.type('unexpected-write');
 assert.equal(await page.locator('#background-input').inputValue(),'saved','keyboard cannot edit workspace during install');
 await page.keyboard.press('Escape');assert.equal(await overlay.isVisible(),true,'Escape cannot dismiss active desktop install');
 // A status request begun before install can report ready while native preparation is in flight.
 await page.waitForTimeout(1200);
 assert.equal(await overlay.isVisible(),true,'stale ready poll must not dismiss in-flight native command');
 await page.evaluate(()=>window.dispatchEvent(new Event('billzen-update-returned')));
 assert.equal(await overlay.isVisible(),true,'Android return event cannot dismiss desktop install');
 await page.evaluate(()=>{window.updateInfo={status:'installing',message:'Restarting BillZen'};window.finishInstall();});
 await page.waitForTimeout(1200);assert.equal(await overlay.isVisible(),true);
 await page.evaluate(()=>{window.updateInfo={status:'ready',message:'Ready to install'};});
 await overlay.waitFor({state:'hidden'});
 await page.evaluate(()=>{window.installMode='error';});
 await install.click();await overlay.waitFor({state:'hidden'});
 assert.match(await page.getByRole('status').textContent(),/Backup could not be completed/);
 assert.equal(await install.isEnabled(),true,'failed install permits retry after native rollback');
 assert.equal(await page.evaluate(()=>document.getElementById('background-input').closest('[inert]')===null),true,'failed install restores workspace interaction');
 assert.equal(await page.evaluate(()=>window.calls.some(c=>c.command==='resume_after_update')),false);
 await page.getByRole('button',{name:'Check for updates'}).click();
 await page.getByRole('button',{name:'Download update'}).click();
 await page.getByRole('button',{name:'Cancel download'}).click();
 assert.equal(await page.evaluate(()=>window.calls.some(c=>c.command==='cancel_desktop_update')),true);
 await page.evaluate(()=>{window.updateInfo={status:'unavailable',message:'Use the BillZen AppImage to enable in-app updates on Linux.'};});
 await page.waitForFunction(()=>document.querySelector('[role="status"]').textContent.includes('AppImage'));
 assert.equal(await page.getByRole('button',{name:'Install update',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Download update',exact:true}).count(),0);
 const android=await browser.newPage();
 await android.addInitScript(()=>{
  window.calls=[];window.updateInfo={status:'ready',message:'Ready'};
  window.BillZenNative={getUpdateDevice:()=>'{"versionCode":1010}',isUpdateInstallerActive:()=>false,installUpdate:()=> 'permission'};
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   window.calls.push({command,args});
   if(command==='get_update_status')return {...window.updateInfo};
   if(command==='prepare_android_update'){window.updateInfo={status:'installing',message:'Confirm Android installation'};return;}
   if(command==='resume_after_update'){window.updateInfo={status:'ready',message:'Ready'};return;}
   throw new Error('Unexpected Android command: '+command);
  }};
 });
 await android.goto(harnessUrl);
 await android.getByRole('button',{name:'Install update',exact:true}).click();
 const androidOverlay=android.getByRole('dialog',{name:'Installing update'});
 await androidOverlay.waitFor();
 assert.match(await androidOverlay.textContent(),/Allow updates from BillZen in Android settings/);
 await androidOverlay.getByRole('button',{name:'Return to BillZen'}).click();
 await androidOverlay.waitFor({state:'hidden'});
 assert.equal(await android.evaluate(()=>window.calls.some(c=>c.command==='prepare_android_update')),true);
 assert.equal(await android.evaluate(()=>window.calls.some(c=>c.command==='install_desktop_update')),false);
 assert.deepEqual(errors,[]);
 console.log('Update UI: desktop guards/locking/recovery/actions, Linux AppImage bootstrap, Android permission/return regression passed');
}finally{await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
