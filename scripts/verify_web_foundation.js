import { spawn } from 'node:child_process';
const url='http://127.0.0.1:4194';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4194','--strictPort'],{stdio:'ignore'});
try{
 let ready=false;
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Foundation test server exited');try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Foundation server did not start');
 for(const file of ['verify_web_catalog_persistence.js','verify_web_workspace.js','verify_web_upgrade_blocked.js','verify_customer_bridge.js']){
  await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[`scripts/${file}`],{stdio:'inherit',env:{...process.env,BILLZEN_TEST_URL:url}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${file} failed: ${code}`)));});
 }
}finally{server.kill('SIGTERM');}
