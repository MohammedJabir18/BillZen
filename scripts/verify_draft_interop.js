// Only synthetic records in a temporary directory; no installed app or business data.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'billzen-draft-interop-'));
const native=join(dir,'native.json'),web=join(dir,'web.json');
const run=(cmd,args,env={})=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:'inherit',env:{...process.env,...env}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${cmd} failed: ${code}`)));});
try{
 await run('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--test','invoice_draft_tests','portable_draft_journal_roundtrip'],{BILLZEN_DRAFT_FIXTURE:native});
 await run(process.execPath,['scripts/verify_invoice_drafts.js'],{BILLZEN_NATIVE_DRAFT_FIXTURE:native,BILLZEN_WEB_DRAFT_FIXTURE:web});
 await run('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--test','invoice_draft_tests','browser_draft_fixture_import','--','--ignored'],{BILLZEN_WEB_DRAFT_FIXTURE:web});
 console.log('PASS native → browser → native draft backup 1.2: draft IDs, exact totals, lines and retry/deletion journal preserved');
}finally{await rm(dir,{recursive:true,force:true});}
