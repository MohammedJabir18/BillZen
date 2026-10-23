//! Validate the complete portable transfer graph before staging any restored rows.
use std::collections::{BTreeMap, HashMap, HashSet};
use serde_json::Value;
use crate::domain::transfers::{CashbookTransfer, CreateTransferInput, intent_hash, normalized_intent, TRANSFER_INTERNAL_PREFIX};

fn rows<'a>(d: &'a BTreeMap<String, Value>, key: &str) -> Result<&'a Vec<Value>, String> {
    d.get(key).and_then(Value::as_array).ok_or_else(|| format!("Missing backup table {key}"))
}
fn flag(v: &Value) -> Result<bool, String> {
    match v { Value::Bool(b) => Ok(*b), Value::Number(n) if n.as_i64()==Some(0) => Ok(false), Value::Number(n) if n.as_i64()==Some(1) => Ok(true), _ => Err("Invalid transfer flag".into()) }
}
fn index<'a>(r: &'a [Value]) -> Result<HashMap<&'a str, &'a Value>, String> {
    let mut m=HashMap::new();
    for v in r { let id=v["id"].as_str().filter(|s|!s.is_empty()).ok_or("Missing backup ID")?; if m.insert(id,v).is_some(){return Err("Duplicate backup ID".into());} }
    Ok(m)
}
macro_rules! check { ($ok:expr,$msg:expr) => { if !$ok { return Err(format!("Invalid transfer backup: {}",$msg)); } }; }
pub fn validate(d: &BTreeMap<String, Value>) -> Result<(), String> {
    let headers=rows(d,"cashbook_transfers")?;
    let vouchers=index(rows(d,"cashbook_vouchers")?)?;
    let accounts=index(rows(d,"money_accounts")?)?;
    let raw_transfers=index(headers)?;
    let movements=rows(d,"cashbook_movements")?;
    let sequences=rows(d,"cashbook_sequences")?;
    let settings=d.get("business_settings").ok_or("Missing business settings")?;
    let mut owned=HashSet::new();let mut numbers=HashSet::new();let mut keys=HashSet::new();
    let snapshots=["business_name_snap","business_tax_id_snap","business_address_snap","business_phone_snap","party_name_snap","party_phone_snap","party_tax_id_snap","party_address_snap","account_name_snap","currency_code_snap","currency_exponent_snap","amount_in_words_snap"];
    for raw in headers {
        let mut normalized=raw.clone();
        for field in ["is_reversal","is_reversed"] {normalized[field]=Value::Bool(flag(&raw[field])?);}
        let h:CashbookTransfer=serde_json::from_value(normalized).map_err(|e|e.to_string())?;
        check!(numbers.insert(h.transfer_number.clone()) && keys.insert(h.idempotency_key.clone()),"duplicate identity");
        let input=CreateTransferInput{idempotency_key:if h.is_reversal {"reversal-validation".into()}else{h.idempotency_key.clone()},from_account_id:h.from_account_id.clone(),to_account_id:h.to_account_id.clone(),amount_minor:h.amount_minor,business_date:h.business_date.clone(),notes:h.notes.clone(),reference_note:h.reference_note.clone(),confirmed_negative_balance:false};
        let intent=normalized_intent(&input)?;
        for (key,value) in intent.as_object().unwrap() {check!(raw[key]==*value,"noncanonical intent field");}
        check!(h.idempotency_key==h.idempotency_key.trim(),"noncanonical retry key");
        check!(raw["currency_code_snap"]==settings["currency_code"] && raw["currency_exponent_snap"]==settings["currency_exponent"],"header currency");
        let prefix=if h.is_reversal {"TRF-REV"} else {"TRF"};
        let ym=h.business_date.replace('-',"")[..6].to_string();let seq_key=format!("{prefix}-{ym}");
        let tail=h.transfer_number.strip_prefix(&format!("{seq_key}-")).ok_or("Invalid transfer number")?;
        check!(tail.len()>=5 && tail.bytes().all(|b|b.is_ascii_digit()),"transfer number");
        let number:i64=tail.parse().map_err(|_|"Invalid transfer number")?;
        check!(h.transfer_number==format!("{seq_key}-{number:05}"),"noncanonical transfer number");
        check!(number>0 && sequences.iter().any(|s|s["sequence_key"]==seq_key && s["current_number"].as_i64().is_some_and(|n|n>=number)),"sequence floor");
        let out=*vouchers.get(h.out_voucher_id.as_str()).ok_or("Missing outgoing leg")?;
        let into=*vouchers.get(h.in_voucher_id.as_str()).ok_or("Missing incoming leg")?;
        for (leg,id,account_id,direction,suffix,delta) in [(out,&h.out_voucher_id,&h.from_account_id,"outflow","OUT",-h.amount_minor),(into,&h.in_voucher_id,&h.to_account_id,"inflow","IN",h.amount_minor)] {
            check!(owned.insert(id.clone()),"multiply owned leg");
            let a=*accounts.get(account_id.as_str()).ok_or("Missing transfer account")?;
            check!(a["currency_code"]==raw["currency_code_snap"] && a["currency_exponent"]==raw["currency_exponent_snap"],"account currency");
            check!(leg["account_id"]==*account_id && leg["direction"]==direction && leg["classification"]=="transfer" && leg["status"]=="posted" && leg["payment_method"]=="bank_transfer" && leg["party_id"].is_null() && leg["category_id"].is_null(),"leg role");
            check!(leg["voucher_number"]==format!("{}-{suffix}",h.transfer_number) && leg["idempotency_key"]==format!("{TRANSFER_INTERNAL_PREFIX}{}:{suffix}",h.id) && leg["payload_hash"]==raw["payload_hash"],"leg identity");
            for field in ["amount_minor","business_date","currency_code_snap","currency_exponent_snap","reference_note","notes"] {check!(leg[field]==raw[field],"leg/header mismatch");}
            check!(flag(&leg["is_reversal"])?==h.is_reversal && flag(&leg["is_reversed"])?==h.is_reversed && leg["reversed_at"]==raw["reversed_at"],"half reversal");
            let moves:Vec<_>=movements.iter().filter(|m|m["voucher_id"]==*id).collect();
            check!(moves.len()==1 && moves[0]["account_id"]==*account_id && moves[0]["business_date"]==h.business_date && moves[0]["amount_minor"].as_i64()==Some(delta),"movement mismatch");
        }
        for field in snapshots.iter().filter(|&&f|f!="account_name_snap") {check!(out[*field]==into[*field],"pair snapshots");}
        if h.is_reversal {
            let original=*raw_transfers.get(h.reversal_for_transfer_id.as_deref().ok_or("Missing original transfer")?).ok_or("Missing original transfer")?;
            check!(!flag(&original["is_reversal"])? && flag(&original["is_reversed"])? && original["reversed_by_transfer_id"]==h.id && !h.is_reversed,"reversal header link");
            check!(h.idempotency_key==format!("{TRANSFER_INTERNAL_PREFIX}reverse:{}",original["id"].as_str().unwrap()) && h.payload_hash=="reversal","reversal identity");
            check!(original["from_account_id"]==h.to_account_id && original["to_account_id"]==h.from_account_id && original["amount_minor"].as_i64()==Some(h.amount_minor),"reversal amount/accounts");
            check!(out["reversal_for_voucher_id"]==original["in_voucher_id"] && into["reversal_for_voucher_id"]==original["out_voucher_id"],"reversal legs");
            for (leg,original_id) in [(out,&original["in_voucher_id"]),(into,&original["out_voucher_id"])] {
                let old=*vouchers.get(original_id.as_str().ok_or("Missing original leg")?).ok_or("Missing original leg")?;
                check!(old["reversed_by_voucher_id"]==leg["id"],"original link");
                for field in snapshots {check!(old[field]==leg[field],"historical snapshot");}
            }
        } else {
            check!(h.reversal_for_transfer_id.is_none() && out["reversal_for_voucher_id"].is_null() && into["reversal_for_voucher_id"].is_null(),"unexpected reversal reference");
            check!(intent_hash(&input)?==h.payload_hash,"intent hash");
        }
        if h.is_reversed {
            let r=*raw_transfers.get(h.reversed_by_transfer_id.as_deref().ok_or("Missing reversal transfer")?).ok_or("Missing reversal transfer")?;
            check!(!h.is_reversal && flag(&r["is_reversal"])? && r["reversal_for_transfer_id"]==h.id && h.reversed_at.is_some(),"reversed header link");
        } else {check!(h.reversed_by_transfer_id.is_none() && h.reversed_at.is_none() && out["reversed_by_voucher_id"].is_null() && into["reversed_by_voucher_id"].is_null(),"unexpected reversed metadata");}
    }
    for v in vouchers.values() {
        if v["classification"]=="transfer" {check!(owned.contains(v["id"].as_str().unwrap()),"unowned transfer voucher");}
        else {check!(!v["idempotency_key"].as_str().unwrap_or("").starts_with(TRANSFER_INTERNAL_PREFIX),"reserved ordinary identity");}
    }
    Ok(())
}
