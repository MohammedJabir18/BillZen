import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/release/collect-desktop.mjs');
test('collector requires exact platform installers and records immutable source/hash metadata',()=>{
 for(const [platform,extensions] of [['macOS-AppleSilicon',['.dmg']],['Windows-x64',['.exe']],['Linux-x64',['.deb','.AppImage']]]){
  const dir=mkdtempSync(join(tmpdir(),'billzen-package-test-'));
  try{
   mkdirSync(join(dir,'release'));writeFileSync(join(dir,'release/version.json'),JSON.stringify({version:'0.1.5'}));
   const bundle=join(dir,'src-tauri/target/test-target/release/bundle/test');mkdirSync(bundle,{recursive:true});
   const run=()=>spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,PACKAGE_TARGET:'test-target',PACKAGE_PLATFORM:platform,GITHUB_SHA:'abc123',GITHUB_RUN_ID:'1'},encoding:'utf8'});
   assert.notEqual(run().status,0,'missing package refuses collection');
   for(const ext of extensions)writeFileSync(join(bundle,'setup'+ext),'synthetic installer');
   assert.equal(run().status,0);
   const info=JSON.parse(readFileSync(join(dir,`dist-desktop/packages/BillZen-0.1.5-${platform}-build-info.json`),'utf8'));
   assert.equal(info.commit,'abc123');assert.equal(info.runtimeTested,false);assert.equal(info.artifacts.length,extensions.length);
   for(const row of info.artifacts){assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.equal(row.sizeBytes,19);}
   writeFileSync(join(bundle,'stale'+extensions[0]),'stale');assert.notEqual(run().status,0,'ambiguous/stale packages refuse collection');
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
