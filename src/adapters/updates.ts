import {invoke} from '@tauri-apps/api/core';
import {isTauriEnvironment} from './tauri';
import type {UpdateInfo} from '../domain/update_state';
export interface AndroidUpdateBridge {
 getUpdateDevice():string;
 isUpdateInstallerActive():boolean;
 installUpdate():string;
}
export function androidUpdateBridge():AndroidUpdateBridge|undefined {
 return (window as unknown as {BillZenNative?:AndroidUpdateBridge}).BillZenNative;
}
export async function getUpdateStatus():Promise<UpdateInfo> {
 if (!isTauriEnvironment() || !androidUpdateBridge()?.getUpdateDevice) return {status:'unavailable',message:'In-app updates are available in supported Android installations. Browser updates follow the website deployment.'};
 return invoke('get_update_status');
}
export async function checkAndroidUpdate():Promise<UpdateInfo> {
 const bridge=androidUpdateBridge();
 if(!bridge?.getUpdateDevice) return getUpdateStatus();
 return invoke('check_android_update',{device:JSON.parse(bridge.getUpdateDevice())});
}
export async function downloadAndroidUpdate():Promise<UpdateInfo> {return invoke('download_android_update');}
export async function installAndroidUpdate():Promise<string> {
 const bridge=androidUpdateBridge();if(!bridge) throw new Error('Android installer is unavailable');
 await invoke('prepare_android_update');
 try { const result=bridge.installUpdate();if(result.startsWith('error:')) throw new Error(result.slice(6)); return result; }
 catch(error){await resumeAfterUpdate();throw error;}
}
export async function resumeAfterUpdate():Promise<void>{if(isTauriEnvironment()) await invoke('resume_after_update');}
export async function cancelUpdate():Promise<void>{await invoke('cancel_update');}
