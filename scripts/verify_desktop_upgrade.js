// Actual Linux signed upgrade acceptance. Uses a private older-version test
// AppImage and a synthetic workspace; never points at the user's installation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const baseline=process.argv[2],candidate=process.argv[3];
if(!baseline||!candidate)throw Error('Usage: node scripts/verify_desktop_upgrade.js PRIVATE_BASELINE_APPIMAGE VERIFIED_RELEASE_APPIMAGE');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'billzen-signed-upgrade-'));
const image=path.join(folder,'BillZen.AppImage'),data=path.join(folder,'data'),port=9237;
fs.copyFileSync(baseline,image);fs.chmodSync(image,0o755);
const child=spawn(image,[],{detached:true,env:{...process.env,APPIMAGE_EXTRACT_AND_RUN:'1',BILLZEN_DATA_DIR:data,WEBKIT_INSPECTOR_HTTP_SERVER:`127.0.0.1:${port}`},stdio:['ignore','ignore','ignore']});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deadline=async(fn,ms=45000)=>{const end=Date.now()+ms;let error;while(Date.now()<end){try{return await fn();}catch(e){error=e;await pause(300);}}throw error??Error('Timed out');};
const sockets=[];
async function connect(){
 await deadline(async()=>{const result=await fetch(`http://127.0.0.1:${port}/`);assert(result.ok);});
 const ws=new WebSocket(`ws://127.0.0.1:${port}/socket/1/1/WebPage`);sockets.push(ws);
 let target,id=0;const waiting=new Map();
 ws.onmessage=event=>{const outer=JSON.parse(event.data);
  if(outer.method==='Target.targetCreated')target=outer.params.targetInfo.targetId;
  if(outer.method==='Target.dispatchMessageFromTarget'){
   const result=JSON.parse(outer.params.message),pending=waiting.get(result.id);if(!pending)return;waiting.delete(result.id);clearTimeout(pending.timer);
   if(result.error||result.result?.wasThrown)pending.reject(Error(JSON.stringify(result.error??result.result)));else pending.resolve(result.result?.result?.value);
  }
 };
 await deadline(async()=>{assert(ws.readyState===WebSocket.OPEN&&target);});
 return {ws,async evaluate(expression,timeout=45000){return new Promise((resolve,reject)=>{const req=++id,timer=setTimeout(()=>{waiting.delete(req);reject(Error('Native evaluation timed out'));},timeout);waiting.set(req,{resolve,reject,timer});ws.send(JSON.stringify({id:++id,method:'Target.sendMessageToTarget',params:{targetId:target,message:JSON.stringify({id:req,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}})}}));});},async invoke(command,args={},timeout=45000){
 const key='__upgrade_'+Math.random().toString(36).slice(2);
 await this.evaluate(`(()=>{window[${JSON.stringify(key)}]={done:false};window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)},${JSON.stringify(args)}).then(value=>window[${JSON.stringify(key)}]={done:true,value}).catch(error=>window[${JSON.stringify(key)}]={done:true,error:String(error)});})()`);
 const result=await deadline(async()=>{const value=await this.evaluate(`JSON.stringify(window[${JSON.stringify(key)}])`);const row=JSON.parse(value);assert(row.done);return row;},timeout);
 await this.evaluate(`delete window[${JSON.stringify(key)}]`);if(result.error)throw Error(result.error);return result.value;
 }};
}
const report={baseline:path.basename(baseline),candidate:path.basename(candidate),realDataTouched:false};
try{
 let app=await connect();
 await deadline(async()=>assert.equal(await app.invoke('plugin:app|version'),'0.1.5'));
 await app.invoke('update_appearance_preference',{preference:'dark'});
 const product=await app.invoke('create_product',{dto:{sku:'UPGRADE-FIXTURE',name:'Preserved synthetic product',unit_price_minor:250,is_stock_tracked:true,opening_stock_scaled:7000}});
 await deadline(async()=>{const state=await app.invoke('get_desktop_update_status');assert.notEqual(state.status,'checking');});
 const update=await app.invoke('check_desktop_update');assert.equal(update.status,'available',JSON.stringify(update));assert.equal(update.version,'0.1.6');
 const downloaded=await app.invoke('download_desktop_update',{},650000);assert.equal(downloaded.status,'ready',JSON.stringify(downloaded));assert(downloaded.downloadedBytes>0);
 report.signatureVerified=true;report.downloadedBytes=downloaded.downloadedBytes;
 void app.invoke('install_desktop_update',{},20000).catch(()=>{});
 await deadline(async()=>assert.equal(fs.readFileSync(image).equals(fs.readFileSync(candidate)),true),60000);
 app.ws.close();await pause(1800);
 app=await deadline(()=>connect(),45000);
 await deadline(async()=>assert.equal(await app.invoke('plugin:app|version'),'0.1.6'));
 const settings=await app.invoke('get_business_settings');assert.equal(settings.appearance_preference,'dark');
 const backup=await app.invoke('export_workspace_backup');
 assert(JSON.stringify(backup).includes('UPGRADE-FIXTURE'));
 assert(fs.readdirSync(path.join(data,'recovery')).some(name=>name.includes('before-app-update')));
 report.restartedVersion='0.1.6';report.preferencePreserved=true;report.productId=product.id;report.productPreserved=true;report.recoverySnapshotCreated=true;
 report.installedSha256=createHash('sha256').update(fs.readFileSync(image)).digest('hex');
 console.log(JSON.stringify(report,null,2));
 fs.mkdirSync('test_artifacts/desktop-updater',{recursive:true});fs.writeFileSync('test_artifacts/desktop-updater/actual-upgrade.json',JSON.stringify(report,null,2));
}finally{
 for(const socket of sockets)socket.close();
 try{process.kill(-child.pid,'SIGTERM');}catch{}
 await pause(500);fs.rmSync(folder,{recursive:true,force:true});
}
