use billzen_lib::{db::{initialize_database,backup::*,transfers},domain::transfers::*};
use serde_json::Value;
use tempfile::tempdir;
fn resign(b:&mut Value){let p=b.as_object().unwrap().iter().filter(|(k,_)|k.as_str()!="checksum_sha256").map(|(k,v)|(k.clone(),v.clone())).collect();b["checksum_sha256"]=compute_canonical_checksum(&p).unwrap().into();}
fn setup()->(tempfile::TempDir,std::path::PathBuf,Value){
 let d=tempdir().unwrap();let path=d.path().join("active.db");let mut c=initialize_database(&path).unwrap();
 c.execute("INSERT INTO business_settings(id,business_name,phone,address_line1,city,state,postal_code,created_at,updated_at) VALUES ('default','Synthetic transfer business','','','','','',1,1)",[]).unwrap();
 for(id,opening)in[("cash",500000),("bank",100000)]{c.execute("INSERT INTO money_accounts(id,account_name,account_type,opening_balance_minor,currency_code,currency_exponent,created_at,updated_at) VALUES (?1,?1,'cash',?2,'INR',2,1,1)",rusqlite::params![id,opening]).unwrap();}
 let result=transfers::post(&mut c,CreateTransferInput{idempotency_key:"backup".into(),from_account_id:"cash".into(),to_account_id:"bank".into(),amount_minor:200000,business_date:"2026-10-23".into(),reference_note:None,notes:None,confirmed_negative_balance:false}).unwrap();
 let id=match result{TransferResult::Posted{transfer}=>transfer.id,_=>panic!()};
 transfers::reverse(&mut c,ReverseTransferInput{transfer_id:id,confirmed_negative_balance:false}).unwrap();
 let b=create_workspace_backup(&c).unwrap();drop(c);(d,path,b)
}
#[test]
fn paired_transfer_backup_roundtrip_and_rejection_preserves_active(){
 let(_d,path,b)=setup();assert_eq!(b["format_version"],"1.2");assert_eq!(b["cashbook_transfers"].as_array().unwrap().len(),2);
 restore_workspace_backup(&path,&b).unwrap();
 let c=initialize_database(&path).unwrap();let after=create_workspace_backup(&c).unwrap();drop(c);
 for key in ["cashbook_transfers","cashbook_vouchers","cashbook_movements","cashbook_audit_events"]{assert_eq!(after[key],b[key],"{key} preserved");}
 for mode in ["missing_header","missing_leg","extra_leg","sequence","snapshot","half_reverse","hash","date","number","owner","amount","legacy_injection","raw_key"]{
  let mut bad=b.clone();
  match mode{
   "missing_header"=>bad["cashbook_transfers"]=serde_json::json!([]),
   "missing_leg"=>{bad["cashbook_vouchers"].as_array_mut().unwrap().remove(0);},
   "extra_leg"=>{let mut v=bad["cashbook_vouchers"][0].clone();v["id"]="orphan".into();v["idempotency_key"]="orphan".into();v["voucher_number"]="orphan".into();bad["cashbook_vouchers"].as_array_mut().unwrap().push(v);},
   "sequence"=>bad["cashbook_sequences"]=serde_json::json!([]),
   "snapshot"=>bad["cashbook_vouchers"][0]["business_name_snap"]="tampered".into(),
   "half_reverse"=>{bad["cashbook_vouchers"][0]["is_reversed"]=0.into();bad["cashbook_vouchers"][0]["reversed_by_voucher_id"]=Value::Null;},
   "hash"=>bad["cashbook_transfers"][0]["payload_hash"]="tampered".into(),
   "date"=>bad["cashbook_transfers"][0]["business_date"]="2026-02-30".into(),
   "number"=>bad["cashbook_transfers"][0]["transfer_number"]="TRF-199901-00001".into(),
   "owner"=>bad["cashbook_transfers"][0]["out_voucher_id"]=bad["cashbook_transfers"][0]["in_voucher_id"].clone(),
   "amount"=>bad["cashbook_transfers"][0]["amount_minor"]=1.into(),
   "raw_key"=>{let h=bad["cashbook_transfers"].as_array_mut().unwrap().iter_mut().find(|h|h["is_reversal"]==0).unwrap();h["idempotency_key"]=" backup ".into();},
   "legacy_injection"=>bad["format_version"]="1.0".into(),_=>unreachable!()
  }
  resign(&mut bad);assert!(restore_workspace_backup(&path,&bad).is_err(),"accepted {mode}");
  let c=initialize_database(&path).unwrap();assert_eq!(create_workspace_backup(&c).unwrap()["cashbook_transfers"],b["cashbook_transfers"],"active changed after {mode}");
 }
 // Optional synthetic fixture for the real-browser cross-runtime acceptance script.
 if let Ok(file)=std::env::var("BILLZEN_TRANSFER_FIXTURE"){std::fs::write(file,serde_json::to_vec(&b).unwrap()).unwrap();}
}
#[test]
fn legacy_checksum_verified_before_empty_transfer_normalization(){
 let d=tempdir().unwrap();let path=d.path().join("legacy.db");let c=initialize_database(&path).unwrap();let mut b=create_workspace_backup(&c).unwrap();drop(c);
 b["format_version"]="1.0".into();b.as_object_mut().unwrap().remove("cashbook_transfers");resign(&mut b);
 assert!(verify_tier1_checksum(&b).is_ok());restore_workspace_backup(&path,&b).unwrap();
 let c=initialize_database(&path).unwrap();assert_eq!(create_workspace_backup(&c).unwrap()["cashbook_transfers"],serde_json::json!([]));
 let mut tampered=b.clone();tampered["cashbook_transfers"]=serde_json::json!([]);assert!(verify_tier1_checksum(&tampered).is_err(),"normalization hid checksum tamper");
}

#[test]
#[ignore = "invoked by synthetic cross-runtime harness with an explicit fixture"]
fn browser_fixture_import_preserves_all_transfer_rows(){
 let file=std::env::var("BILLZEN_WEB_TRANSFER_FIXTURE").expect("explicit synthetic fixture path required");
 let b:Value=serde_json::from_slice(&std::fs::read(file).unwrap()).unwrap();
 let d=tempdir().unwrap();let path=d.path().join("browser-roundtrip.db");
 restore_workspace_backup(&path,&b).unwrap();let c=initialize_database(&path).unwrap();let exported=create_workspace_backup(&c).unwrap();
 for key in ["cashbook_transfers","cashbook_vouchers","cashbook_movements","cashbook_audit_events"]{
  let normalize=|rows:&Value| {let mut rows=rows.as_array().unwrap().clone();for row in &mut rows {for field in ["is_reversal","is_reversed"]{if row[field].is_boolean(){row[field]=if row[field]==true {1}else{0}.into();}}}rows.sort_by_key(|r|r["id"].as_str().unwrap().to_string());rows};
  assert_eq!(normalize(&exported[key]),normalize(&b[key]),"interop changed {key}");
 }
}
