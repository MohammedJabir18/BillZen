import {useEffect,useRef,useState} from 'react';
import {useIsMutating} from '@tanstack/react-query';
import {Download,RefreshCw,ShieldCheck} from 'lucide-react';
import {getUpdateStatus,checkAndroidUpdate,downloadAndroidUpdate,installAndroidUpdate,cancelUpdate,resumeAfterUpdate,androidUpdateBridge} from '../adapters/updates';
import {CashbookDialog} from './CashbookDialog';
import {canInstallUpdate,type UpdateInfo} from '../domain/update_state';

export function UpdatesSettings({hasUnsavedChanges=false,workspaceBusy=false}:{hasUnsavedChanges?:boolean;workspaceBusy?:boolean}){
 const [info,setInfo]=useState<UpdateInfo>({status:'idle',message:'Check for updates when you are online.'});
 const [busy,setBusy]=useState(false);const [installPending,setInstalling]=useState(false);
 const desktop=!androidUpdateBridge()?.getUpdateDevice;
 const installInFlight=useRef(false);
 const installing=installPending||info.status==='installing';const mutations=useIsMutating();
 const [online,setOnline]=useState(navigator.onLine);
 async function run(action:()=>Promise<UpdateInfo>){setBusy(true);try{setInfo(await action());}catch(error){setInfo({status:'error',message:String(error)});}finally{setBusy(false);}}
 useEffect(()=>{
  let alive=true;
  const refresh=()=>{void getUpdateStatus().then(v=>{if(alive&&!installInFlight.current){setInfo(v);if(v.status!=='installing')setInstalling(false);}}).catch(()=>{});};
  const network=()=>setOnline(navigator.onLine);
  const returned=()=>{if(desktop)return;void resumeAfterUpdate().then(()=>{if(alive)setInstalling(false);refresh();}).catch(error=>{if(alive)setInfo({status:'error',message:String(error)});});};
  refresh();
  window.addEventListener('online',network);window.addEventListener('offline',network);window.addEventListener('billzen-update-returned',returned);
  const timer=window.setInterval(refresh,1000);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',network);window.removeEventListener('offline',network);window.removeEventListener('billzen-update-returned',returned);};
 },[desktop]);
 async function install(){
  const dirty=Array.from(document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('form input,form textarea')).some(input=>input.value!==input.defaultValue);
  if(!canInstallUpdate({mutations:mutations+(workspaceBusy?1:0),dialog:!!document.querySelector('[role="dialog"]'),dirty:dirty||hasUnsavedChanges,ready:info.status==='ready'})){setInfo({...info,message:'Save or cancel your current changes before installing an update.'});return;}
  installInFlight.current=true;setInstalling(true);
  setInfo({...info,message:desktop?'Installing update. BillZen will restart automatically. Please keep the app open.':'Opening the Android installer. Your records remain on this device.'});
  try{
   const result=await installAndroidUpdate();
   if(!desktop)setInfo({...info,message:result==='permission'?'Allow updates from BillZen in Android settings, then return and tap Install again.':'Confirm installation in the Android system screen. Your records remain on this device.'});
  }
  catch(error){setInstalling(false);setInfo({...info,message:String(error)});}
  finally{installInFlight.current=false;}
 }
 const button='min-h-[44px] rounded-lg border border-gray-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium disabled:opacity-50';
 return <section aria-labelledby="updates-title" className="mt-6 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 text-gray-900 dark:text-zinc-100">
  <h2 id="updates-title" className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4"/>App updates</h2>
  <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">Updates preserve your local workspace. No company records are uploaded.</p>
  <p role="status" aria-live="polite" className="mt-3 text-sm break-words">{!online?'You are offline. Billing and records remain available.':info.message}</p>
  {info.version&&<p className="mt-2 text-sm font-medium">Release {info.version}</p>}
  {info.notes&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-zinc-300">{info.notes}</p>}
  {info.status==='downloading'&&<progress aria-label="Update download" className="mt-3 w-full" value={info.downloadedBytes||0} max={info.totalBytes||1}/>}
  <div className="mt-4 flex flex-wrap gap-3">
   <button type="button" className={button} disabled={!online||busy||installing||info.status==='downloading'||info.status==='checking'} onClick={()=>void run(checkAndroidUpdate)}><RefreshCw className="inline h-4 w-4 mr-2"/>Check for updates</button>
   {info.status==='available'&&<button type="button" className={button} disabled={!online||busy} onClick={()=>void run(downloadAndroidUpdate)}><Download className="inline h-4 w-4 mr-2"/>Download update</button>}
   {info.status==='downloading'&&<button type="button" className={button} onClick={()=>void run(async()=>{await cancelUpdate();return getUpdateStatus();})}>Cancel download</button>}
   {info.status==='ready'&&<button type="button" className={button} disabled={busy||installing||mutations>0||workspaceBusy||hasUnsavedChanges} onClick={()=>void install()}>Install update</button>}
  </div>
  {installing&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><CashbookDialog label="Installing update" className="max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl"><p className="text-sm">{info.message}</p>{!desktop&&<button className={button+' mt-4'} onClick={()=>{void resumeAfterUpdate().then(()=>setInstalling(false));}}>Return to BillZen</button>}</CashbookDialog></div>}
 </section>;
}
