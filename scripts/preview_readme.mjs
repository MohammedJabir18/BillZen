// Local preview of GitHub API-rendered GFM with a lightweight reading stylesheet.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const style=`*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#e6edf3;font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}article{max-width:1012px;margin:auto;padding:32px}img{max-width:100%;height:auto}h2{font-size:25px;border-bottom:1px solid #30363d;padding-bottom:8px;margin-top:32px}h3{font-size:20px}a{color:#a5d979;text-decoration:none}a:hover{text-decoration:underline}p,table,blockquote,details,pre{margin:16px 0}table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}td,th{padding:9px 13px;border:1px solid #30363d}tr:nth-child(even){background:#161b22}th{text-align:left}code,pre{font-family:ui-monospace,monospace}code{background:#263027;border-radius:5px;padding:2px 5px}pre{padding:18px;background:#161b22;border-radius:8px;overflow:auto}pre code{background:none;padding:0}blockquote,.markdown-alert{border-left:4px solid #86ae55;padding:0 16px;color:#b5c4b0}summary{cursor:pointer}hr{border:0;border-top:1px solid #30363d;margin:32px 0}sub{color:#9da993}li{margin:5px 0}@media(max-width:600px){article{padding:16px}body{font-size:15px}h2{font-size:22px}}@media(prefers-color-scheme:light){body{background:white;color:#1f2328}a{color:#34720f}tr:nth-child(even),pre{background:#f6f8fa}code{background:#eef3e9}td,th,h2,hr{border-color:#d0d7de}blockquote,.markdown-alert{color:#465442;border-color:#548624}}`;
const rendered=await readFile('test_artifacts/readme-refresh/github-rendered.html','utf8');
const server=createServer(async(req,res)=>{try{
 if(req.url==='/__readme'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style><article>'+rendered+'</article>');return;}
 const file=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));assert(file.startsWith(process.cwd()+path.sep));
 const ext=path.extname(file);res.setHeader('Content-Type',({'.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.html':'text/html'}[ext]||'application/octet-stream'));res.end(await readFile(file));
}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  // Badge hosts are documentation-only; local preview checks local images independently.
  await page.route(/^https:\/\//,route=>route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/__readme`,{waitUntil:'load'});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('img')).filter(i=>i.getAttribute('src')?.startsWith('docs/')||i.getAttribute('src')?.startsWith('public/')).every(i=>i.complete&&i.naturalWidth>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document horizontal overflow');
  assert.equal(await page.locator('picture').count(),3);assert((await page.locator('img').first().getAttribute('alt')).includes('BillZen'));
  await page.screenshot({path:`test_artifacts/readme-refresh/readme-${width}.png`,fullPage:true});
  for(const item of await page.locator('details').all())await item.evaluate(el=>el.open=true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'expanded galleries remain contained');
  await page.close();console.log('PASS rendered GFM/media/expanded layout at width',width);
 }
}finally{await browser.close();server.close();}
