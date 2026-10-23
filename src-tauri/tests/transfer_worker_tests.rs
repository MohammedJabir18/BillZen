use billzen_lib::db::initialize_database;
use rusqlite::Connection;
use tempfile::tempdir;

#[test]
fn migration_adds_transfer_header_without_changing_existing_cashbook() {
    let dir=tempdir().unwrap();let path=dir.path().join("transfers.db");
    let conn=initialize_database(&path).unwrap();
    let exists:i64=conn.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='cashbook_transfers'",[],|r|r.get(0)).unwrap();
    assert_eq!(exists,1,"transfer schema must be registered");
    // Reconstruct a populated v8 fixture, then perform the genuine v8->v9 upgrade.
    conn.execute_batch("DROP TRIGGER trg_transfer_single_movement; DROP TABLE cashbook_transfers; DELETE FROM schema_migrations WHERE version=9;").unwrap();
    seed_account(&conn,"legacy");
    conn.execute("INSERT INTO cashbook_vouchers(id,voucher_number,idempotency_key,payload_hash,account_id,direction,classification,payment_method,amount_minor,business_date,created_at,posted_at) VALUES ('rcp','RCP-202610-00001','old-key','old-hash','legacy','inflow','operating_income','cash',12345,'2026-10-23',1,1)",[]).unwrap();
    conn.execute("INSERT INTO cashbook_movements(id,voucher_id,account_id,amount_minor,business_date,sequence_number,created_at) VALUES ('m','rcp','legacy',12345,'2026-10-23',1,1)",[]).unwrap();
    let before:i64=conn.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get(0)).unwrap();
    drop(conn);let conn=initialize_database(&path).unwrap();
    let after:i64=conn.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get(0)).unwrap();assert_eq!(before,after);
    let amount:i64=conn.query_row("SELECT amount_minor FROM cashbook_movements WHERE id='m'",[],|r|r.get(0)).unwrap();assert_eq!(amount,12345);
    let version:i64=conn.query_row("SELECT max(version) FROM schema_migrations",[],|r|r.get(0)).unwrap();assert_eq!(version,9);
}

#[test]
fn transfer_pair_requires_distinct_accounts_and_matching_legs() {
 let dir=tempdir().unwrap();let path=dir.path().join("pairs.db");let conn=initialize_database(&path).unwrap();
 seed_account(&conn,"cash");seed_account(&conn,"bank");
 leg(&conn,"out","cash","outflow");leg(&conn,"in","bank","inflow");
 assert!(conn.execute("INSERT INTO cashbook_movements(id,voucher_id,account_id,amount_minor,business_date,sequence_number,created_at) VALUES ('before-header','out','cash',-200000,'2026-10-23',2,1)",[]).is_err(),"Duplicate must fail even before header insertion");
 let insert="INSERT INTO cashbook_transfers(id,transfer_number,idempotency_key,payload_hash,from_account_id,to_account_id,amount_minor,business_date,out_voucher_id,in_voucher_id,currency_code_snap,currency_exponent_snap,created_at,posted_at) VALUES ('t','TRF-202610-00001','retry','hash',?1,?2,200000,'2026-10-23','out','in','INR',2,1,1)";
 assert!(conn.execute(insert,["cash","cash"]).is_err());
 assert!(conn.execute(insert,["bank","cash"]).is_err());
 let dirty=insert.replace("created_at,posted_at)","created_at,posted_at,is_reversed,reversed_by_transfer_id,reversed_at)").replace(",2,1,1)",",2,1,1,1,'t',1)");
 assert!(conn.execute(&dirty,["cash","bank"]).is_err(),"New header cannot arrive self-reversed");
 conn.execute(insert,["cash","bank"]).unwrap();
 assert!(conn.execute("INSERT INTO cashbook_movements(id,voucher_id,account_id,amount_minor,business_date,sequence_number,created_at) VALUES ('duplicate','out','cash',-200000,'2026-10-23',2,1)",[]).is_err(),"Transfer leg must never accept a second movement");
 assert!(conn.execute("UPDATE cashbook_transfers SET amount_minor=1 WHERE id='t'",[]).is_err());
 assert!(conn.execute("DELETE FROM cashbook_transfers WHERE id='t'",[]).is_err());
}
fn seed_account(c:&Connection,id:&str){c.execute("INSERT INTO money_accounts(id,account_name,account_type,currency_code,currency_exponent,created_at,updated_at) VALUES (?1,?1,'cash','INR',2,1,1)",[id]).unwrap();}
fn leg(c:&Connection,id:&str,account:&str,direction:&str){c.execute("INSERT INTO cashbook_vouchers(id,voucher_number,idempotency_key,payload_hash,account_id,direction,classification,payment_method,amount_minor,business_date,currency_code_snap,currency_exponent_snap,created_at,posted_at) VALUES (?1,'TRF-202610-00001-' || CASE WHEN ?3='inflow' THEN 'IN' ELSE 'OUT' END,?1,'hash',?2,?3,'transfer','bank_transfer',200000,'2026-10-23','INR',2,1,1)",[id,account,direction]).unwrap();c.execute("INSERT INTO cashbook_movements(id,voucher_id,account_id,amount_minor,business_date,sequence_number,created_at) VALUES (?1,?1,?2,?3,'2026-10-23',1,1)",rusqlite::params![id,account,if direction=="inflow"{200000}else{-200000}]).unwrap();}

#[tokio::test]
async fn native_atomic_transfer_and_paired_reverse() {
 use billzen_lib::{db::worker::DbWorkerHandle,domain::{cashbook::*,transfers::*}};
 let dir=tempdir().unwrap();let path=dir.path().join("native.db");let w=DbWorkerHandle::new(path.clone()).unwrap();
 let mut ids=Vec::new();for(name,opening)in[("Cash",500000),("Bank",100000)]{ids.push(w.create_money_account(CreateMoneyAccountDto{account_name:name.into(),account_type:"cash".into(),opening_balance_minor:opening,allow_negative_balance:false,currency_code:None,currency_exponent:None,bank_name:None,account_number:None,ifsc_or_routing:None}).await.unwrap().id);}
 let i=CreateTransferInput{idempotency_key:"public-retry".into(),from_account_id:ids[0].clone(),to_account_id:ids[1].clone(),amount_minor:200000,business_date:"2026-10-23".into(),reference_note:None,notes:None,confirmed_negative_balance:false};
 let t=match w.post_cashbook_transfer(i.clone()).await.unwrap(){TransferResult::Posted{transfer}=>transfer,_=>panic!("unexpected confirmation")};
 let same=match w.post_cashbook_transfer(i.clone()).await.unwrap(){TransferResult::Posted{transfer}=>transfer,_=>panic!()};assert_eq!(t.id,same.id);
 let accounts=w.get_money_accounts().await.unwrap();for id in &ids{assert_eq!(accounts.iter().find(|a|&a.id==id).unwrap().current_balance_minor,300000);}
 let (_,summary)=w.get_cashbook_ledger(CashbookLedgerFilter::default()).await.unwrap();assert_eq!(summary.total_cash_minor,600000);assert_eq!(summary.period_inflows_minor,0);assert_eq!(summary.period_outflows_minor,0);
 assert!(w.reverse_cashbook_voucher(t.out_voucher_id.clone(),false).await.is_err());
 let r=w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:t.id.clone(),confirmed_negative_balance:false}).await.unwrap();let rid=match r{TransferResult::Posted{transfer}=>transfer.id,_=>panic!()};
 let again=w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:t.id,confirmed_negative_balance:false}).await.unwrap();assert!(matches!(again,TransferResult::Posted{transfer} if transfer.id==rid));
 let c=Connection::open(path).unwrap();let count:i64=c.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get(0)).unwrap();assert_eq!(count,4);
}

async fn transfer_setup()->(tempfile::TempDir,billzen_lib::db::worker::DbWorkerHandle,Vec<String>){
 use billzen_lib::{db::worker::DbWorkerHandle,domain::cashbook::*};
 let d=tempdir().unwrap();let w=DbWorkerHandle::new(d.path().join("db")).unwrap();let mut ids=vec![];
 for(name,opening)in[("Cash",500000),("Bank",100000)]{ids.push(w.create_money_account(CreateMoneyAccountDto{account_name:name.into(),account_type:"cash".into(),opening_balance_minor:opening,allow_negative_balance:false,currency_code:None,currency_exponent:None,bank_name:None,account_number:None,ifsc_or_routing:None}).await.unwrap().id);}
 (d,w,ids)
}
fn transfer_input(ids:&[String])->billzen_lib::domain::transfers::CreateTransferInput{billzen_lib::domain::transfers::CreateTransferInput{idempotency_key:"retry".into(),from_account_id:ids[0].clone(),to_account_id:ids[1].clone(),amount_minor:200000,business_date:"2026-10-23".into(),reference_note:None,notes:None,confirmed_negative_balance:false}}
#[tokio::test]
async fn confirmation_and_concurrent_retry_write_one_pair_only(){
 use billzen_lib::domain::transfers::*;
 let(d,w,ids)=transfer_setup().await;let mut i=transfer_input(&ids);i.amount_minor=700000;
 assert!(matches!(w.post_cashbook_transfer(i.clone()).await.unwrap(),TransferResult::RequiresConfirmation{..}));
 let c=Connection::open(d.path().join("db")).unwrap();assert_eq!(c.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get::<_,i64>(0)).unwrap(),0);
 assert_eq!(c.query_row("SELECT count(*) FROM cashbook_sequences",[],|r|r.get::<_,i64>(0)).unwrap(),0);
 i.confirmed_negative_balance=true;let(a,b)=tokio::join!(w.post_cashbook_transfer(i.clone()),w.post_cashbook_transfer(i.clone()));
 let a=match a.unwrap(){TransferResult::Posted{transfer}=>transfer,_=>panic!()};assert!(matches!(b.unwrap(),TransferResult::Posted{transfer} if transfer.id==a.id));
 i.amount_minor=1;assert!(w.post_cashbook_transfer(i).await.unwrap_err().contains("conflict"));
 let rows:i64=c.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get(0)).unwrap();assert_eq!(rows,2);
 assert!(c.query_row("SELECT details_json FROM cashbook_audit_events WHERE event_type='transfer_posted'",[],|r|r.get::<_,String>(0)).unwrap().contains("\"confirmed_negative_balance\":true"));
}
#[tokio::test]
async fn injected_second_leg_failures_roll_back_sequence_audit_and_first_leg(){
 let(d,w,ids)=transfer_setup().await;let c=Connection::open(d.path().join("db")).unwrap();
 for trigger in ["CREATE TRIGGER test_fail BEFORE INSERT ON cashbook_movements WHEN NEW.amount_minor>0 BEGIN SELECT RAISE(ABORT,'injected second movement'); END", "CREATE TRIGGER test_fail BEFORE INSERT ON cashbook_transfers BEGIN SELECT RAISE(ABORT,'injected header'); END", "CREATE TRIGGER test_fail BEFORE INSERT ON cashbook_audit_events WHEN NEW.event_type='transfer_posted' BEGIN SELECT RAISE(ABORT,'injected audit'); END"]{
  c.execute_batch(trigger).unwrap();assert!(w.post_cashbook_transfer(transfer_input(&ids)).await.is_err());c.execute_batch("DROP TRIGGER test_fail").unwrap();
  for table in ["cashbook_transfers","cashbook_vouchers","cashbook_movements","cashbook_sequences","cashbook_audit_events"]{let n:i64=c.query_row(&format!("SELECT count(*) FROM {table}"),[],|r|r.get(0)).unwrap();assert_eq!(n,0,"{table} must roll back");}
 }
}

#[tokio::test]
async fn invalid_accounts_currencies_and_bounds_leave_no_writes(){
 for case in ["missing","same","archived","currency","exponent","upper","lower"]{
  let(d,w,ids)=transfer_setup().await;let c=Connection::open(d.path().join("db")).unwrap();let mut i=transfer_input(&ids);
  match case{"missing"=>i.to_account_id="missing".into(),"same"=>i.to_account_id=ids[0].clone(),"archived"=>{c.execute("UPDATE money_accounts SET is_archived=1 WHERE id=?1",[&ids[1]]).unwrap();},"currency"=>{c.execute("UPDATE money_accounts SET currency_code='USD' WHERE id=?1",[&ids[1]]).unwrap();},"exponent"=>{c.execute("UPDATE money_accounts SET currency_exponent=3 WHERE id=?1",[&ids[1]]).unwrap();},"upper"=>{c.execute("UPDATE money_accounts SET opening_balance_minor=100000000000000 WHERE id=?1",[&ids[1]]).unwrap();},_=>{c.execute("UPDATE money_accounts SET opening_balance_minor=-100000000000000 WHERE id=?1",[&ids[0]]).unwrap();}}
  assert!(w.post_cashbook_transfer(i).await.is_err(),"{case}");for table in["cashbook_movements","cashbook_sequences","cashbook_transfers"]{assert_eq!(c.query_row(&format!("SELECT count(*) FROM {table}"),[],|r|r.get::<_,i64>(0)).unwrap(),0);}
 }
}
#[tokio::test]
async fn reversal_confirmation_snapshots_filters_and_atomic_failure(){
 use billzen_lib::domain::{cashbook::*,transfers::*};
 let(d,w,ids)=transfer_setup().await;let c=Connection::open(d.path().join("db")).unwrap();let t=match w.post_cashbook_transfer(transfer_input(&ids)).await.unwrap(){TransferResult::Posted{transfer}=>transfer,_=>panic!()};
 let (_,s)=w.get_cashbook_ledger(CashbookLedgerFilter{account_id:Some(ids[0].clone()),start_date:Some("2026-10-23".into()),end_date:Some("2026-10-23".into()),classification:Some("transfer".into()),..Default::default()}).await.unwrap();assert_eq!(s.closing_balance_minor,300000);assert_eq!(s.matching_outflows_minor,Some(0));assert_eq!(s.matching_inflows_minor,Some(0));
 assert!(w.reverse_cashbook_voucher(t.in_voucher_id.clone(),true).await.is_err());
 assert!(w.export_workspace_backup().await.is_err(),"Do not emit incomplete format1.0 transfer backups");
 c.execute_batch("UPDATE business_settings SET business_name='Renamed'; UPDATE money_accounts SET account_name=account_name || ' renamed';").unwrap();
 for trigger in["CREATE TRIGGER fail_reverse BEFORE UPDATE ON cashbook_vouchers WHEN NEW.is_reversed=1 AND OLD.direction='inflow' BEGIN SELECT RAISE(ABORT,'second flag'); END", "CREATE TRIGGER fail_reverse BEFORE UPDATE ON cashbook_transfers BEGIN SELECT RAISE(ABORT,'header flag'); END", "CREATE TRIGGER fail_reverse BEFORE INSERT ON cashbook_audit_events WHEN NEW.event_type='transfer_reversed' BEGIN SELECT RAISE(ABORT,'audit'); END"]{
  c.execute_batch(trigger).unwrap();assert!(w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:t.id.clone(),confirmed_negative_balance:false}).await.is_err());c.execute_batch("DROP TRIGGER fail_reverse").unwrap();
  assert_eq!(c.query_row("SELECT SUM(is_reversed) FROM cashbook_vouchers",[],|r|r.get::<_,i64>(0)).unwrap(),0);assert_eq!(c.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get::<_,i64>(0)).unwrap(),2);assert_eq!(c.query_row("SELECT count(*) FROM cashbook_sequences WHERE sequence_key LIKE 'TRF-REV%'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
 }
 w.post_cashbook_voucher(CreateVoucherInput{account_id:ids[1].clone(),direction:MovementDirection::Outflow,classification:CashbookClassification::OperatingExpense,payment_method:PaymentMethod::Cash,amount_minor:350000,business_date:"2026-10-23".into(),party_id:None,category_id:None,reference_note:None,notes:None,idempotency_key:"spend".into(),confirmed_negative_balance:true}).await.unwrap();
 assert!(matches!(w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:t.id.clone(),confirmed_negative_balance:false}).await.unwrap(),TransferResult::RequiresConfirmation{..}));
 let rev=match w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:t.id.clone(),confirmed_negative_balance:true}).await.unwrap(){TransferResult::Posted{transfer}=>transfer,_=>panic!()};
 assert!(w.reverse_cashbook_transfer(ReverseTransferInput{transfer_id:rev.id,confirmed_negative_balance:true}).await.is_err());
 let names:i64=c.query_row("SELECT count(*) FROM cashbook_vouchers WHERE classification='transfer' AND business_name_snap='Renamed'",[],|r|r.get(0)).unwrap();assert_eq!(names,0);
 assert_eq!(c.query_row("SELECT count(*) FROM cashbook_movements",[],|r|r.get::<_,i64>(0)).unwrap(),5);
}
