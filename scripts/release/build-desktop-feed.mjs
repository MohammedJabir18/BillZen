import {readdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const platforms={
 'darwin-aarch64':['macOS-AppleSilicon','.app.tar.gz'],
 'windows-x86_64':['Windows-x64','.exe'],
 'linux-x86_64':['Linux-x64','.AppImage']
};
export function buildDesktopFeed(directory,version){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('A stable package.json version is required');
 const fragments=[];
 function visit(dir){for(const row of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,row.name);
  if(row.isDirectory())visit(path);else if(row.isFile()&&row.name.endsWith('-update.json')&&row.name!=='desktop-update.json')fragments.push(path);
 }}
 visit(directory);
 const feed={version,platforms:{}};
 for(const path of fragments){
  const fragment=JSON.parse(readFileSync(path,'utf8'));
  if(fragment.version!==version||!fragment.platforms||Object.keys(fragment.platforms).length!==1)throw Error('Fragment version/platform count mismatch');
  const [key,artifact]=Object.entries(fragment.platforms)[0],spec=platforms[key];
  if(!spec||feed.platforms[key])throw Error('Unknown or duplicate updater platform');
  const [platform,extension]=spec,file=`BillZen-${version}-${platform}${extension}`;
  const expected=`https://github.com/MohammedJabir18/BillZen/releases/download/v${version}/${file}`;
  if(artifact?.url!==expected)throw Error('Untrusted or mismatched immutable updater URL');
  if(typeof artifact.signature!=='string'||!artifact.signature.trim())throw Error('Empty updater signature');
  const local=join(dirname(path),file),sig=local+'.sig';
  if(!statSync(local).isFile()||statSync(local).size===0||!statSync(sig).isFile())throw Error('Missing or empty local updater artifact');
  if(readFileSync(sig,'utf8')!==artifact.signature)throw Error('Detached updater signature mismatch');
  feed.platforms[key]={signature:artifact.signature,url:artifact.url};
 }
 if(Object.keys(feed.platforms).length!==3)throw Error('All three desktop updater platforms are required');
 return feed;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const directory=process.argv[2]??'dist-desktop/packages',output=process.argv[3]??join(directory,'desktop-update.json');
 const {version}=JSON.parse(readFileSync('package.json','utf8'));
 const feed=buildDesktopFeed(directory,version);
 writeFileSync(output,JSON.stringify(feed,null,2)+'\n');
 console.log(`Verified desktop update feed ${version} with three signed platform artifacts.`);
}
