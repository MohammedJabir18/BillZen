// Only synthetic records in a temporary directory; no installed app or business data.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'billzen-transfer-interop-'));
const native=join(dir,'native.json'),web=join(dir,'web.json');
const run=(cmd,args,env={})=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:'inherit',env:{...process.env,...env}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${cmd} failed: ${code}`)));});
try{
 await run('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--test','transfer_backup_tests','paired_transfer_backup_roundtrip'],{BILLZEN_TRANSFER_FIXTURE:native});
 await run(process.execPath,['scripts/verify_web_transfers.js'],{BILLZEN_NATIVE_TRANSFER_FIXTURE:native,BILLZEN_WEB_TRANSFER_FIXTURE:web});
 await run('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--test','transfer_backup_tests','browser_fixture_import','--','--ignored'],{BILLZEN_WEB_TRANSFER_FIXTURE:web});
 console.log('PASS native → browser → native transfer backup 1.1: identifiers, snapshots, reversals and audit preserved');
}finally{await rm(dir,{recursive:true,force:true});}
