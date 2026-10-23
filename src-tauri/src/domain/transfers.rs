use serde::{Deserialize,Serialize};
use sha2::{Digest,Sha256};
pub const TRANSFER_INTERNAL_PREFIX:&str="__billzen_transfer__:";
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct CreateTransferInput {
 pub idempotency_key:String,pub from_account_id:String,pub to_account_id:String,pub amount_minor:i64,pub business_date:String,
 pub reference_note:Option<String>,pub notes:Option<String>,#[serde(default)]pub confirmed_negative_balance:bool,
}
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct ReverseTransferInput {pub transfer_id:String,#[serde(default)]pub confirmed_negative_balance:bool}
#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct CashbookTransfer {
 pub id:String,pub transfer_number:String,pub idempotency_key:String,pub payload_hash:String,
 pub from_account_id:String,pub to_account_id:String,pub amount_minor:i64,pub business_date:String,
 pub out_voucher_id:String,pub in_voucher_id:String,pub reference_note:Option<String>,pub notes:Option<String>,
 pub currency_code_snap:String,pub currency_exponent_snap:i32,pub created_at:i64,pub posted_at:i64,
 pub is_reversal:bool,pub reversal_for_transfer_id:Option<String>,pub is_reversed:bool,pub reversed_by_transfer_id:Option<String>,pub reversed_at:Option<i64>,
}
fn text(s:&str,max:usize)->Result<String,String>{let s=s.trim();if s.is_empty()||s.len()>max||s.chars().any(|c|c.is_ascii_control()){return Err("Invalid transfer text".into());}Ok(s.to_string())}
pub fn normalized_intent(i:&CreateTransferInput)->Result<serde_json::Value,String>{
 let key=text(&i.idempotency_key,256)?;if key.starts_with(TRANSFER_INTERNAL_PREFIX){return Err("Reserved transfer identity".into());}
 let from=text(&i.from_account_id,256)?;let to=text(&i.to_account_id,256)?;if from==to{return Err("Choose two different accounts".into());}
 if i.amount_minor<=0||i.amount_minor>crate::domain::financial::MAX_MONEY_MINOR{return Err("Invalid transfer amount".into());}
 let date=text(&i.business_date,10)?;let parsed=chrono::NaiveDate::parse_from_str(&date,"%Y-%m-%d").map_err(|_|"Invalid transfer date")?;
 if parsed.format("%Y-%m-%d").to_string()!=date{return Err("Invalid transfer date".into());}
 let optional=|s:&Option<String>|->Result<Option<String>,String>{s.as_ref().filter(|v|!v.trim().is_empty()).map(|s|text(s,2000)).transpose()};
 Ok(serde_json::json!({"amount_minor":i.amount_minor,"business_date":date,"from_account_id":from,"notes":optional(&i.notes)?,"reference_note":optional(&i.reference_note)?,"to_account_id":to}))
}
pub fn intent_hash(i:&CreateTransferInput)->Result<String,String>{Ok(format!("{:x}",Sha256::digest(serde_json::to_vec(&normalized_intent(i)?).map_err(|e|e.to_string())?)))}
#[cfg(test)]mod tests{use super::*;#[test]fn intent_identity_and_validation(){let mut i=CreateTransferInput{idempotency_key:"retry".into(),from_account_id:" cash ".into(),to_account_id:"bank".into(),amount_minor:200000,business_date:"2026-10-23".into(),notes:None,reference_note:None,confirmed_negative_balance:false};let h=intent_hash(&i).unwrap();assert_eq!(h,"a2ac11e537b543f107e622db93ca0f53abea36ad2b1b4de0464a296d4c236143");i.confirmed_negative_balance=true;assert_eq!(h,intent_hash(&i).unwrap());i.to_account_id="cash".into();assert!(intent_hash(&i).is_err());i.to_account_id="bank".into();i.business_date="2026-02-30".into();assert!(intent_hash(&i).is_err());}}
