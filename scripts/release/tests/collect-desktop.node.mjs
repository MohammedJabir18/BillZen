import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/release/collect-desktop.mjs');
const cases=[['macOS-AppleSilicon','aarch64-apple-darwin',['.dmg','.app.tar.gz'],'darwin-aarch64','.app.tar.gz'],['Windows-x64','x86_64-pc-windows-msvc',['.exe'],'windows-x86_64','.exe'],['Linux-x64','x86_64-unknown-linux-gnu',['.deb','.AppImage'],'linux-x86_64','.AppImage']];
test('collector requires signed updater artifacts and records immutable URLs, raw signatures and provenance',()=>{
 for(const [platform,target,extensions,key,updater] of cases){
  const dir=mkdtempSync(join(tmpdir(),'billzen-package-test-'));
  try{
   mkdirSync(join(dir,'release'));writeFileSync(join(dir,'release/version.json'),JSON.stringify({version:'0.0.1'}));
   writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.1.6'}));
   const bundle=join(dir,`src-tauri/target/${target}/release/bundle/test`);mkdirSync(bundle,{recursive:true});
   const run=(override={})=>spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,PACKAGE_TARGET:target,PACKAGE_PLATFORM:platform,GITHUB_SHA:'abc123',GITHUB_RUN_ID:'1',...override},encoding:'utf8'});
   assert.notEqual(run().status,0,'missing package refuses collection');
   for(const ext of extensions)writeFileSync(join(bundle,'setup'+ext),'synthetic installer');
   assert.notEqual(run().status,0,'missing updater signature refuses collection');
   writeFileSync(join(bundle,'setup'+updater+'.sig'),' \n');assert.notEqual(run().status,0,'empty signature refuses collection');
   // Shape matches Tauri's Base64-encoded four-line minisign envelope; signatures are synthetic.
   const makeSignature=comment=>Buffer.from(`untrusted comment: signature from tauri secret key\n${Buffer.alloc(74).toString('base64')}\ntrusted comment: ${comment}\n${Buffer.alloc(64).toString('base64')}\n`).toString('base64')+'\n';
   for(const [comment,reason] of [['timestamp:1791649051\tfile:setup'+updater,'missing signed version'],['timestamp:1791649051\tfile:setup'+updater+'\tversion:0.1.5','mismatched signed version'],['timestamp:1791649051\tfile:setup'+updater+'\tversion:0.1.6\tversion:0.1.5','ambiguous signed version']]){
    writeFileSync(join(bundle,'setup'+updater+'.sig'),makeSignature(comment));
    const rejected=run();assert.notEqual(rejected.status,0,reason);assert.match(rejected.stderr,/signed version/i);
   }
   const signature=makeSignature('timestamp:1791649051\tfile:setup'+updater+'\tversion:0.1.6');writeFileSync(join(bundle,'setup'+updater+'.sig'),signature);
   renameSync(join(bundle,'setup'+updater+'.sig'),join(bundle,'unrelated'+updater+'.sig'));
   assert.notEqual(run().status,0,'signature must belong to the selected updater');
   renameSync(join(bundle,'unrelated'+updater+'.sig'),join(bundle,'setup'+updater+'.sig'));
   const result=run();assert.equal(result.status,0,result.stderr);
   const prefix=`BillZen-0.1.6-${platform}`;
   const info=JSON.parse(readFileSync(join(dir,`dist-desktop/packages/${prefix}-build-info.json`),'utf8'));
   assert.equal(info.commit,'abc123');assert.equal(info.runtimeTested,false);assert.equal(info.artifacts.length,extensions.length+1);
   for(const row of info.artifacts)assert.match(row.sha256,/^[a-f0-9]{64}$/);
   const fragment=JSON.parse(readFileSync(join(dir,`dist-desktop/packages/${prefix}-update.json`),'utf8'));
   assert.deepEqual(fragment,{version:'0.1.6',platforms:{[key]:{signature,url:`https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.6/${prefix}${updater}`}}});
   assert.notEqual(run({PACKAGE_TARGET:'wrong-target'}).status,0,'target/platform mismatch refuses collection');
   writeFileSync(join(bundle,'stale'+extensions[0]),'stale');assert.notEqual(run().status,0,'ambiguous/stale packages refuse collection');
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
