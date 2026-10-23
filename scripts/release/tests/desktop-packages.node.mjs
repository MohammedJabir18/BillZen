import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const verifier=resolve('scripts/release/verify-desktop-packages.mjs');
test('accepts complete authenticated packages; refuses bytes, source and missing-platform changes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'billzen-package-acceptance-'));
 try{
 const output=join(dir,'packages');mkdirSync(output);mkdirSync(join(dir,'src-tauri'));
 const revision='a'.repeat(40),version='0.1.6',id=Buffer.alloc(8,8),{privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pub=Buffer.from('untrusted comment: test\n'+Buffer.concat([Buffer.from('Ed'),id,publicKey.export({format:'der',type:'spki'}).subarray(-32)]).toString('base64')+'\n').toString('base64');
 writeFileSync(join(dir,'src-tauri/tauri.conf.json'),JSON.stringify({version,plugins:{updater:{pubkey:pub}}}));
 const rows=[['Linux-x64','linux-x86_64','.AppImage'],['Windows-x64','windows-x86_64','.exe'],['macOS-AppleSilicon','darwin-aarch64','.app.tar.gz']];
 let first,original,infoFile,info;
 for(const [platform,key,extension]of rows){
  const prefix=`BillZen-${version}-${platform}`,name=prefix+extension,bytes=Buffer.from('synthetic '+platform),signature=sign(null,createHash('blake2b512').update(bytes).digest(),privateKey),comment='timestamp:1\tversion:'+version;
  const sig=Buffer.from(['untrusted comment: test',Buffer.concat([Buffer.from('ED'),id,signature]).toString('base64'),'trusted comment: '+comment,sign(null,Buffer.concat([signature,Buffer.from(comment)]),privateKey).toString('base64')].join('\n')+'\n').toString('base64');
  writeFileSync(join(output,name),bytes);writeFileSync(join(output,name+'.sig'),sig);
  const data={version,commit:revision,platform,artifacts:[{file:name,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]};
  const provenance=join(output,prefix+'-build-info.json');writeFileSync(provenance,JSON.stringify(data));
  writeFileSync(join(output,prefix+'-update.json'),JSON.stringify({version,platforms:{[key]:{signature:sig,url:`https://github.com/MohammedJabir18/BillZen/releases/download/v${version}/${name}`}}}));
  if(!first){first=join(output,name);original=bytes;infoFile=provenance;info=data;}
 }
 const run=()=>spawnSync(process.execPath,[verifier,output,revision],{cwd:dir,encoding:'utf8'});
 let result=run();assert.equal(result.status,0,result.stderr);
 writeFileSync(first,'tampered');result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/checksum/);writeFileSync(first,original);
 writeFileSync(infoFile,JSON.stringify({...info,commit:'b'.repeat(40)}));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/provenance/);
 rmSync(infoFile);result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing platform/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
