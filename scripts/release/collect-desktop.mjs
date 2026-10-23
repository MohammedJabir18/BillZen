import {readdirSync,readFileSync,copyFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(readFileSync('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('A stable package.json version is required');
const targets={
 'macOS-AppleSilicon':{target:'aarch64-apple-darwin',extensions:['.dmg','.app.tar.gz'],updater:'.app.tar.gz',key:'darwin-aarch64'},
 'Windows-x64':{target:'x86_64-pc-windows-msvc',extensions:['.exe'],updater:'.exe',key:'windows-x86_64'},
 'Linux-x64':{target:'x86_64-unknown-linux-gnu',extensions:['.deb','.AppImage'],updater:'.AppImage',key:'linux-x86_64'}
};
const target=process.env.PACKAGE_TARGET,platform=process.env.PACKAGE_PLATFORM,config=targets[platform];
if(!config||target!==config.target)throw Error('Explicit matching package target/platform required');
const root=`src-tauri/target/${target}/release/bundle`;
const output='dist-desktop/packages';
const extensions=[...config.extensions,config.updater+'.sig'];
// Resolve every input before writing anything; incomplete signatures never produce a feed.
const selected=extensions.map(extension=>{
 const files=[];
 for(const folder of readdirSync(root)){const dir=join(root,folder);if(statSync(dir).isDirectory())for(const name of readdirSync(dir))if(name.endsWith(extension)&&statSync(join(dir,name)).isFile())files.push(join(dir,name));}
 if(files.length!==1)throw Error(`Expected one ${extension} artifact, got ${files.length}`);
 const bytes=readFileSync(files[0]);if(!bytes.length)throw Error(`Empty ${extension} artifact`);
 return {extension,path:files[0],bytes};
});
const updater=selected.find(row=>row.extension===config.updater);
const detached=selected.find(row=>row.extension===config.updater+'.sig');
if(detached.path!==updater.path+'.sig')throw Error('Signature must belong to the selected updater');
const signature=detached.bytes.toString('utf8');
if(!signature.trim())throw Error('Updater signature must not be empty');
// This checks release metadata only. Native updater verification authenticates the
// minisign global signature before it trusts this same tab-separated version field.
const encoded=signature.trim(),decoded=Buffer.from(encoded,'base64');
const lines=decoded.toString('utf8').trimEnd().split(/\r?\n/);
if(decoded.toString('base64')!==encoded||lines.length!==4||!lines[0].startsWith('untrusted comment: ')||!lines[2].startsWith('trusted comment: '))throw Error('Malformed updater signature: signed version required');
const signedVersions=lines[2].slice('trusted comment: '.length).split('\t').filter(field=>field.startsWith('version:')).map(field=>field.slice('version:'.length));
if(signedVersions.length!==1||signedVersions[0]!==version)throw Error('Updater signed version must match package.json version');
mkdirSync(output,{recursive:true});
const prefix=`BillZen-${version}-${platform}`;
const records=selected.map(({extension,path,bytes})=>{
 const file=prefix+extension;copyFileSync(path,join(output,file));
 return {file,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
});
writeFileSync(join(output,prefix+'-SHA256SUMS.txt'),records.map(r=>`${r.sha256}  ${r.file}`).join('\n')+'\n');
writeFileSync(join(output,prefix+'-build-info.json'),JSON.stringify({version,commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,target,platform,
 signing:platform==='macOS-AppleSilicon'?'ad-hoc, not notarized':platform==='Windows-x64'?'unsigned Authenticode':'unsigned package',updaterSigning:'Tauri detached signature',runtimeTested:false,artifacts:records},null,2)+'\n');
writeFileSync(join(output,prefix+'-update.json'),JSON.stringify({version,platforms:{[config.key]:{signature,url:`https://github.com/MohammedJabir18/BillZen/releases/download/v${version}/${prefix}${config.updater}`}}},null,2)+'\n');
console.log(JSON.stringify(records));
