use billzen_lib::db::worker::DbWorkerHandle;
use billzen_lib::domain::cashbook::*;
use rusqlite::Connection;
use tempfile::tempdir;

#[tokio::test]
async fn test_cashbook_inflow_math_and_running_balance() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_math.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    // 1. Create account with Opening 5,000 (500,000 minor)
    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Cash in Hand".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 500_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account creation failed");

    assert_eq!(account.current_balance_minor, 500_000);

    // 2. Post Receipt (Inflow) of 1,000 (100,000 minor)
    let post_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: Some("Sale-001".to_string()),
            notes: Some("Retail sale".to_string()),
            idempotency_key: "idem-inflow-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post voucher failed");

    match post_res {
        PostVoucherResult::Posted(v) => {
            assert_eq!(v.amount_minor, 100_000);
            assert_eq!(v.voucher_number, "RCP-202610-00001");
            assert!(!v.is_reversal);
            assert!(!v.is_reversed);
        }
        _ => panic!("Expected Posted result"),
    }

    // 3. Verify updated account balance is 6,000 (600,000 minor)
    let accounts = worker.get_money_accounts().await.expect("get accounts failed");
    let updated = accounts.iter().find(|a| a.id == account.id).unwrap();
    assert_eq!(updated.current_balance_minor, 600_000);

    // 4. Verify ledger running balance
    let (entries, summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id),
            ..Default::default()
        })
        .await
        .expect("ledger failed");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].running_balance_minor, 600_000);
    assert_eq!(entries[0].movement.amount_minor, 100_000);
    assert_eq!(summary.total_cash_minor, 600_000);
    assert_eq!(summary.period_inflows_minor, 100_000);
    assert_eq!(summary.period_outflows_minor, 0);
    assert_eq!(summary.net_operating_cash_flow_minor, 100_000);
}

#[tokio::test]
async fn test_cashbook_payment_and_reversal_lifecycle() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_reversal.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    // 1. Create account with opening 0
    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Main Business Bank".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 0,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: Some("HDFC Bank".to_string()),
            account_number: Some("1234567890".to_string()),
            ifsc_or_routing: Some("HDFC0001234".to_string()),
        })
        .await
        .expect("account creation failed");

    // 2. Post Receipt of 10,000 (1,000,000 minor) -> Balance = 10,000
    let rcp = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 1_000_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-services".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-rcp-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("receipt post failed");

    let rcp_v = match rcp {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };
    assert_eq!(rcp_v.voucher_number, "RCP-202610-00001");

    // 3. Post Payment (Outflow) of 2,500 (250,000 minor) -> Balance = 7,500 (750,000 minor)
    let pay = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 250_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-rent".to_string()),
            reference_note: Some("Rent Oct".to_string()),
            notes: None,
            idempotency_key: "idem-pay-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("payment post failed");

    let pay_v = match pay {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };
    assert_eq!(pay_v.voucher_number, "PAY-202610-00001");

    let accounts = worker.get_money_accounts().await.expect("accounts failed");
    assert_eq!(accounts[0].current_balance_minor, 750_000);

    // 4. Reverse the Payment of 2,500
    let rev_res = worker
        .reverse_cashbook_voucher(pay_v.id.clone(), false)
        .await
        .expect("reverse failed");

    let rev_v = match rev_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted reversal"),
    };

    assert!(rev_v.voucher_number.starts_with("PAY-REV-"));
    assert!(rev_v.is_reversal);
    assert_eq!(rev_v.reversal_for_voucher_id, Some(pay_v.id.clone()));
    assert_eq!(rev_v.amount_minor, 250_000);
    assert_eq!(rev_v.direction, MovementDirection::Inflow);

    // 5. Verify account balance restored to 10,000 (1,000,000 minor)
    let accounts_after = worker.get_money_accounts().await.expect("accounts failed");
    assert_eq!(accounts_after[0].current_balance_minor, 1_000_000);

    // 6. Verify ledger integrity: 3 movements (1,000,000; -250,000; +250,000)
    let (entries, summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id),
            ..Default::default()
        })
        .await
        .expect("ledger failed");

    assert_eq!(entries.len(), 3);
    assert_eq!(entries[0].movement.amount_minor, 1_000_000);
    assert_eq!(entries[0].running_balance_minor, 1_000_000);

    assert_eq!(entries[1].movement.amount_minor, -250_000);
    assert_eq!(entries[1].running_balance_minor, 750_000);
    assert!(entries[1].voucher.is_reversed);
    assert_eq!(entries[1].voucher.reversed_by_voucher_id, Some(rev_v.id.clone()));

    assert_eq!(entries[2].movement.amount_minor, 250_000);
    assert_eq!(entries[2].running_balance_minor, 1_000_000);
    assert!(entries[2].voucher.is_reversal);

    assert_eq!(summary.total_cash_minor, 1_000_000);
    assert_eq!(summary.net_operating_cash_flow_minor, 1_000_000);
}

#[tokio::test]
async fn test_cashbook_negative_balance_guard_and_audit() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_negative.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    // 1. Create account with opening 1,000 (100,000 minor), allow_negative_balance = false
    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Petty Cash".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 100_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account failed");

    // 2. Attempt Payment of 1,500 (150,000 minor) WITHOUT confirmation
    let unconfirmed_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 150_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-general".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-neg-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("worker request failed");

    match unconfirmed_res {
        PostVoucherResult::RequiresConfirmation {
            current_balance_minor,
            amount_minor,
            projected_balance_minor,
            message,
        } => {
            assert_eq!(current_balance_minor, 100_000);
            assert_eq!(amount_minor, 150_000);
            assert_eq!(projected_balance_minor, -50_000);
            assert!(message.contains("Account balance would become negative"));
        }
        _ => panic!("Expected RequiresConfirmation"),
    }

    // Verify ZERO movements written and balance unchanged
    let accounts_after_unconfirmed = worker.get_money_accounts().await.expect("accounts failed");
    assert_eq!(accounts_after_unconfirmed[0].current_balance_minor, 100_000);

    let (entries, _) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            ..Default::default()
        })
        .await
        .expect("ledger failed");
    assert_eq!(entries.len(), 0);

    // 3. Post same payment WITH confirmation (`confirmed_negative_balance = true`)
    let confirmed_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 150_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-general".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-neg-1".to_string(),
            confirmed_negative_balance: true,
        })
        .await
        .expect("confirmed post failed");

    let posted_v = match confirmed_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };
    assert_eq!(posted_v.voucher_number, "PAY-202610-00001");

    // Balance is now -50,000 minor
    let accounts_after_confirmed = worker.get_money_accounts().await.expect("accounts failed");
    assert_eq!(accounts_after_confirmed[0].current_balance_minor, -50_000);

    // 4. Verify audit trail has 'negative_balance_confirmed' event
    let conn = Connection::open(&db_path).expect("open raw sqlite failed");
    let audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cashbook_audit_events WHERE event_type = 'negative_balance_confirmed' AND voucher_id = ?1;",
            rusqlite::params![posted_v.id],
            |r| r.get(0),
        )
        .expect("query audit failed");
    assert_eq!(audit_count, 1, "Must have exactly 1 negative_balance_confirmed audit record");
}

#[tokio::test]
async fn test_cashbook_idempotency_replay_and_conflict() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_idempotency.db");
    let worker = DbWorkerHandle::new(db_path).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Idempotency Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 1_000_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account failed");

    let input1 = CreateVoucherInput {
        account_id: account.id.clone(),
        direction: MovementDirection::Inflow,
        classification: CashbookClassification::OperatingIncome,
        payment_method: PaymentMethod::Upi,
        amount_minor: 50_000,
        business_date: "2026-10-19".to_string(),
        party_id: None,
        category_id: Some("cat-services".to_string()),
        reference_note: Some("INV-001".to_string()),
        notes: Some("UPI payment".to_string()),
        idempotency_key: "key-idem-unique-123".to_string(),
        confirmed_negative_balance: false,
    };

    // 1. Initial post
    let res1 = worker.post_cashbook_voucher(input1.clone()).await.expect("first post failed");
    let v1 = match res1 {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };

    // 2. Retry with exact same payload -> returns original voucher (replay)
    let res2 = worker.post_cashbook_voucher(input1.clone()).await.expect("replay post failed");
    let v2 = match res2 {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };
    assert_eq!(v1.id, v2.id);
    assert_eq!(v1.voucher_number, v2.voucher_number);

    // 3. Retry with SAME key but ALTERED payload (different amount) -> 409 Conflict
    let mut altered_input = input1.clone();
    altered_input.amount_minor = 60_000;

    let res3 = worker.post_cashbook_voucher(altered_input).await;
    assert!(res3.is_err(), "Must reject altered payload with identical idempotency key");
    let err = res3.unwrap_err();
    assert!(
        err.contains("Idempotency key conflict"),
        "Error message must specify idempotency key conflict: {}",
        err
    );
}

#[tokio::test]
async fn test_cashbook_reversal_constraints() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_rev_constraints.db");
    let worker = DbWorkerHandle::new(db_path).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Constraint Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 500_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account failed");

    let post_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 50_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-rev-const".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post failed");

    let v = match post_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };

    // 1. First reversal succeeds
    let rev_res = worker.reverse_cashbook_voucher(v.id.clone(), false).await.expect("first reversal failed");
    let rev_v = match rev_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };

    // 2. Duplicate reversal of already-reversed voucher fails
    let dup_rev = worker.reverse_cashbook_voucher(v.id.clone(), false).await;
    assert!(dup_rev.is_err(), "Cannot reverse an already reversed voucher");
    let err1 = dup_rev.unwrap_err();
    assert!(err1.contains("already reversed"), "Error message: {}", err1);

    // 3. Attempting to reverse a reversal voucher fails
    let rev_of_rev = worker.reverse_cashbook_voucher(rev_v.id.clone(), false).await;
    assert!(rev_of_rev.is_err(), "Cannot reverse a reversal voucher");
    let err2 = rev_of_rev.unwrap_err();
    assert!(err2.contains("Cannot reverse a reversal voucher"), "Error message: {}", err2);
}

#[tokio::test]
async fn test_cashbook_trigger_immutability_and_currency_protection() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_triggers.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Trigger Protection Account".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 100_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account failed");

    let post_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 10_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-trigger-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post failed");

    let voucher = match post_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected posted"),
    };

    let conn = Connection::open(&db_path).expect("open connection failed");

    // 1. Direct UPDATE of cashbook_movements must be ABORTED by trigger
    let mov_update = conn.execute(
        "UPDATE cashbook_movements SET amount_minor = 999999 WHERE voucher_id = ?1;",
        rusqlite::params![voucher.id],
    );
    assert!(mov_update.is_err());
    assert!(mov_update.unwrap_err().to_string().contains("Cannot update cashbook movements"));

    // 2. Direct DELETE from cashbook_movements must be ABORTED by trigger
    let mov_delete = conn.execute(
        "DELETE FROM cashbook_movements WHERE voucher_id = ?1;",
        rusqlite::params![voucher.id],
    );
    assert!(mov_delete.is_err());
    assert!(mov_delete.unwrap_err().to_string().contains("Cannot delete cashbook movements"));

    // 3. Direct UPDATE of financial fields on posted voucher must be ABORTED by trigger
    let vch_update = conn.execute(
        "UPDATE cashbook_vouchers SET amount_minor = 999999 WHERE id = ?1;",
        rusqlite::params![voucher.id],
    );
    assert!(vch_update.is_err());
    assert!(vch_update.unwrap_err().to_string().contains("Cannot modify posted financial or snapshot fields"));

    // 4. Direct DELETE of posted voucher must be ABORTED by trigger
    let vch_delete = conn.execute(
        "DELETE FROM cashbook_vouchers WHERE id = ?1;",
        rusqlite::params![voucher.id],
    );
    assert!(vch_delete.is_err());
    assert!(vch_delete.unwrap_err().to_string().contains("Cannot delete posted cashbook vouchers"));

    // 5. Updating money_accounts opening_balance when movements exist must be ABORTED by trigger
    let acc_update = conn.execute(
        "UPDATE money_accounts SET opening_balance_minor = 500000 WHERE id = ?1;",
        rusqlite::params![account.id],
    );
    assert!(acc_update.is_err());
    assert!(acc_update.unwrap_err().to_string().contains("Cannot alter opening balance or currency of account with existing movements"));

    // 6. Updating business_settings currency when posted cashbook vouchers exist must be ABORTED by trigger
    let mut settings = worker.get_business_settings().await.expect("settings failed");
    settings.currency_code = "KWD".to_string();
    settings.currency_exponent = 3;
    let curr_update = worker.update_business_settings(settings).await;
    assert!(curr_update.is_err());
    let curr_err = curr_update.unwrap_err();
    assert!(
        curr_err.contains("Cannot change business base currency after cashbook vouchers or non-zero accounts exist"),
        "Error must explain currency change block: {}",
        curr_err
    );
}

#[tokio::test]
async fn test_cashbook_summary_net_operating_cash_flow() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_summary.db");
    let worker = DbWorkerHandle::new(db_path).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Cash Summary Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 100_000, // 1,000 opening
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("account failed");

    // 1. Operating Income = 5,000 (500,000 minor)
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 500_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-sum-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post income failed");

    // 2. Operating Expense = 2,000 (200,000 minor)
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 200_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-rent".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-sum-2".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post expense failed");

    // 3. Non-operating Capital = 10,000 (1,000,000 minor)
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::Capital,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 1_000_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-capital".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-sum-3".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post capital failed");

    // Query summary
    let (_, summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id),
            ..Default::default()
        })
        .await
        .expect("ledger failed");

    // Total cash = 1,000 opening + 5,000 income - 2,000 expense + 10,000 capital = 14,000 (1,400,000 minor)
    assert_eq!(summary.total_cash_minor, 1_400_000);
    // Period inflows = 500,000 + 1,000,000 = 1,500,000
    assert_eq!(summary.period_inflows_minor, 1_500_000);
    // Period outflows = 200,000
    assert_eq!(summary.period_outflows_minor, 200_000);
    // Net operating cash flow = 500,000 (income) - 200,000 (expense) = 300,000 minor (Capital excluded!)
    assert_eq!(summary.net_operating_cash_flow_minor, 300_000);
}
