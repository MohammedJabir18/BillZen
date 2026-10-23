import {readdirSync,readFileSync,copyFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(readFileSync('release/version.json','utf8'));
const target=process.env.PACKAGE_TARGET,platform=process.env.PACKAGE_PLATFORM;
if(!target||!['macOS-AppleSilicon','Windows-x64','Linux-x64'].includes(platform))throw Error('Explicit package target/platform required');
const root=`src-tauri/target/${target}/release/bundle`;
const output='dist-desktop/packages';mkdirSync(output,{recursive:true});
const extensions=platform==='macOS-AppleSilicon'?['.dmg']:platform==='Windows-x64'?['.exe']:['.deb','.AppImage'];
const records=[];
for(const extension of extensions){
 const files=[];
 for(const folder of readdirSync(root)){const dir=join(root,folder);if(statSync(dir).isDirectory())for(const name of readdirSync(dir))if(name.endsWith(extension))files.push(join(dir,name));}
 if(files.length!==1)throw Error(`Expected one ${extension} installer, got ${files.length}`);
 const name=`BillZen-${version}-${platform}${extension}`;
 copyFileSync(files[0],join(output,name));const bytes=readFileSync(files[0]);
 records.push({file:name,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const prefix=`BillZen-${version}-${platform}`;
writeFileSync(join(output,prefix+'-SHA256SUMS.txt'),records.map(r=>`${r.sha256}  ${r.file}`).join('\n')+'\n');
writeFileSync(join(output,prefix+'-build-info.json'),JSON.stringify({version,commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,target,platform,
 signing:platform==='macOS-AppleSilicon'?'ad-hoc, not notarized':platform==='Windows-x64'?'unsigned Authenticode':'unsigned package',runtimeTested:false,artifacts:records},null,2)+'\n');
console.log(JSON.stringify(records));
