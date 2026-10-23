const baseUrl=process.env.BILLZEN_TEST_URL || 'http://localhost:5173';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto(baseUrl);
 await page.evaluate(async()=>{
  const api=await import('/src/adapters/tauri.ts');const bridge=await import('/src/adapters/web_customer_cashbook.ts');const cash=await import('/src/adapters/cashbook.ts');const {workspaceTransaction}=await import('/src/adapters/web_workspace.ts');
  const a=await api.createCustomer({name:'Same name',country:'IND'}),b=await api.createCustomer({name:'Same name',country:'IND'});
  const [p,q]=await Promise.all([bridge.ensureWebCustomerCashbookParty({customer_id:a.id}),bridge.ensureWebCustomerCashbookParty({customer_id:a.id})]);
  if(p.id!==q.id)throw Error('Concurrent ensure duplicated party');
  let rejected=false;try{await bridge.ensureWebCustomerCashbookParty({customer_id:b.id,existing_party_id:p.id});}catch(e){rejected=String(e).includes('PARTY_LINK_CONFLICT');}if(!rejected)throw Error('Foreign link was stolen');
  await api.updateCustomer({...a,name:'Renamed contact'});if((await cash.getCashbookParties()).find(x=>x.id===p.id).name!=='Renamed contact')throw Error('Projection stale');
  const extra=await cash.createCashbookParty({name:'Legacy link',party_type:'customer',customer_id:a.id});
  rejected=false;try{await bridge.ensureWebCustomerCashbookParty({customer_id:a.id});}catch(e){rejected=String(e).includes('PARTY_SELECTION_REQUIRED');}if(!rejected)throw Error('Ambiguous links silently chosen');
  await bridge.ensureWebCustomerCashbookParty({customer_id:a.id,existing_party_id:p.id});
  await workspaceTransaction(true,t=>{t.cashbook_parties.find(x=>x.id===extra.id).is_archived=true;});
  rejected=false;try{await bridge.ensureWebCustomerCashbookParty({customer_id:a.id,existing_party_id:extra.id});}catch(e){rejected=String(e).includes('PARTY_ARCHIVED');}if(!rejected)throw Error('Archived party accepted');
  const history=await bridge.getWebCustomerCashHistory({customer_id:b.id});if(history.entries.length||history.net_movement_minor)throw Error('Same-name customer leaked history');
 });
 console.log('PASS bridge concurrency, explicit selection, foreign/archived rejection, projection, same-name isolation');
}finally{await browser.close();}
