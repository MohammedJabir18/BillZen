import {createPublicKey,sign,verify} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateVersion} from './version.mjs';
export function signManifest(payload,privateKey,pinnedPublicKey){
 validateVersion({version:payload.version,androidVersionCode:payload.versionCode});
 if(payload.keyId!=='billzen-android-v1'||payload.channel!=='stable'||payload.packageId!=='com.billzen.desktop'||Buffer.byteLength(payload.notes)>8192||!Number.isFinite(Date.parse(payload.issuedAt))||!payload.artifacts||!Object.keys(payload.artifacts).length) throw new Error('Invalid release payload');
 for(const [abi,a] of Object.entries(payload.artifacts)){
  const url=new URL(a.url);const prefix=`/MohammedJabir18/BillZen/releases/download/v${payload.version}/`;
  if(!['arm64-v8a','x86_64','armeabi-v7a'].includes(abi)||url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(prefix)||url.pathname.slice(prefix.length).includes('/')||!url.pathname.endsWith('.apk')||/debug|test/i.test(url.pathname)||!Number.isSafeInteger(a.sizeBytes)||a.sizeBytes<=0||a.sizeBytes>268435456||!Number.isInteger(a.minSdk)||a.minSdk<24||!/^[a-f0-9]{64}$/.test(a.sha256))throw new Error('Invalid Android release artifact');
 }
 const publicKey=createPublicKey(privateKey);const actual=publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
 if(actual!==pinnedPublicKey)throw new Error('Manifest key does not match the public key pinned into the APK');
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');if(bytes.length>65536)throw new Error('Payload too large');
 const signature=sign(null,bytes,privateKey);
 if(!verify(null,bytes,publicKey,signature))throw new Error('Generated signature did not verify');
 return {schemaVersion:1,keyId:payload.keyId,payloadBase64:bytes.toString('base64'),signatureBase64:signature.toString('base64')};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [payloadPath,output]=process.argv.slice(2);
 if(!payloadPath||!output||!process.env.BILLZEN_ANDROID_MANIFEST_KEY_PATH||!process.env.BILLZEN_ANDROID_UPDATE_PUBLIC_KEY) throw new Error('Usage: manifest.mjs payload.json output.json; signing key path and pinned public key environment are required');
 const envelope=signManifest(JSON.parse(readFileSync(payloadPath,'utf8')),readFileSync(process.env.BILLZEN_ANDROID_MANIFEST_KEY_PATH),process.env.BILLZEN_ANDROID_UPDATE_PUBLIC_KEY);
 writeFileSync(output,JSON.stringify(envelope,null,2)+'\n');
 console.log('Signed Android manifest verified and written.');
}
