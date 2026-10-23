use billzen_lib::{db::worker::DbWorkerHandle, domain::{cashbook::*, catalog::*}};
use rusqlite::{Connection, params};
use tempfile::tempdir;

async fn customer(w: &DbWorkerHandle) -> Customer {
    w.create_customer(CreateCustomerDto { name: "Same name".into(), phone: Some("123".into()), email: None, address_line1: Some("Street".into()), address_line2: None, city: None, state: None, postal_code: None, country: None, tax_identifier: None }).await.unwrap()
}
fn ensure(id: &str, party: Option<&str>) -> EnsureCustomerCashbookPartyInput {
    EnsureCustomerCashbookPartyInput { customer_id: id.into(), existing_party_id: party.map(str::to_string) }
}
async fn legacy_party(w: &DbWorkerHandle, customer_id: Option<String>) -> CashbookParty {
    w.create_cashbook_party(CreateCashbookPartyDto { name: "Legacy".into(), party_type: "customer".into(), customer_id, phone: None, email: None, tax_id: None, address: None }).await.unwrap()
}

#[tokio::test]
async fn ensure_is_serialized_and_never_matches_names_or_steals_links() {
    let dir = tempdir().unwrap(); let path = dir.path().join("test.db");
    let w = DbWorkerHandle::new(path.clone()).unwrap();
    let c = customer(&w).await; let other = customer(&w).await;
    let (a,b) = tokio::join!(w.ensure_customer_cashbook_party(ensure(&c.id,None)),w.ensure_customer_cashbook_party(ensure(&c.id,None)));
    let a = a.unwrap(); assert_eq!(a.id,b.unwrap().id); assert_eq!(a.phone.as_deref(),Some("123"));
    let second = w.ensure_customer_cashbook_party(ensure(&other.id,None)).await.unwrap(); assert_ne!(a.id, second.id);
    assert!(w.ensure_customer_cashbook_party(ensure(&other.id,Some(&a.id))).await.unwrap_err().starts_with("PARTY_LINK_CONFLICT"));
    assert!(w.ensure_customer_cashbook_party(ensure("missing",None)).await.unwrap_err().starts_with("CUSTOMER_NOT_FOUND"));
    w.archive_customer(c.id.clone()).await.unwrap();
    assert!(w.ensure_customer_cashbook_party(ensure(&c.id,None)).await.unwrap_err().starts_with("CUSTOMER_ARCHIVED"));
    let conn = Connection::open(path).unwrap();
    let n:i64 = conn.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get(0)).unwrap(); assert_eq!(n,0);
}

#[tokio::test]
async fn legacy_and_archived_links_require_explicit_selection_and_audit() {
    let dir=tempdir().unwrap(); let path=dir.path().join("test.db"); let w=DbWorkerHandle::new(path.clone()).unwrap();
    let c=customer(&w).await;
    let a=legacy_party(&w,Some(c.id.clone())).await;
    let b=legacy_party(&w,Some(c.id.clone())).await;
    assert!(w.ensure_customer_cashbook_party(ensure(&c.id,None)).await.unwrap_err().starts_with("PARTY_SELECTION_REQUIRED"));
    assert_eq!(w.ensure_customer_cashbook_party(ensure(&c.id,Some(&a.id))).await.unwrap().id,a.id);
    let conn=Connection::open(&path).unwrap(); conn.execute("UPDATE cashbook_parties SET is_archived=1 WHERE customer_id=?",[&c.id]).unwrap();
    assert!(w.ensure_customer_cashbook_party(ensure(&c.id,None)).await.unwrap_err().starts_with("PARTY_SELECTION_REQUIRED"));
    assert!(w.ensure_customer_cashbook_party(ensure(&c.id,Some(&b.id))).await.unwrap_err().starts_with("PARTY_ARCHIVED"));
    let free=legacy_party(&w,None).await;
    let linked=w.ensure_customer_cashbook_party(ensure(&c.id,Some(&free.id))).await.unwrap(); assert_eq!(linked.name,"Same name");
    let n:i64=conn.query_row("SELECT count(*) FROM cashbook_audit_events WHERE event_type='customer_party_linked'",[],|r|r.get(0)).unwrap(); assert_eq!(n,1);
}

#[tokio::test]
async fn history_keeps_archived_links_reversals_filters_and_immutable_snapshots() {
    let dir=tempdir().unwrap(); let path=dir.path().join("test.db"); let w=DbWorkerHandle::new(path.clone()).unwrap();
    let c=customer(&w).await; let other=customer(&w).await;
    let a=legacy_party(&w,Some(c.id.clone())).await; let b=legacy_party(&w,Some(c.id.clone())).await;
    let unrelated=legacy_party(&w,Some(other.id)).await;
    let account=w.create_money_account(CreateMoneyAccountDto { account_name:"Cash".into(),account_type:"cash".into(),opening_balance_minor:0,allow_negative_balance:true,currency_code:None,currency_exponent:None,bank_name:None,account_number:None,ifsc_or_routing:None }).await.unwrap();
    let mut receipt=None;
    for (party,amount,direction,key) in [(&a,12000,MovementDirection::Inflow,"receipt"),(&b,2000,MovementDirection::Outflow,"payment"),(&unrelated,500,MovementDirection::Inflow,"other")] {
        let v=w.post_cashbook_voucher(CreateVoucherInput {account_id:account.id.clone(),direction,classification:if direction==MovementDirection::Inflow {CashbookClassification::OperatingIncome}else{CashbookClassification::OperatingExpense},payment_method:PaymentMethod::Cash,amount_minor:amount,business_date:"2026-10-23".into(),party_id:Some(party.id.clone()),category_id:None,reference_note:None,notes:None,idempotency_key:key.into(),confirmed_negative_balance:true}).await.unwrap();
        if key=="receipt" {if let PostVoucherResult::Posted(v)=v {receipt=Some(v.id);}}
    }
    let filter=CustomerCashHistoryFilter {customer_id:c.id.clone(),start_date:None,end_date:None,account_id:None};
    let h=w.get_customer_cash_history(filter.clone()).await.unwrap(); assert_eq!((h.received_minor,h.paid_minor,h.net_movement_minor,h.entries.len()),(12000,2000,10000,2));
    let conn=Connection::open(&path).unwrap(); conn.execute("UPDATE cashbook_parties SET is_archived=1 WHERE id=?",[&a.id]).unwrap();
    w.update_customer(UpdateCustomerDto {id:c.id.clone(),name:"Renamed".into(),phone:Some("456".into()),email:None,address_line1:None,address_line2:None,city:None,state:None,postal_code:None,country:"India".into(),tax_identifier:None}).await.unwrap();
    assert!(w.get_cashbook_parties().await.unwrap().iter().filter(|p|p.customer_id.as_deref()==Some(&c.id)).all(|p|p.name=="Renamed"));
    w.reverse_cashbook_voucher(receipt.unwrap(),true).await.unwrap();
    let h=w.get_customer_cash_history(filter.clone()).await.unwrap(); assert_eq!((h.received_minor,h.paid_minor,h.net_movement_minor,h.entries.len()),(12000,14000,-2000,3));
    assert_eq!(h.entries[0].voucher.party_name_snap.as_deref(),Some("Legacy"));
    assert!(h.entries.iter().any(|e|e.voucher.is_reversal));
    let empty_account=w.create_money_account(CreateMoneyAccountDto { account_name:"Bank".into(),account_type:"bank".into(),opening_balance_minor:0,allow_negative_balance:false,currency_code:None,currency_exponent:None,bank_name:None,account_number:None,ifsc_or_routing:None }).await.unwrap();
    assert_eq!(w.get_customer_cash_history(CustomerCashHistoryFilter {account_id:Some(empty_account.id),..filter.clone()}).await.unwrap().entries.len(),0);
    let (rows, summary)=w.get_cashbook_ledger(CashbookLedgerFilter {party_id:Some(b.id.clone()),..Default::default()}).await.unwrap();
    assert_eq!(rows.len(),1); assert_eq!(summary.matching_outflows_minor,Some(2000)); assert_eq!(summary.closing_balance_minor,-1500);
    assert_eq!(w.get_customer_cash_history(CustomerCashHistoryFilter {start_date:Some("2026-10-24".into()),..filter}).await.unwrap().entries.len(),0);
    let balance:i64=conn.query_row("SELECT current_balance_minor FROM customers WHERE id=?",params![c.id],|r|r.get(0)).unwrap(); assert_eq!(balance,0);
}

#[tokio::test]
async fn failed_audit_rolls_back_link_and_failed_projection_rolls_back_customer_edit() {
    let dir=tempdir().unwrap(); let path=dir.path().join("test.db"); let w=DbWorkerHandle::new(path.clone()).unwrap();
    let c=customer(&w).await; let free=legacy_party(&w,None).await;
    let conn=Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_link_audit BEFORE INSERT ON cashbook_audit_events BEGIN SELECT RAISE(ABORT,'test audit unavailable'); END;").unwrap();
    assert!(w.ensure_customer_cashbook_party(ensure(&c.id,Some(&free.id))).await.is_err());
    assert!(w.get_cashbook_parties().await.unwrap().into_iter().find(|p|p.id==free.id).unwrap().customer_id.is_none());
    conn.execute_batch("DROP TRIGGER fail_link_audit;").unwrap();
    w.ensure_customer_cashbook_party(ensure(&c.id,Some(&free.id))).await.unwrap();
    conn.execute_batch("CREATE TRIGGER fail_projection BEFORE UPDATE ON cashbook_parties BEGIN SELECT RAISE(ABORT,'test projection unavailable'); END;").unwrap();
    assert!(w.update_customer(UpdateCustomerDto {id:c.id.clone(),name:"Must roll back".into(),phone:None,email:None,address_line1:None,address_line2:None,city:None,state:None,postal_code:None,country:"India".into(),tax_identifier:None}).await.is_err());
    let actual:String=conn.query_row("SELECT name FROM customers WHERE id=?",[c.id],|r|r.get(0)).unwrap(); assert_eq!(actual,"Same name");
}
