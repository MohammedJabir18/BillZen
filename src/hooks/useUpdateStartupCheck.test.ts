import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({bridge:vi.fn(),check:vi.fn(),status:vi.fn(),resume:vi.fn(),tauri:vi.fn(),cleanup:undefined as undefined|(()=>void)}));
vi.mock('react',()=>({useEffect:(effect:()=>()=>void)=>{mocks.cleanup=effect();}}));
vi.mock('../adapters/updates',()=>({androidUpdateBridge:mocks.bridge,checkAndroidUpdate:mocks.check,getUpdateStatus:mocks.status,resumeAfterUpdate:mocks.resume}));
vi.mock('../adapters/tauri',()=>({isTauriEnvironment:mocks.tauri}));
import {useUpdateStartupCheck} from './useUpdateStartupCheck';
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T00:00:00Z'));vi.clearAllMocks();
 mocks.bridge.mockReturnValue(undefined);mocks.tauri.mockReturnValue(true);mocks.check.mockResolvedValue({status:'unavailable',message:'AppImage required'});mocks.status.mockResolvedValue({status:'installing'});mocks.resume.mockResolvedValue(undefined);
 const events=new EventTarget();const storage=new Map<string,string>();
 vi.stubGlobal('window',events);vi.stubGlobal('navigator',{onLine:true});
 vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
});
afterEach(()=>{mocks.cleanup?.();vi.unstubAllGlobals();vi.useRealTimers();});
it('checks desktop once daily without download/install or Android resume',async()=>{
 useUpdateStartupCheck();await Promise.resolve();await Promise.resolve();
 expect(mocks.check).toHaveBeenCalledOnce();expect(mocks.resume).not.toHaveBeenCalled();
 window.dispatchEvent(new Event('online'));expect(mocks.check).toHaveBeenCalledOnce();
 vi.advanceTimersByTime(24*60*60*1000);window.dispatchEvent(new Event('online'));expect(mocks.check).toHaveBeenCalledTimes(2);
});
it('keeps browser and offline startup quiet',()=>{
 mocks.tauri.mockReturnValue(false);useUpdateStartupCheck();expect(mocks.check).not.toHaveBeenCalled();mocks.cleanup?.();
 mocks.tauri.mockReturnValue(true);vi.stubGlobal('navigator',{onLine:false});useUpdateStartupCheck();expect(mocks.check).not.toHaveBeenCalled();
});
it('preserves Android system installer reconciliation',async()=>{
 mocks.bridge.mockReturnValue({getUpdateDevice:()=> '{}',isUpdateInstallerActive:()=>false});
 useUpdateStartupCheck();await Promise.resolve();expect(mocks.check).toHaveBeenCalledOnce();expect(mocks.resume).toHaveBeenCalledOnce();
});
it('does not resume an active Android installer',async()=>{
 mocks.bridge.mockReturnValue({getUpdateDevice:()=> '{}',isUpdateInstallerActive:()=>true});
 useUpdateStartupCheck();await Promise.resolve();expect(mocks.resume).not.toHaveBeenCalled();
});
