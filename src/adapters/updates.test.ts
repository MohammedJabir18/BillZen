import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {invoke,tauri}=vi.hoisted(()=>({invoke:vi.fn(),tauri:vi.fn(()=>true)}));
vi.mock('@tauri-apps/api/core',()=>({invoke}));
vi.mock('./tauri',()=>({isTauriEnvironment:tauri}));
import {getUpdateStatus,checkAndroidUpdate,downloadAndroidUpdate,installAndroidUpdate,cancelUpdate,resumeAfterUpdate} from './updates';

beforeEach(()=>{vi.stubGlobal('window',{});invoke.mockReset();tauri.mockReturnValue(true);});
afterEach(()=>vi.unstubAllGlobals());
describe('desktop updater routing',()=>{
 it.each([
  [getUpdateStatus,'get_desktop_update_status'],[checkAndroidUpdate,'check_desktop_update'],
  [downloadAndroidUpdate,'download_desktop_update'],[installAndroidUpdate,'install_desktop_update'],[cancelUpdate,'cancel_desktop_update'],
 ])('routes native desktop action without arguments',async(action,command)=>{
  invoke.mockResolvedValue({status:'ready',message:'Ready'});
  await action();expect(invoke).toHaveBeenCalledExactlyOnceWith(command);
 });
 it('never releases the desktop installation pause through Android resume',async()=>{
  await resumeAfterUpdate();expect(invoke).not.toHaveBeenCalled();
 });
 it('propagates native installation errors',async()=>{
  invoke.mockRejectedValue(new Error('Backup failed'));
  await expect(installAndroidUpdate()).rejects.toThrow('Backup failed');
  expect(invoke).toHaveBeenCalledExactlyOnceWith('install_desktop_update');
 });
 it('keeps browser update actions unavailable without native calls',async()=>{
  tauri.mockReturnValue(false);
  expect((await getUpdateStatus()).status).toBe('unavailable');
  expect((await checkAndroidUpdate()).status).toBe('unavailable');
  await expect(downloadAndroidUpdate()).rejects.toThrow();
  await expect(installAndroidUpdate()).rejects.toThrow();
  await cancelUpdate();expect(invoke).not.toHaveBeenCalled();
 });
});
describe('Android updater routing',()=>{
 beforeEach(()=>vi.stubGlobal('window',{BillZenNative:{getUpdateDevice:()=>'{"versionCode":1010}',installUpdate:()=> 'started'}}));
 it('preserves device check, verified preparation and Java installer',async()=>{
  await getUpdateStatus();expect(invoke).toHaveBeenLastCalledWith('get_update_status');
  await checkAndroidUpdate();expect(invoke).toHaveBeenLastCalledWith('check_android_update',{device:{versionCode:1010}});
  await downloadAndroidUpdate();expect(invoke).toHaveBeenLastCalledWith('download_android_update');
  expect(await installAndroidUpdate()).toBe('started');expect(invoke).toHaveBeenLastCalledWith('prepare_android_update');
  await cancelUpdate();expect(invoke).toHaveBeenLastCalledWith('cancel_update');
  await resumeAfterUpdate();expect(invoke).toHaveBeenLastCalledWith('resume_after_update');
 });
 it('releases Android pause after Java installer rejects',async()=>{
  (window as unknown as {BillZenNative:{installUpdate:()=>string}}).BillZenNative.installUpdate=()=> 'error:Installer rejected';
  await expect(installAndroidUpdate()).rejects.toThrow('Installer rejected');
  expect(invoke).toHaveBeenLastCalledWith('resume_after_update');
 });
});
