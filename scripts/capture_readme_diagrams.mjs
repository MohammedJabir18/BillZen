// Static SVG-region previews from exact checked Archify publication copies.
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 for(const [file,name,theme]of [['billzen-runtime','architecture-dark','dark'],['billzen-runtime','architecture-light','light'],['business-workflow','business-workflow','dark']]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(pathToFileURL(path.resolve(`docs/diagrams/${file}.html`)).href);
  const current=await page.locator('html').getAttribute('data-theme');
  if(current!==theme)await page.getByRole('button',{name:'Toggle color theme'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  // Only the temporary capture DOM hides controls; checked HTML is unchanged.
  await page.addStyleTag({content:'button { visibility: hidden !important; }'});
  await page.locator('svg').first().screenshot({path:`docs/assets/current/${name}.png`});
  console.log(`Captured ${theme} static SVG preview: ${name}`);await context.close();
 }
}finally{await browser.close();}
