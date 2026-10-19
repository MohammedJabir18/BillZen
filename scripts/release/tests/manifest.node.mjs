import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {signManifest} from '../manifest.mjs';
const fixture=JSON.parse((await import('node:fs/promises')).readFile?await (await import('node:fs/promises')).readFile('src-tauri/tests/fixtures/android-update.json','utf8'):'');
const payload=JSON.parse(Buffer.from(fixture.envelope.payloadBase64,'base64'));
test('publisher signs exact UTF-8 payload bytes with a separately pinned public key',()=>{
 const keys=generateKeyPairSync('ed25519');
 const envelope=signManifest(payload,keys.privateKey,keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64'));
 assert.equal(verify(null,Buffer.from(envelope.payloadBase64,'base64'),keys.publicKey,Buffer.from(envelope.signatureBase64,'base64')),true);
 assert.deepEqual(JSON.parse(Buffer.from(envelope.payloadBase64,'base64')),payload);
 assert.throws(()=>signManifest(payload,keys.privateKey,Buffer.alloc(32).toString('base64')));
});
test('publisher refuses untrusted artifact URLs, debug APKs and inconsistent release metadata',()=>{
 const keys=generateKeyPairSync('ed25519');const key=keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
 for(const url of ['http://github.com/MohammedJabir18/BillZen/releases/download/v0.1.1/a.apk','https://evil.test/a.apk','https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.1/a-debug.apk']){
  assert.throws(()=>signManifest({...payload,artifacts:{'arm64-v8a':{...payload.artifacts['arm64-v8a'],url}}},keys.privateKey,key));
 }
 assert.throws(()=>signManifest({...payload,versionCode:0},keys.privateKey,key));
});
test('the shared native fixture has a valid publisher signature',()=>{
 const publicKey=fixture.publicKey;
 const key=(Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKey,'base64')]));
 assert.equal(verify(null,Buffer.from(fixture.envelope.payloadBase64,'base64'),{key,format:'der',type:'spki'},Buffer.from(fixture.envelope.signatureBase64,'base64')),true);
});
