use super::{Artifact, MAX_APK_BYTES};
use reqwest::{blocking::Client, redirect::Policy, Url};
use sha2::{Digest,Sha256};
use std::{io::{Read,Write},path::Path,sync::atomic::{AtomicBool,Ordering},time::Duration};

pub fn redirect_allowed(url:&Url)->bool {
 url.scheme()=="https" && url.username().is_empty() && url.password().is_none() && url.port().is_none() && matches!(url.host_str(),Some("github.com"|"release-assets.githubusercontent.com"|"objects.githubusercontent.com"))
}
fn client()->Result<Client,String> {
 Client::builder().https_only(true).connect_timeout(Duration::from_secs(15)).timeout(Duration::from_secs(300))
 .user_agent("BillZen-Updater/1").redirect(Policy::custom(|attempt| {
  if attempt.previous().len()>5 || !redirect_allowed(attempt.url()) {attempt.error("Untrusted update redirect")} else {attempt.follow()}
 })).build().map_err(|_|"Cannot initialize update connection".into())
}
pub fn metadata()->Result<Option<Vec<u8>>,String> {
 let response=client()?.get(super::FEED).timeout(Duration::from_secs(25)).send().map_err(|_|"Cannot reach update server. Your offline records remain available.")?;
 if response.status()==reqwest::StatusCode::NOT_FOUND {return Ok(None);}
 let response=response.error_for_status().map_err(|_|"Update server returned an error; try later")?;
 let mut bytes=Vec::new(); response.take(128*1024+1).read_to_end(&mut bytes).map_err(|_|"Update metadata download failed")?;
 if bytes.len()>128*1024 {return Err("Update metadata is too large".into());}
 Ok(Some(bytes))
}
pub fn download(artifact:&Artifact,destination:&Path,cancel:&AtomicBool,mut progress:impl FnMut(u64))->Result<(),String> {
 let partial=destination.with_extension("partial");
 let result=(|| {
  let mut response=client()?.get(&artifact.url).send().map_err(|_|"Update download failed")?.error_for_status().map_err(|_|"Update download server returned an error")?;
  if response.content_length().is_some_and(|n|n!=artifact.size_bytes) {return Err("Update size does not match signed release".into());}
  std::fs::create_dir_all(destination.parent().ok_or("Invalid update cache directory")?).map_err(|_|"Cannot create update cache")?;
  let mut options=std::fs::OpenOptions::new(); options.write(true).create(true).truncate(true);
  #[cfg(unix)] {use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
  let mut file=options.open(&partial).map_err(|_|"Cannot write update; check free space")?;
  let mut digest=Sha256::new(); let mut size=0; let mut buffer=[0u8;64*1024];
  loop {
   if cancel.load(Ordering::Relaxed) {return Err("Update download cancelled".into());}
   let count=response.read(&mut buffer).map_err(|_|"Update download interrupted")?; if count==0 {break;}
   size+=count as u64;
   if size>artifact.size_bytes || size>MAX_APK_BYTES {return Err("Update exceeds signed download size".into());}
   file.write_all(&buffer[..count]).map_err(|_|"Cannot save update; check free space")?; digest.update(&buffer[..count]); progress(size);
  }
  if size!=artifact.size_bytes || format!("{:x}",digest.finalize())!=artifact.sha256 {return Err("Update is incomplete or its checksum is invalid".into());}
  file.sync_all().map_err(|_|"Cannot finish saving update")?; drop(file);
  std::fs::rename(&partial,destination).map_err(|_|"Cannot finalize update download")?;
  Ok(())
 })();
 if result.is_err() {let _=std::fs::remove_file(&partial);}
 result
}

/// Recheck cached bytes immediately before approving installer handoff.
pub fn verify_file(path:&Path,artifact:&Artifact)->Result<(),String>{
 let mut file=std::fs::File::open(path).map_err(|_|"Downloaded update is missing")?;
 if file.metadata().map_err(|_|"Cannot inspect downloaded update")?.len()!=artifact.size_bytes{return Err("Cached update size changed".into());}
 let mut digest=Sha256::new();let mut buffer=[0u8;64*1024];let mut size=0;
 loop {let count=file.read(&mut buffer).map_err(|_|"Cannot recheck downloaded update")?;if count==0{break;}size+=count as u64;if size>artifact.size_bytes{return Err("Cached update changed".into());}digest.update(&buffer[..count]);}
 if size!=artifact.size_bytes||format!("{:x}",digest.finalize())!=artifact.sha256{return Err("Cached update checksum changed".into());}Ok(())
}
