import {invoke} from '@tauri-apps/api/core';
import {isTauriEnvironment} from './tauri';
import {openWebDb} from './web_cashbook_db';
export interface DraftRecovery {schema:1;source_id:string|null;source_version:number|null;form:unknown;pending:unknown}
let queue:Promise<unknown>=Promise.resolve();
export async function readDraftRecovery():Promise<DraftRecovery|null>{
 await queue.catch(()=>{});if(isTauriEnvironment())return invoke('get_draft_editor_recovery');
 const db=await openWebDb();if(!db)throw Error('Durable storage unavailable');
 return new Promise((resolve,reject)=>{const tx=db.transaction('draft_editor_recovery','readonly');const req=tx.objectStore('draft_editor_recovery').get('editor');let value:DraftRecovery|null=null;req.onsuccess=()=>{value=req.result?.value??null;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error);});
}
export function writeDraftRecovery(value:DraftRecovery|null):Promise<void>{
 const operation=queue.catch(()=>{}).then(async()=>{
 if(isTauriEnvironment()){await invoke('set_draft_editor_recovery',{value});return;}
 const db=await openWebDb();if(!db)throw Error('Durable storage unavailable');
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('draft_editor_recovery','readwrite');const store=tx.objectStore('draft_editor_recovery');if(value)store.put({id:'editor',value});else store.delete('editor');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);});
 });queue=operation;return operation;
}
/** One browser editor owns the shared recovery record until it leaves Sales. */
export function acquireDraftEditorLease(signal:AbortSignal):Promise<(()=>void)|null>{
 if(isTauriEnvironment())return Promise.resolve(()=>{});
 if(!navigator.locks)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  const controller=new AbortController();const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)controller.abort();
  const timeout=setTimeout(()=>controller.abort(),500);
  navigator.locks.request('billzen-draft-editor',{signal:controller.signal},async()=>{
   clearTimeout(timeout);if(signal.aborted){resolve(null);return;}
   await new Promise<void>(release=>{signal.addEventListener('abort',()=>release(),{once:true});resolve(()=>release());});
  }).catch(error=>controller.signal.aborted?resolve(null):reject(error)).finally(()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);});
 });
}
