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
