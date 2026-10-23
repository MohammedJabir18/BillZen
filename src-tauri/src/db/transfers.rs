use rusqlite::{params,Connection,OptionalExtension,TransactionBehavior};
use crate::domain::{transfers::*,cashbook::{MAX_TOTAL_MINOR,format_business_date_and_year_month}};
fn err(e:impl std::fmt::Display)->String{e.to_string()}
const FIELDS:&str="id,transfer_number,idempotency_key,payload_hash,from_account_id,to_account_id,amount_minor,business_date,out_voucher_id,in_voucher_id,reference_note,notes,currency_code_snap,currency_exponent_snap,created_at,posted_at,is_reversal,reversal_for_transfer_id,is_reversed,reversed_by_transfer_id,reversed_at";
pub fn fetch(c:&Connection,id:&str)->Result<CashbookTransfer,String>{
 let names:Vec<_>=FIELDS.split(',').collect();let object=names.iter().map(|n|format!("'{n}',{n}")).collect::<Vec<_>>().join(",");
 let raw:String=c.query_row(&format!("SELECT json_object({object}) FROM cashbook_transfers WHERE id=?1"),[id],|r|r.get(0)).map_err(err)?;
 let mut value:serde_json::Value=serde_json::from_str(&raw).map_err(err)?;
 for key in ["is_reversal","is_reversed"]{value[key]=serde_json::Value::Bool(value[key].as_i64()==Some(1));}
 serde_json::from_value(value).map_err(err)
}
pub fn list(c:&Connection,f:TransferFilter)->Result<Vec<CashbookTransfer>,String>{
 let mut q=c.prepare("SELECT id FROM cashbook_transfers WHERE (?1 IS NULL OR from_account_id=?1 OR to_account_id=?1) AND (?2 IS NULL OR business_date>=?2) AND (?3 IS NULL OR business_date<=?3) ORDER BY business_date,posted_at,id").map_err(err)?;
 let ids=q.query_map(params![f.account_id,f.start_date,f.end_date],|r|r.get::<_,String>(0)).map_err(err)?;
 ids.map(|id|fetch(c,&id.map_err(err)?)).collect()
}
fn account(c:&Connection,id:&str)->Result<(i64,bool,String,i32),String>{
 let (opening,allow,archived,code,exponent):(i64,bool,bool,String,i32)=c.query_row("SELECT opening_balance_minor,allow_negative_balance,is_archived,currency_code,currency_exponent FROM money_accounts WHERE id=?1",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).map_err(|_|"Account not found".to_string())?;
 if archived{return Err("Account archived".into());}
 let sum:i64=c.query_row("SELECT COALESCE(SUM(amount_minor),0) FROM cashbook_movements WHERE account_id=?1",[id],|r|r.get(0)).map_err(err)?;
 Ok((opening.checked_add(sum).ok_or("Balance overflow")?,allow,code,exponent))
}
pub fn post(c:&mut Connection,i:CreateTransferInput)->Result<TransferResult,String>{
 let intent=normalized_intent(&i)?;let hash=intent_hash(&i)?;let key=i.idempotency_key.trim();
 let tx=c.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;
 let old:Option<String>=tx.query_row("SELECT id FROM cashbook_transfers WHERE idempotency_key=?1",[key],|r|r.get(0)).optional().map_err(err)?;
 if let Some(id)=old{let t=fetch(&tx,&id)?;if t.payload_hash!=hash{return Err("Idempotency key conflict".into());}return Ok(TransferResult::Posted{transfer:t});}
 let from=intent["from_account_id"].as_str().unwrap();let to=intent["to_account_id"].as_str().unwrap();
 let result=write_pair(&tx,from,to,i.amount_minor,intent["business_date"].as_str().unwrap(),key,&hash,intent["reference_note"].as_str(),intent["notes"].as_str(),i.confirmed_negative_balance,None)?;
 tx.commit().map_err(err)?;Ok(result)
}
pub fn reverse(c:&mut Connection,i:ReverseTransferInput)->Result<TransferResult,String>{
 let tx=c.transaction_with_behavior(TransactionBehavior::Immediate).map_err(err)?;let old=fetch(&tx,i.transfer_id.trim())?;
 if old.is_reversal{return Err("Cannot reverse a reversal transfer".into());}
 if old.is_reversed{return Ok(TransferResult::Posted{transfer:fetch(&tx,old.reversed_by_transfer_id.as_deref().ok_or("Missing reversal")?)?});}
 let zone:String=tx.query_row("SELECT timezone FROM business_settings WHERE id='default'",[],|r|r.get(0)).map_err(err)?;
 let (date,_)=format_business_date_and_year_month(chrono::Utc::now(),&zone);
 let result=write_pair(&tx,&old.to_account_id,&old.from_account_id,old.amount_minor,&date,&format!("{TRANSFER_INTERNAL_PREFIX}reverse:{}",old.id),"reversal",old.reference_note.as_deref(),old.notes.as_deref(),i.confirmed_negative_balance,Some(&old))?;
 tx.commit().map_err(err)?;Ok(result)
}
#[allow(clippy::too_many_arguments)]
fn write_pair(c:&Connection,from:&str,to:&str,amount:i64,date:&str,key:&str,hash:&str,reference:Option<&str>,notes:Option<&str>,confirmed:bool,original:Option<&CashbookTransfer>)->Result<TransferResult,String>{
 let a=account(c,from)?;let b=account(c,to)?;
 let base:(String,i32)=c.query_row("SELECT currency_code,currency_exponent FROM business_settings WHERE id='default'",[],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
 if (a.2.clone(),a.3)!=base||(b.2.clone(),b.3)!=base{return Err("Account currency mismatch".into());}
 if let Some(old)=original{if old.currency_code_snap!=base.0||old.currency_exponent_snap!=base.1{return Err("Historical currency mismatch".into());}}
 let out=a.0.checked_sub(amount).ok_or("Balance overflow")?;let into=b.0.checked_add(amount).ok_or("Balance overflow")?;
 if !(-MAX_TOTAL_MINOR..=MAX_TOTAL_MINOR).contains(&out)||!(-MAX_TOTAL_MINOR..=MAX_TOTAL_MINOR).contains(&into){return Err("Balance exceeds maximum".into());}
 if out<0&&!a.1&&!confirmed{return Ok(TransferResult::RequiresConfirmation{account_id:from.into(),current_balance_minor:a.0,projected_balance_minor:out,amount_minor:amount,message:"Transfer would make source account negative".into()});}
 let now=chrono::Utc::now().timestamp_millis();let prefix=if original.is_some(){"TRF-REV"}else{"TRF"};let ym=date.replace('-',"")[..6].to_string();
 let sequence:i64=c.query_row("INSERT INTO cashbook_sequences(sequence_key,current_number,updated_at) VALUES (?1,1,?2) ON CONFLICT(sequence_key) DO UPDATE SET current_number=current_number+1,updated_at=excluded.updated_at RETURNING current_number",params![format!("{prefix}-{ym}"),now],|r|r.get(0)).map_err(err)?;
 let number=format!("{prefix}-{ym}-{sequence:05}");let id=uuid::Uuid::new_v4().to_string();let out_id=uuid::Uuid::new_v4().to_string();let in_id=uuid::Uuid::new_v4().to_string();
 let mut seq:i64=c.query_row("SELECT COALESCE(MAX(sequence_number),0) FROM cashbook_movements",[],|r|r.get(0)).map_err(err)?;
 for (leg_id,account_id,direction,suffix,delta,old_leg) in [(&out_id,from,"outflow","OUT",-amount,original.map(|o|o.in_voucher_id.as_str())),(&in_id,to,"inflow","IN",amount,original.map(|o|o.out_voucher_id.as_str()))]{
  let leg_key=format!("{TRANSFER_INTERNAL_PREFIX}{id}:{suffix}");let leg_number=format!("{number}-{suffix}");
  if let Some(old_id)=old_leg{
   c.execute("INSERT INTO cashbook_vouchers(id,voucher_number,idempotency_key,payload_hash,account_id,direction,classification,payment_method,amount_minor,business_date,status,is_reversal,reversal_for_voucher_id,reference_note,notes,business_name_snap,business_tax_id_snap,business_address_snap,business_phone_snap,account_name_snap,currency_code_snap,currency_exponent_snap,amount_in_words_snap,created_at,posted_at) SELECT ?1,?2,?3,?4,account_id,?5,classification,payment_method,amount_minor,?6,'posted',1,id,reference_note,notes,business_name_snap,business_tax_id_snap,business_address_snap,business_phone_snap,account_name_snap,currency_code_snap,currency_exponent_snap,amount_in_words_snap,?7,?7 FROM cashbook_vouchers WHERE id=?8",params![leg_id,leg_number,leg_key,hash,direction,date,now,old_id]).map_err(err)?;
  }else{
   c.execute("INSERT INTO cashbook_vouchers(id,voucher_number,idempotency_key,payload_hash,account_id,direction,classification,payment_method,amount_minor,business_date,status,reference_note,notes,business_name_snap,business_tax_id_snap,business_address_snap,business_phone_snap,account_name_snap,currency_code_snap,currency_exponent_snap,created_at,posted_at) SELECT ?1,?2,?3,?4,a.id,?5,'transfer','bank_transfer',?6,?7,'posted',?8,?9,b.business_name,b.tax_identifier,trim(coalesce(b.address_line1,'') || char(10) || coalesce(b.address_line2,'') || char(10) || coalesce(b.city,'') || ' ' || coalesce(b.state,'') || ' ' || coalesce(b.postal_code,'') || char(10) || coalesce(b.country,'')),b.phone,a.account_name,b.currency_code,b.currency_exponent,?10,?10 FROM money_accounts a CROSS JOIN business_settings b WHERE a.id=?11 AND b.id='default'",params![leg_id,leg_number,leg_key,hash,direction,amount,date,reference,notes,now,account_id]).map_err(err)?;
  }
  seq=seq.checked_add(1).ok_or("Sequence overflow")?;
  c.execute("INSERT INTO cashbook_movements(id,voucher_id,account_id,amount_minor,business_date,sequence_number,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",params![uuid::Uuid::new_v4().to_string(),leg_id,account_id,delta,date,seq,now]).map_err(err)?;
 }
 c.execute("INSERT INTO cashbook_transfers(id,transfer_number,idempotency_key,payload_hash,from_account_id,to_account_id,amount_minor,business_date,out_voucher_id,in_voucher_id,reference_note,notes,currency_code_snap,currency_exponent_snap,created_at,posted_at,is_reversal,reversal_for_transfer_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15,?16,?17)",params![id,number,key,hash,from,to,amount,date,out_id,in_id,reference,notes,base.0,base.1,now,original.is_some(),original.map(|o|o.id.as_str())]).map_err(err)?;
 if let Some(old)=original{
  for (old_id,new_id)in[(&old.out_voucher_id,&in_id),(&old.in_voucher_id,&out_id)]{c.execute("UPDATE cashbook_vouchers SET is_reversed=1,reversed_by_voucher_id=?1,reversed_at=?2 WHERE id=?3",params![new_id,now,old_id]).map_err(err)?;}
  c.execute("UPDATE cashbook_transfers SET is_reversed=1,reversed_by_transfer_id=?1,reversed_at=?2 WHERE id=?3",params![id,now,old.id]).map_err(err)?;
 }
 c.execute("INSERT INTO cashbook_audit_events(id,voucher_id,event_type,details_json,created_at) VALUES (?1,NULL,?2,?3,?4)",params![uuid::Uuid::new_v4().to_string(),if original.is_some(){"transfer_reversed"}else{"transfer_posted"},serde_json::json!({"transfer_id":id,"confirmed_negative_balance":out<0&&!a.1&&confirmed,"current_balance_minor":a.0,"projected_balance_minor":out}).to_string(),now]).map_err(err)?;
 if out<0&&!a.1&&confirmed{c.execute("INSERT INTO cashbook_audit_events(id,voucher_id,event_type,details_json,created_at) VALUES (?1,?2,'negative_balance_confirmed',?3,?4)",params![uuid::Uuid::new_v4().to_string(),out_id,serde_json::json!({"transfer_id":id,"account_id":from,"amount_minor":amount,"current_balance_minor":a.0,"projected_balance_minor":out}).to_string(),now]).map_err(err)?;}
 Ok(TransferResult::Posted{transfer:fetch(c,&id)?})
}
