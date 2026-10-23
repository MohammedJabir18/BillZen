import {invoke} from '@tauri-apps/api/core';
import {isTauriEnvironment} from './tauri';
import type {UpdateInfo} from '../domain/update_state';
export interface AndroidUpdateBridge {
 getUpdateDevice():string;
 isUpdateInstallerActive():boolean;
 installUpdate():string;
}
export function androidUpdateBridge():AndroidUpdateBridge|undefined {
 return typeof window === 'undefined' ? undefined : (window as unknown as {BillZenNative?:AndroidUpdateBridge}).BillZenNative;
}
export async function getUpdateStatus():Promise<UpdateInfo> {
 if (!isTauriEnvironment()) return {status:'unavailable',message:'Browser updates follow the website deployment. Install BillZen for in-app updates.'};
 return invoke(androidUpdateBridge()?.getUpdateDevice ? 'get_update_status' : 'get_desktop_update_status');
}
export async function checkAndroidUpdate():Promise<UpdateInfo> {
 const bridge=androidUpdateBridge();
 if(!isTauriEnvironment()) return getUpdateStatus();
 if(!bridge?.getUpdateDevice) return invoke('check_desktop_update');
 return invoke('check_android_update',{device:JSON.parse(bridge.getUpdateDevice())});
}
export async function downloadAndroidUpdate():Promise<UpdateInfo> {
 if(!isTauriEnvironment()) throw new Error('In-app updates require an installed BillZen app');
 return invoke(androidUpdateBridge()?.getUpdateDevice ? 'download_android_update' : 'download_desktop_update');
}
export async function installAndroidUpdate():Promise<string|void> {
 if(!isTauriEnvironment()) throw new Error('In-app updates require an installed BillZen app');
 const bridge=androidUpdateBridge();
 if(!bridge?.getUpdateDevice) {await invoke('install_desktop_update');return;}
 await invoke('prepare_android_update');
 try { const result=bridge.installUpdate();if(result.startsWith('error:')) throw new Error(result.slice(6)); return result; }
 catch(error){await resumeAfterUpdate();throw error;}
}
export async function resumeAfterUpdate():Promise<void>{if(isTauriEnvironment()&&androidUpdateBridge()?.getUpdateDevice) await invoke('resume_after_update');}
export async function cancelUpdate():Promise<void>{
 if(isTauriEnvironment()) await invoke(androidUpdateBridge()?.getUpdateDevice ? 'cancel_update' : 'cancel_desktop_update');
}
