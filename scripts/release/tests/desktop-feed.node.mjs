import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/release/build-desktop-feed.mjs');
const rows=[['macOS-AppleSilicon','darwin-aarch64','.app.tar.gz'],['Windows-x64','windows-x86_64','.exe'],['Linux-x64','linux-x86_64','.AppImage']];
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'billzen-feed-test-'));
 try{
  writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.1.6'}));
  const output=join(dir,'dist-desktop/packages');mkdirSync(output,{recursive:true});
  const fragments=rows.map(([platform,key,extension])=>{
   const prefix=`BillZen-0.1.6-${platform}`,file=prefix+extension;
   writeFileSync(join(output,file),'synthetic installer');writeFileSync(join(output,file+'.sig'),'c2lnbmF0dXJl\n');
   const fragment={version:'0.1.6',platforms:{[key]:{signature:'c2lnbmF0dXJl\n',url:`https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.6/${file}`}}};
   const path=join(output,prefix+'-update.json');writeFileSync(path,JSON.stringify(fragment));return {path,fragment,key,file};
  });
  const run=()=>spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  fn({dir,output,fragments,run});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('merges all three signed platform fragments into one Tauri feed with raw signature text',()=>fixture(({output,run})=>{
 const result=run();assert.equal(result.status,0,result.stderr);
 const feed=JSON.parse(readFileSync(join(output,'desktop-update.json'),'utf8'));
 assert.equal(feed.version,'0.1.6');assert.deepEqual(Object.keys(feed.platforms).sort(),['darwin-aarch64','linux-x86_64','windows-x86_64']);
 assert.equal(feed.platforms['darwin-aarch64'].signature,'c2lnbmF0dXJl\n');
}));
for(const [name,mutate] of [
 ['missing platform',({fragments})=>unlinkSync(fragments[0].path)],
 ['duplicate platform',({output,fragments})=>writeFileSync(join(output,'duplicate-update.json'),JSON.stringify(fragments[0].fragment))],
 ['version mismatch',({fragments})=>{fragments[0].fragment.version='0.1.7';}],
 ['unknown architecture',({fragments})=>{const f=fragments[0];f.fragment.platforms['darwin-x86_64']=f.fragment.platforms[f.key];delete f.fragment.platforms[f.key];}],
 ['empty signature',({fragments})=>{const f=fragments[0];f.fragment.platforms[f.key].signature=' ';}],
 ['signature mismatch',({fragments})=>{const f=fragments[0];f.fragment.platforms[f.key].signature='different';}],
 ['missing updater',({output,fragments})=>unlinkSync(join(output,fragments[0].file))],
 ['missing detached signature',({output,fragments})=>unlinkSync(join(output,fragments[0].file+'.sig'))],
 ['empty updater',({output,fragments})=>writeFileSync(join(output,fragments[0].file),'')],
 ...['https://evil.test/update.exe','https://github.com/MohammedJabir18/BillZen/releases/latest/download/a.exe','https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.5/a.exe','https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.6/wrong.exe','https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.6/a.exe?download=1'].map(url=>['untrusted URL '+url,({fragments})=>{const f=fragments[0];f.fragment.platforms[f.key].url=url;}])
])test('feed refuses '+name,()=>fixture(context=>{
 mutate(context);for(const f of context.fragments){try{readFileSync(f.path);}catch{continue;}if(!name.startsWith('duplicate'))writeFileSync(f.path,JSON.stringify(f.fragment));}
 const result=context.run();assert.notEqual(result.status,0);assert.throws(()=>readFileSync(join(context.output,'desktop-update.json')));
}));
