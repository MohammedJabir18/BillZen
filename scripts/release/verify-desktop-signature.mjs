import {readFileSync} from 'node:fs';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Maintainer acceptance check, independent of the runtime updater's authoritative
// minisign-verify implementation. Never reads a signing private key or password.
export function verifyDesktopSignature(bytes,encodedSignature,encodedPublicKey,version){
 const keyLines=Buffer.from(encodedPublicKey.trim(),'base64').toString('utf8').trimEnd().split(/\r?\n/);
 const lines=Buffer.from(encodedSignature.trim(),'base64').toString('utf8').trimEnd().split(/\r?\n/);
 if(keyLines.length!==2||lines.length!==4||!lines[2].startsWith('trusted comment: '))throw Error('Malformed minisign envelope');
 const key=Buffer.from(keyLines[1],'base64'),packet=Buffer.from(lines[1],'base64'),global=Buffer.from(lines[3],'base64');
 if(key.length!==42||packet.length!==74||global.length!==64||!key.subarray(2,10).equals(packet.subarray(2,10)))throw Error('Signing key identity mismatch');
 const algorithm=packet.subarray(0,2).toString('ascii');
 if(!['ED','Ed'].includes(algorithm))throw Error('Unsupported signature algorithm');
 const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key.subarray(10)]),type:'spki',format:'der'});
 const signature=packet.subarray(10),comment=lines[2].slice(17);
 const message=algorithm==='ED'?createHash('blake2b512').update(bytes).digest():bytes;
 if(!verify(null,message,publicKey,signature)||!verify(null,Buffer.concat([signature,Buffer.from(comment)]),publicKey,global))throw Error('Invalid artifact or trusted-comment signature');
 const versions=comment.split('\t').filter(field=>field.startsWith('version:')).map(field=>field.slice(8));
 if(versions.length!==1||versions[0]!==version)throw Error('Authenticated version mismatch');
 return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/release/verify-desktop-signature.mjs ARTIFACT [SIGNATURE]');
 const config=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8'));
 verifyDesktopSignature(readFileSync(file),readFileSync(process.argv[3]??file+'.sig','utf8'),config.plugins.updater.pubkey,config.version);
 console.log(`Verified artifact bytes, signing key and authenticated version ${config.version}: ${file}`);
}
