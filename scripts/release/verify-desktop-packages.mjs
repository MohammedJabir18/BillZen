import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {verifyDesktopSignature} from './verify-desktop-signature.mjs';
import {buildDesktopFeed} from './build-desktop-feed.mjs';
const directory=process.argv[2],revision=process.argv[3];
if(!directory||!/^\w{40}$/.test(revision??''))throw Error('Expected package directory and exact source revision');
const config=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8'));
const platformNames=['Linux-x64','Windows-x64','macOS-AppleSilicon'];
const seen=new Set();
for(const name of readdirSync(directory).filter(name=>name.endsWith('-build-info.json'))){
 const info=JSON.parse(readFileSync(join(directory,name),'utf8'));
 if(info.version!==config.version||info.commit!==revision||!platformNames.includes(info.platform)||seen.has(info.platform))throw Error('Package provenance mismatch');
 seen.add(info.platform);
 for(const artifact of info.artifacts){
  if(artifact.file!==artifact.file.split(/[\\/]/).at(-1))throw Error('Invalid artifact basename');
  const file=join(directory,artifact.file),bytes=readFileSync(file);
  if(statSync(file).size!==artifact.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)throw Error('Package checksum mismatch');
 }
}
if(seen.size!==3)throw Error('Missing platform provenance');
const feed=buildDesktopFeed(directory,config.version);
for(const row of Object.values(feed.platforms)){
 const name=new URL(row.url).pathname.split('/').at(-1);
 verifyDesktopSignature(readFileSync(join(directory,name)),row.signature,config.plugins.updater.pubkey,config.version);
}
console.log(`Verified all three package provenances, checksums, signatures and signed version ${config.version}`);
