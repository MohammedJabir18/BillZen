import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVersion, validateAlignment } from '../version.mjs';

test('only valid SemVer and increasing Android codes are accepted', () => {
  assert.doesNotThrow(() => validateVersion({version:'0.1.1',androidVersionCode:1005},1004));
  for (const input of [{version:'latest',androidVersionCode:1005},{version:'0.1.1',androidVersionCode:1004},{version:'0.1.1',androidVersionCode:1005.5}]) {
    assert.throws(() => validateVersion(input,1004));
  }
});
test('release refuses mismatched package versions and Android metadata', () => {
  const version={version:'0.1.1',androidVersionCode:1005};
  const files={package:{version:'0.1.1'},tauri:{version:'0.1.1',bundle:{android:{versionCode:1005}}},cargo:'[package]\nname="billzen"\nversion="0.1.1"\n'};
  assert.doesNotThrow(() => validateAlignment(version,files));
  assert.throws(() => validateAlignment(version,{...files,package:{version:'0.1.0'}}));
  assert.throws(() => validateAlignment(version,{...files,tauri:{version:'0.1.1',bundle:{android:{versionCode:1004}}}}));
});
test('build environment cannot override authoritative release identity',async()=>{
 const {validateEffectiveVersion}=await import('../version.mjs');
 const metadata={version:'0.1.1',androidVersionCode:1005};
 assert.doesNotThrow(()=>validateEffectiveVersion(metadata,{BILLZEN_VERSION_NAME:'0.1.1',BILLZEN_VERSION_CODE:'1005'}));
 assert.throws(()=>validateEffectiveVersion(metadata,{BILLZEN_VERSION_CODE:'1004'}));
 assert.throws(()=>validateEffectiveVersion(metadata,{BILLZEN_VERSION_NAME:'0.1.0'}));
});
