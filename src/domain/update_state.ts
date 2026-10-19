export type UpdateStatus = 'installing' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'unavailable' | 'error';
export interface UpdateInfo { status: UpdateStatus; message: string; version?: string; versionCode?: number; notes?: string; downloadedBytes?: number; totalBytes?: number }
export function shouldCheckForUpdate(online: boolean, lastCheck: number, now = Date.now()): boolean {
  return online && Number.isFinite(lastCheck) && now - lastCheck >= 24 * 60 * 60 * 1000;
}
export function canInstallUpdate(state: { mutations:number; dialog:boolean; dirty:boolean; ready:boolean }): boolean {
  return state.ready && state.mutations === 0 && !state.dialog && !state.dirty;
}
