import {useEffect} from 'react';
import {androidUpdateBridge,checkAndroidUpdate,getUpdateStatus,resumeAfterUpdate} from '../adapters/updates';
import {shouldCheckForUpdate} from '../domain/update_state';
export function useUpdateStartupCheck(){
 useEffect(()=>{
  let checking=false;
  const check=()=>{
   if(!androidUpdateBridge()?.getUpdateDevice||checking)return;
   let last=0;try{last=Number(localStorage.getItem('billzen_update_last_check')||0);}catch{}
   if(!shouldCheckForUpdate(navigator.onLine,last))return;
   checking=true;
   try{localStorage.setItem('billzen_update_last_check',String(Date.now()));}catch{}
   void checkAndroidUpdate().catch(()=>{}).finally(()=>{checking=false;});
  };
  const reconcile=()=>{
   const bridge=androidUpdateBridge();if(!bridge?.isUpdateInstallerActive)return;
   void getUpdateStatus().then(info=>{
    if(info.status==='installing'&&!bridge.isUpdateInstallerActive()) return resumeAfterUpdate();
   }).catch(()=>{});
  };
  check();reconcile();window.addEventListener('online',check);
  window.addEventListener('billzen-update-returned',reconcile);
  const timer=window.setInterval(reconcile,1000);
  return()=>{clearInterval(timer);window.removeEventListener('online',check);window.removeEventListener('billzen-update-returned',reconcile);};
 },[]);
}
