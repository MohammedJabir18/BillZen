use billzen_lib::updates::{verify_manifest, UpdateDevice};
use serde_json::Value;
fn fixture() -> Value { serde_json::from_str(include_str!("fixtures/android-update.json")).unwrap() }
fn device() -> UpdateDevice { UpdateDevice { version_code:1004, abi:"arm64-v8a".into(), sdk:24 } }
#[test]
fn publisher_fixture_verifies_and_enforces_replay_and_device_rules() {
 let f=fixture(); let bytes=serde_json::to_vec(&f["envelope"]).unwrap(); let key=f["publicKey"].as_str().unwrap();
 assert_eq!(verify_manifest(&bytes,key,&device(),0).unwrap().version_code,1005);
 assert!(verify_manifest(&bytes,key,&device(),1006).is_err());
 assert!(verify_manifest(&bytes,key,&UpdateDevice{version_code:1005,..device()},0).unwrap().is_current);
 assert!(verify_manifest(&bytes,key,&UpdateDevice{abi:"x86_64".into(),..device()},0).is_err());
 assert!(verify_manifest(&bytes,key,&UpdateDevice{sdk:23,..device()},0).is_err());
}
#[test]
fn rejects_tampering_unknown_key_duplicate_fields_and_oversized_metadata() {
 let f=fixture(); let key=f["publicKey"].as_str().unwrap();
 for field in ["payloadBase64","signatureBase64","keyId"] {
  let mut e=f["envelope"].clone(); e[field]=Value::String("invalid".into());
  assert!(verify_manifest(&serde_json::to_vec(&e).unwrap(),key,&device(),0).is_err());
 }
 let raw=serde_json::to_string(&f["envelope"]).unwrap();
 let duplicate=raw.replacen('{',"{\"schemaVersion\":1,",1);
 assert!(verify_manifest(duplicate.as_bytes(),key,&device(),0).is_err());
 assert!(verify_manifest(&vec![b' ';131073],key,&device(),0).is_err());
}
#[test]
fn authentic_but_invalid_payloads_cannot_reach_the_installer() {
 let f:Value=serde_json::from_str(include_str!("fixtures/android-update-invalid.json")).unwrap();
 for case in f["cases"].as_array().unwrap() {
  assert!(verify_manifest(&serde_json::to_vec(&case["envelope"]).unwrap(),f["publicKey"].as_str().unwrap(),&device(),0).is_err(),"accepted {}",case["name"]);
 }
}
#[test]
fn redirects_cannot_leave_reviewed_https_asset_hosts() {
 use billzen_lib::updates::transport::redirect_allowed;
 for raw in ["http://github.com/a","https://evil.test/a","https://github.com.evil.test/a","https://user:pass@github.com/a","https://github.com:8443/a"] {assert!(!redirect_allowed(&reqwest::Url::parse(raw).unwrap()));}
 for raw in ["https://github.com/a","https://release-assets.githubusercontent.com/a"] {assert!(redirect_allowed(&reqwest::Url::parse(raw).unwrap()));}
}
#[test]
fn installer_rechecks_local_file_not_only_download_state() {
 use billzen_lib::updates::{Artifact,transport::verify_file};
 use sha2::{Digest,Sha256};
 let dir=tempfile::tempdir().unwrap();let path=dir.path().join("update.apk");
 let bytes=b"synthetic APK bytes";std::fs::write(&path,bytes).unwrap();
 let artifact=Artifact{url:"unused".into(),size_bytes:bytes.len() as u64,sha256:format!("{:x}",Sha256::digest(bytes)),min_sdk:24};
 assert!(verify_file(&path,&artifact).is_ok());
 std::fs::write(&path,b"modified").unwrap();assert!(verify_file(&path,&artifact).is_err());
}
