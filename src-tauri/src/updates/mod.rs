//! Authenticated, bounded Android updates. No business data is sent to the release host.
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const KEY_ID: &str = "billzen-android-v1";
pub const MAX_APK_BYTES: u64 = 256 * 1024 * 1024;
pub const FEED: &str = "https://github.com/MohammedJabir18/BillZen/releases/latest/download/android-update.json";
pub mod transport;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct UpdateDevice { pub version_code:u64, pub abi:String, pub sdk:u32 }
#[derive(Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Envelope { schema_version:u32, key_id:String, payload_base64:String, signature_base64:String }
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct Artifact { pub url:String, pub size_bytes:u64, pub sha256:String, pub min_sdk:u32 }
#[derive(Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Payload { key_id:String, channel:String, package_id:String, version:String, version_code:u64, issued_at:String, notes:String, artifacts:BTreeMap<String,Artifact> }
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct VerifiedUpdate { pub version:String, pub version_code:u64, pub notes:String, pub artifact:Artifact, pub is_current:bool }

// Parse every object through a duplicate-rejecting visitor before typed decoding.
struct UniqueJson;
impl<'de> Deserialize<'de> for UniqueJson {
 fn deserialize<D:serde::Deserializer<'de>>(d:D)->Result<Self,D::Error> {
  struct Visitor;
  impl<'de> serde::de::Visitor<'de> for Visitor {
   type Value=UniqueJson;
   fn expecting(&self,f:&mut std::fmt::Formatter)->std::fmt::Result { f.write_str("JSON without duplicate keys") }
   fn visit_map<M:serde::de::MapAccess<'de>>(self,mut map:M)->Result<UniqueJson,M::Error> {
    let mut keys=std::collections::HashSet::new();
    while let Some(key)=map.next_key::<String>()? { if !keys.insert(key) {return Err(serde::de::Error::custom("duplicate JSON key"));} map.next_value::<UniqueJson>()?; } Ok(UniqueJson)
   }
   fn visit_seq<S:serde::de::SeqAccess<'de>>(self,mut seq:S)->Result<UniqueJson,S::Error> { while seq.next_element::<UniqueJson>()?.is_some() {} Ok(UniqueJson) }
   fn visit_bool<E:serde::de::Error>(self,_:bool)->Result<UniqueJson,E>{Ok(UniqueJson)}
   fn visit_i64<E:serde::de::Error>(self,_:i64)->Result<UniqueJson,E>{Ok(UniqueJson)}
   fn visit_u64<E:serde::de::Error>(self,_:u64)->Result<UniqueJson,E>{Ok(UniqueJson)}
   fn visit_f64<E:serde::de::Error>(self,_:f64)->Result<UniqueJson,E>{Ok(UniqueJson)}
   fn visit_str<E:serde::de::Error>(self,_:&str)->Result<UniqueJson,E>{Ok(UniqueJson)}
   fn visit_unit<E:serde::de::Error>(self)->Result<UniqueJson,E>{Ok(UniqueJson)}
  }
  d.deserialize_any(Visitor)
 }
}
fn decode_json<T:serde::de::DeserializeOwned>(bytes:&[u8])->Result<T,String> {
 serde_json::from_slice::<UniqueJson>(bytes).map_err(|e|e.to_string())?;
 serde_json::from_slice(bytes).map_err(|e|e.to_string())
}
pub fn artifact_url_allowed(raw:&str, version:&str)->bool {
 let Ok(url)=reqwest::Url::parse(raw) else{return false};
 let prefix=format!("/MohammedJabir18/BillZen/releases/download/v{}/",version);
 url.scheme()=="https" && url.host_str()==Some("github.com") && url.username().is_empty() && url.password().is_none() && url.port().is_none() && url.query().is_none() && url.fragment().is_none() && url.path().starts_with(&prefix) && !url.path()[prefix.len()..].contains('/') && url.path().ends_with(".apk")
}
pub fn verify_manifest(bytes:&[u8], key:&str, device:&UpdateDevice, highest_code:u64)->Result<VerifiedUpdate,String> {
 if bytes.len()>128*1024 {return Err("Update metadata is too large".into());}
 let envelope:Envelope=decode_json(bytes)?;
 if envelope.schema_version!=1 || envelope.key_id!=KEY_ID {return Err("Unsupported update signing key or schema".into());}
 let payload=STANDARD.decode(&envelope.payload_base64).map_err(|_|"Invalid update payload encoding")?;
 if payload.len()>64*1024 {return Err("Update payload is too large".into());}
 let key_bytes:[u8;32]=STANDARD.decode(key).map_err(|_|"Updater signing key is not configured")?.try_into().map_err(|_|"Invalid updater public key")?;
 let signature_bytes:[u8;64]=STANDARD.decode(envelope.signature_base64).map_err(|_|"Invalid update signature encoding")?.try_into().map_err(|_|"Invalid update signature length")?;
 let public_key=VerifyingKey::from_bytes(&key_bytes).map_err(|_|"Invalid updater public key")?;
 public_key.verify_strict(&payload,&Signature::from_bytes(&signature_bytes)).map_err(|_|"Update signature verification failed")?;
 let p:Payload=decode_json(&payload)?;
 if p.key_id!=KEY_ID || p.channel!="stable" || p.package_id!="com.billzen.desktop" {return Err("Update channel or application does not match".into());}
 let version=semver::Version::parse(&p.version).map_err(|_|"Invalid update version")?;
 if !version.pre.is_empty() || !version.build.is_empty() || p.version_code==0 || p.version_code>2100000000 || p.notes.len()>8192 || chrono::DateTime::parse_from_rfc3339(&p.issued_at).is_err() {return Err("Invalid release metadata".into());}
 if p.version_code<highest_code {return Err("Older update metadata was rejected".into());}
 let a=p.artifacts.get(&device.abi).ok_or("No compatible update for this device architecture")?.clone();
 if a.min_sdk<24 || a.min_sdk>device.sdk || a.size_bytes==0 || a.size_bytes>MAX_APK_BYTES || a.sha256.len()!=64 || !a.sha256.bytes().all(|b|b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) || !artifact_url_allowed(&a.url,&p.version) {return Err("Invalid or incompatible update artifact".into());}
 Ok(VerifiedUpdate{is_current:p.version_code<=device.version_code,version:p.version,version_code:p.version_code,notes:p.notes,artifact:a})
}
