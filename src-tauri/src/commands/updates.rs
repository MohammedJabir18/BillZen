use crate::{db::worker::DbWorkerHandle,updates::{self,UpdateDevice,VerifiedUpdate}};
use serde::Serialize;
use std::sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}};
use tauri::{Manager,State};

#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct UpdateInfo {
 status:String, message:String, version:Option<String>, version_code:Option<u64>,notes:Option<String>,downloaded_bytes:u64,total_bytes:u64,
}
impl UpdateInfo {
 fn new(status:&str,message:&str)->Self {Self{status:status.into(),message:message.into(),version:None,version_code:None,notes:None,downloaded_bytes:0,total_bytes:0}}
 fn release(status:&str,message:&str,v:&VerifiedUpdate)->Self {Self{version:Some(v.version.clone()),version_code:Some(v.version_code),notes:Some(v.notes.clone()),total_bytes:v.artifact.size_bytes,..Self::new(status,message)}}
}
pub struct UpdateService { info:Mutex<UpdateInfo>, release:Mutex<Option<VerifiedUpdate>>, busy:AtomicBool, cancel:AtomicBool }
impl Default for UpdateService {fn default()->Self {Self{info:Mutex::new(UpdateInfo::new("idle","Updates are checked only when online.")),release:Mutex::new(None),busy:AtomicBool::new(false),cancel:AtomicBool::new(false)}}}
struct BusyGuard(Arc<UpdateService>);
impl Drop for BusyGuard {fn drop(&mut self){self.0.busy.store(false,Ordering::SeqCst);}}
fn set(service:&UpdateService,info:UpdateInfo){if let Ok(mut current)=service.info.lock(){*current=info;}}
fn start(service:&Arc<UpdateService>)->Result<BusyGuard,String>{service.busy.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).map_err(|_|"An update operation is already running")?;Ok(BusyGuard(service.clone()))}
#[tauri::command]
pub fn get_update_status(service:State<'_,Arc<UpdateService>>)->Result<UpdateInfo,String>{service.info.lock().map(|s|s.clone()).map_err(|_|"Update state unavailable".into())}
#[tauri::command]
pub fn cancel_update(service:State<'_,Arc<UpdateService>>){service.cancel.store(true,Ordering::SeqCst);}
#[tauri::command]
pub async fn check_android_update(app:tauri::AppHandle,service:State<'_,Arc<UpdateService>>,device:UpdateDevice)->Result<UpdateInfo,String>{
 let service=service.inner().clone(); let guard=start(&service)?;
 let data=app.path().app_data_dir().map_err(|e|e.to_string())?;
 tauri::async_runtime::spawn_blocking(move || {
  let _guard=guard;
  *service.release.lock().map_err(|_|"Update state unavailable")?=None;
  let key=option_env!("BILLZEN_ANDROID_UPDATE_PUBLIC_KEY").unwrap_or("");
  if key.is_empty(){let info=UpdateInfo::new("unavailable","Signed update delivery is not configured in this build.");set(&service,info.clone());return Ok(info);}
  set(&service,UpdateInfo::new("checking","Checking for a signed update…"));
  let result=(|| {
   let Some(bytes)=updates::transport::metadata()? else {return Ok(UpdateInfo::new("current","No published Android update is available yet."));};
   let replay=data.join("android-update-highest-stable");
   let highest=match std::fs::read_to_string(&replay){Ok(value)=>value.parse::<u64>().map_err(|_|"Update replay state is damaged")?,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>0,Err(_)=>return Err("Cannot read update replay state".into())};
   let release=updates::verify_manifest(&bytes,key,&device,highest)?;
   std::fs::create_dir_all(&data).map_err(|_|"Cannot save verified release state")?;
   let temporary=replay.with_extension("tmp");
   std::fs::write(&temporary,release.version_code.max(highest).to_string()).map_err(|_|"Cannot save verified release state")?;
   std::fs::rename(temporary,replay).map_err(|_|"Cannot finalize verified release state")?;
   let info=UpdateInfo::release(if release.is_current{"current"}else{"available"},if release.is_current{"You have the latest available version."}else{"A verified update is available."},&release);
   if !release.is_current {*service.release.lock().map_err(|_|"Update state unavailable")?=Some(release);}
   Ok::<_,String>(info)
  })();
  let info=result.unwrap_or_else(|message|UpdateInfo::new("error",&message)); set(&service,info.clone());Ok(info)
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn download_android_update(app:tauri::AppHandle,service:State<'_,Arc<UpdateService>>)->Result<UpdateInfo,String>{
 let service=service.inner().clone();let guard=start(&service)?;
 let release=service.release.lock().map_err(|_|"Update state unavailable")?.clone().ok_or("Check for a verified update first")?;
 let destination=app.path().app_cache_dir().map_err(|e|e.to_string())?.join("updates/update.apk");
 service.cancel.store(false,Ordering::SeqCst);
 tauri::async_runtime::spawn_blocking(move||{
  let _guard=guard;set(&service,UpdateInfo::release("downloading","Downloading verified update…",&release));
  let result=updates::transport::download(&release.artifact,&destination,&service.cancel,|size|{if let Ok(mut info)=service.info.lock(){info.downloaded_bytes=size;}});
  let info=match result {Ok(())=>UpdateInfo::release("ready","Update downloaded. Save your work before installation.",&release),Err(message)=>UpdateInfo::release("error",&message,&release)};
  set(&service,info.clone());Ok(info)
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn prepare_android_update(app:tauri::AppHandle,service:State<'_,Arc<UpdateService>>,worker:State<'_,DbWorkerHandle>)->Result<(),String>{
 let service=service.inner().clone();let _guard=start(&service)?;
 if service.info.lock().map_err(|_|"Update state unavailable")?.status!="ready" {return Err("Download and verify the update first".into());}
 let release=service.release.lock().map_err(|_|"Update state unavailable")?.clone().ok_or("Verified update metadata is missing")?;
 let directory=app.path().app_cache_dir().map_err(|e|e.to_string())?.join("updates");
 let apk=directory.join("update.apk");let artifact=release.artifact.clone();
 tauri::async_runtime::spawn_blocking(move||updates::transport::verify_file(&apk,&artifact)).await.map_err(|e|e.to_string())??;
 worker.prepare_update().await?;
 let approval=serde_json::json!({"approvedAt":chrono::Utc::now().timestamp_millis(),"versionCode":release.version_code,"sha256":release.artifact.sha256,"sizeBytes":release.artifact.size_bytes});
 let result=std::fs::write(directory.join("install-approved"),approval.to_string()).map_err(|_|"Cannot authorize installer".to_string());
 if result.is_err(){worker.resume_after_update().await?;} else {
  if let Ok(mut info)=service.info.lock(){info.status="installing".into();info.message="Waiting for the Android installer. Return to BillZen to continue.".into();}
 }
 result
}

#[tauri::command]
pub async fn resume_after_update(app:tauri::AppHandle,service:State<'_,Arc<UpdateService>>,worker:State<'_,DbWorkerHandle>)->Result<(),String>{
 if let Ok(cache)=app.path().app_cache_dir(){let _=std::fs::remove_file(cache.join("updates/install-approved"));}
 worker.resume_after_update().await?;
 if let Ok(mut info)=service.info.lock(){if info.status=="installing"{info.status="ready".into();info.message="Returned from Android. You can retry installation or continue working.".into();}}
 Ok(())
}
