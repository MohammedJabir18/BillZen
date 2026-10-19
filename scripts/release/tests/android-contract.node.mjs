import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Rust/Kotlin installer handoff agrees on internal private cache and survives view loss',()=>{
 const rust=readFileSync('src-tauri/src/commands/updates.rs','utf8');
 assert(!rust.includes('.cache_dir()'),'generic cache_dir resolves to external Android cache');
 const hook=readFileSync('src/hooks/useUpdateStartupCheck.ts','utf8');
 assert(hook.includes('isUpdateInstallerActive'),'root lifecycle must reconcile installer after Settings is lost');
});
