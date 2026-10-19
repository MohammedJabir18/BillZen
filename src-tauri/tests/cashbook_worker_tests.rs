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

    // 6. Updating business_settings currency when posted cashbook vouchers exist must be ABORTED
    let mut settings = worker.get_business_settings().await.expect("settings failed");
    settings.currency_code = "KWD".to_string();
    settings.currency_exponent = 3;
    let curr_update = worker.update_business_settings(settings).await;
    assert!(curr_update.is_err());
    let curr_err = curr_update.unwrap_err();
    assert!(
        curr_err.contains("Cannot change base currency after catalog products, invoices, payments, or expenses exist, or posted cashbook vouchers"),
        "Error must explain currency change block: {}",
        curr_err
    );

    // Also verify raw SQL update is aborted directly by trigger
    let raw_curr = conn.execute(
        "UPDATE business_settings SET currency_code = 'KWD', currency_exponent = 3 WHERE id = 'default';",
        [],
    );
    assert!(raw_curr.is_err(), "Raw SQL currency update must fail via trigger");
    assert!(raw_curr.unwrap_err().to_string().contains("Cannot change business base currency after cashbook vouchers or non-zero accounts exist"));
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

#[tokio::test]
async fn test_cashbook_integrity_hardening_defects() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("integrity_hardening.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    // 1. Account currency mismatch (AED account in INR company) must be rejected
    let aed_acc_res = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "AED Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 0,
            allow_negative_balance: false,
            currency_code: Some("AED".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await;
    assert!(aed_acc_res.is_err());
    let err_msg = aed_acc_res.unwrap_err();
    assert!(err_msg.contains("Currency code 'AED' does not match company base currency 'INR'"));

    // 2. Account currency exponent mismatch (KWD with exponent 2 instead of 3) must be rejected
    let kwd_acc_res = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "KWD Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 0,
            allow_negative_balance: false,
            currency_code: Some("KWD".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await;
    assert!(kwd_acc_res.is_err());
    assert!(kwd_acc_res.unwrap_err().contains("Invalid exponent 2 for currency 'KWD'"));

    // Create Account A (opening 500,000)
    let acc_a = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Account A".to_string(),
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
        .expect("create acc_a failed");

    // Create Account B (opening 200,000)
    let acc_b = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Account B".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 200_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("create acc_b failed");

    // 3. Direction and Classification Incompatibilities
    // Inflow with OperatingExpense -> rejected
    let bad_inflow = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_a.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-bad-inflow".to_string(),
            confirmed_negative_balance: false,
        })
        .await;
    assert!(bad_inflow.is_err());
    assert!(bad_inflow.unwrap_err().contains("Incompatible direction Inflow with classification OperatingExpense"));

    // Outflow with OperatingIncome -> rejected
    let bad_outflow = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_a.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-bad-outflow".to_string(),
            confirmed_negative_balance: false,
        })
        .await;
    assert!(bad_outflow.is_err());
    assert!(bad_outflow.unwrap_err().contains("Incompatible direction Outflow with classification OperatingIncome"));

    // 4. Direction and Category Incompatibilities
    // Inflow with expense category ('cat-rent') -> rejected
    let bad_cat = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_a.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-rent".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-bad-cat".to_string(),
            confirmed_negative_balance: false,
        })
        .await;
    assert!(bad_cat.is_err());
    assert!(bad_cat.unwrap_err().contains("Incompatible direction Inflow with category type Expense"));

    // Post valid vouchers:
    // Voucher 1 on Account A: Inflow 100,000 (OperatingIncome)
    let vch1 = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_a.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 100_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-vch1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("vch1 post failed");
    let vch1 = match vch1 { PostVoucherResult::Posted(v) => v, _ => panic!("Expected Posted") };

    // Voucher 2 on Account B: Inflow 50,000 (OperatingIncome)
    let vch2 = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_b.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 50_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: Some("cat-sales".to_string()),
            reference_note: None,
            notes: None,
            idempotency_key: "idem-vch2".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("vch2 post failed");
    let vch2 = match vch2 { PostVoucherResult::Posted(v) => v, _ => panic!("Expected Posted") };

    // 5. Verify Summary before archiving Account B:
    // Total cash: A(500,000 + 100,000) + B(200,000 + 50,000) = 850,000
    // Active cash: 850,000
    let (_, sum_before) = worker.get_cashbook_ledger(CashbookLedgerFilter::default()).await.unwrap();
    assert_eq!(sum_before.total_cash_minor, 850_000);
    assert_eq!(sum_before.active_cash_minor, 850_000);

    // Archive Account B
    worker
        .update_money_account(UpdateMoneyAccountDto {
            id: acc_b.id.clone(),
            account_name: acc_b.account_name.clone(),
            allow_negative_balance: false,
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
            is_archived: true,
        })
        .await
        .expect("archive acc_b failed");

    // 6. Verify Summary after archiving Account B:
    // Total cash remains 850,000 (all accounts preserved)
    // Active cash is strictly 600,000 (Account A: 500,000 opening + 100,000 movement)
    let (_, sum_after) = worker.get_cashbook_ledger(CashbookLedgerFilter::default()).await.unwrap();
    assert_eq!(sum_after.total_cash_minor, 850_000);
    assert_eq!(sum_after.active_cash_minor, 600_000);

    // 7. Posting new voucher to archived account must be rejected
    let post_archived = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: acc_b.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 10_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-post-archived".to_string(),
            confirmed_negative_balance: false,
        })
        .await;
    assert!(post_archived.is_err());
    assert!(post_archived.unwrap_err().contains("Cannot post to or modify archived account"));

    // 8. Reversing voucher on archived account must be rejected (operator must consciously unarchive first)
    let rev_archived = worker
        .reverse_cashbook_voucher(vch2.id.clone(), false)
        .await;
    assert!(rev_archived.is_err());
    assert!(rev_archived.unwrap_err().contains("Cannot post to or modify archived account"));

    // Unarchive Account B and verify reversal now succeeds
    worker
        .update_money_account(UpdateMoneyAccountDto {
            id: acc_b.id.clone(),
            account_name: acc_b.account_name.clone(),
            allow_negative_balance: false,
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
            is_archived: false,
        })
        .await
        .expect("unarchive acc_b failed");

    let rev_success = worker
        .reverse_cashbook_voucher(vch2.id.clone(), false)
        .await
        .expect("reversal after unarchiving must succeed");
    assert!(matches!(rev_success, PostVoucherResult::Posted(_)));

    // 9. SQL Trigger Invariant Protections via raw connection
    let conn = Connection::open(&db_path).expect("open raw sqlite failed");

    // Status downgrade of posted voucher to draft must be aborted by trigger
    let downgrade_res = conn.execute(
        "UPDATE cashbook_vouchers SET status = 'draft' WHERE id = ?1;",
        rusqlite::params![vch1.id],
    );
    assert!(downgrade_res.is_err());
    assert!(downgrade_res.unwrap_err().to_string().contains("Cannot change status of a posted voucher"));

    // Multiple movements for single C1 voucher must be aborted by trigger
    let extra_mov_res = conn.execute(
        "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
         VALUES ('mov_extra_bogus', ?1, ?2, 100000, '2026-10-19', 99, 1729337400000);",
        rusqlite::params![vch1.id, acc_a.id],
    );
    assert!(extra_mov_res.is_err());
    assert!(extra_mov_res.unwrap_err().to_string().contains("Multiple movements for a single C1 voucher are prohibited"));

    // Movement sign disagreement must be aborted by trigger
    let disagree_mov_res = conn.execute(
        "INSERT INTO cashbook_movements (id, voucher_id, account_id, amount_minor, business_date, sequence_number, created_at)
         VALUES ('mov_sign_err', ?1, ?2, -100000, '2026-10-19', 99, 1729337400000);",
        rusqlite::params![vch1.id, acc_a.id],
    );
    assert!(disagree_mov_res.is_err());
    assert!(disagree_mov_res.unwrap_err().to_string().contains("Movement details (account, date, amount, sign) must agree with voucher"));

    // Audit events must be immutable
    let audit_update_res = conn.execute(
        "UPDATE cashbook_audit_events SET event_type = 'tampered' WHERE voucher_id = ?1;",
        rusqlite::params![vch1.id],
    );
    assert!(audit_update_res.is_err());
    assert!(audit_update_res.unwrap_err().to_string().contains("Cannot update cashbook audit events"));

    let audit_delete_res = conn.execute(
        "DELETE FROM cashbook_audit_events WHERE voucher_id = ?1;",
        rusqlite::params![vch1.id],
    );
    assert!(audit_delete_res.is_err());
    assert!(audit_delete_res.unwrap_err().to_string().contains("Cannot delete cashbook audit events"));

    // Verify transactional audit events exist for voucher_posted and voucher_reversed
    let post_audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cashbook_audit_events WHERE event_type = 'voucher_posted';",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(post_audit_count >= 2, "Transactional voucher_posted audit events must be recorded");

    let rev_audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cashbook_audit_events WHERE event_type = 'voucher_reversed';",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rev_audit_count, 1, "Transactional voucher_reversed audit event must be recorded");
}

#[tokio::test]
async fn test_cashbook_date_range_and_period_balances() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("date_range.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Timeline Account".to_string(),
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
        .expect("create account failed");

    // Post Voucher 1: 2026-10-05, Inflow 50,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 50_000,
            business_date: "2026-10-05".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-range-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Post Voucher 2: 2026-10-15, Outflow 20,000 (OperatingExpense)
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 20_000,
            business_date: "2026-10-15".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-range-2".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Post Voucher 3: 2026-10-25, Inflow 40,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 40_000,
            business_date: "2026-10-25".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-range-3".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Query ledger with date filter: 2026-10-10 to 2026-10-20
    let (entries, summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id),
            start_date: Some("2026-10-10".to_string()),
            end_date: Some("2026-10-20".to_string()),
            ..Default::default()
        })
        .await
        .expect("filtered ledger query failed");

    // Only Voucher 2 falls in the date range
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].movement.business_date, "2026-10-15");
    assert_eq!(entries[0].movement.amount_minor, -20_000);

    // Period metrics:
    assert_eq!(summary.period_inflows_minor, 0);
    assert_eq!(summary.period_outflows_minor, 20_000);
    assert_eq!(summary.net_operating_cash_flow_minor, -20_000);

    // Period opening balance = account opening (100,000) + voucher 1 prior inflow (50,000) = 150,000
    assert_eq!(summary.opening_balance_minor, 150_000);

    // Period closing balance = opening (150,000) - outflow (20,000) = 130,000
    assert_eq!(summary.closing_balance_minor, 130_000);

    // All-time total cash = 100,000 + 50,000 - 20,000 + 40,000 = 170,000
    assert_eq!(summary.total_cash_minor, 170_000);
}

#[tokio::test]
async fn test_cashbook_pre_write_negative_balance_abort_leaves_no_traces() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("pre_write_abort_test.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Rollback Account".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 10_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("create account failed");

    // Attempt payment of 500,000 without negative balance confirmation
    let res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 500_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-rollback-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("operation should complete with confirmation requirement");

    assert!(matches!(res, PostVoucherResult::RequiresConfirmation { .. }));

    // Verify raw SQLite database has ZERO vouchers, ZERO movements, ZERO sequences, ZERO audit events
    let conn = Connection::open(&db_path).expect("open raw sqlite failed");
    let vch_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_vouchers;", [], |r| r.get(0)).unwrap();
    assert_eq!(vch_count, 0, "No vouchers must be committed on unconfirmed negative balance");

    let mov_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_movements;", [], |r| r.get(0)).unwrap();
    assert_eq!(mov_count, 0, "No movements must be committed on unconfirmed negative balance");

    let seq_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_sequences;", [], |r| r.get(0)).unwrap();
    assert_eq!(seq_count, 0, "No sequence increments must be committed on unconfirmed negative balance");

    let aud_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_audit_events;", [], |r| r.get(0)).unwrap();
    assert_eq!(aud_count, 0, "No audit events must be committed on unconfirmed negative balance");
}

#[tokio::test]
async fn test_cashbook_mid_transaction_write_failure_rollback() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("mid_tx_fail.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Fault Injection Account".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 50_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("create account failed");

    // In raw SQLite, attach a trigger that aborts audit event insertion
    {
        let conn = Connection::open(&db_path).expect("open raw sqlite failed");
        conn.execute(
            "CREATE TRIGGER trg_test_fail_audit BEFORE INSERT ON cashbook_audit_events
             WHEN NEW.event_type = 'voucher_posted'
             BEGIN
                 SELECT RAISE(ABORT, 'Simulated mid-transaction audit insert failure');
             END;",
            [],
        )
        .expect("create trigger failed");
    }

    // Now attempt to post a voucher.
    // The worker writes the voucher, movement, sequence, and then tries to insert the audit event,
    // which triggers the abort and MUST roll back the entire transaction!
    let res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 10_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-mid-fail-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await;

    assert!(res.is_err(), "Posting must fail when mid-transaction audit insert aborts");
    assert!(res.unwrap_err().contains("Simulated mid-transaction audit insert failure"));

    // Verify complete rollback in SQLite: zero vouchers, zero movements, zero sequences, zero audit events
    let conn = Connection::open(&db_path).expect("open raw sqlite failed");
    let vch_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_vouchers;", [], |r| r.get(0)).unwrap();
    assert_eq!(vch_count, 0, "Vouchers must be rolled back on mid-transaction write failure");

    let mov_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_movements;", [], |r| r.get(0)).unwrap();
    assert_eq!(mov_count, 0, "Movements must be rolled back on mid-transaction write failure");

    let seq_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_sequences;", [], |r| r.get(0)).unwrap();
    assert_eq!(seq_count, 0, "Sequences must be rolled back on mid-transaction write failure");

    let aud_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_audit_events;", [], |r| r.get(0)).unwrap();
    assert_eq!(aud_count, 0, "Audit events must be rolled back on mid-transaction write failure");
}

#[tokio::test]
async fn test_cashbook_reversal_mid_transaction_failure_atomicity() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("reversal_atomicity.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Reversal Atomicity Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 100_000,
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("create account failed");

    // Post a voucher cleanly
    let post_res = worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 25_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: None,
            idempotency_key: "idem-rev-atom-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .expect("post should succeed");

    let voucher = match post_res {
        PostVoucherResult::Posted(v) => v,
        _ => panic!("Expected Posted"),
    };

    // Inject trigger to abort specifically on voucher_reversed audit event
    {
        let conn = Connection::open(&db_path).expect("open raw sqlite failed");
        conn.execute(
            "CREATE TRIGGER trg_test_fail_reversal_audit BEFORE INSERT ON cashbook_audit_events
             WHEN NEW.event_type = 'voucher_reversed'
             BEGIN
                 SELECT RAISE(ABORT, 'Simulated reversal failure after movement/voucher writes');
             END;",
            [],
        )
        .expect("create trigger failed");
    }

    // Attempt reversal
    let rev_res = worker.reverse_cashbook_voucher(voucher.id.clone(), false).await;
    assert!(rev_res.is_err(), "Reversal must fail when audit event triggers abort");
    assert!(rev_res.unwrap_err().contains("Simulated reversal failure"));

    // Verify atomicity in SQLite:
    // Original voucher must NOT be marked reversed
    let conn = Connection::open(&db_path).expect("open raw sqlite failed");
    let (is_reversed, reversed_by): (i64, Option<String>) = conn
        .query_row(
            "SELECT is_reversed, reversed_by_voucher_id FROM cashbook_vouchers WHERE id = ?1;",
            rusqlite::params![voucher.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(is_reversed, 0, "Original voucher must remain NOT reversed on rollback");
    assert!(reversed_by.is_none(), "reversed_by_voucher_id must remain NULL on rollback");

    // No reversal voucher should exist
    let rev_vch_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM cashbook_vouchers WHERE is_reversal = 1;", [], |r| r.get(0))
        .unwrap();
    assert_eq!(rev_vch_count, 0, "No reversal voucher should exist after rollback");

    // Exactly 1 movement should exist (the original one)
    let mov_count: i64 = conn.query_row("SELECT COUNT(*) FROM cashbook_movements;", [], |r| r.get(0)).unwrap();
    assert_eq!(mov_count, 1, "Only the original movement must exist after rollback");
}

#[tokio::test]
async fn test_cashbook_persistence_and_idempotent_retry_across_worker_restart() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("restart_persistence.db");

    let voucher_id: String;
    let account_id: String;

    // Phase 1: Start Worker 1, create account, post voucher
    {
        let worker1 = DbWorkerHandle::new(db_path.clone()).expect("worker1 spawn");
        let account = worker1
            .create_money_account(CreateMoneyAccountDto {
                account_name: "Restart Account".to_string(),
                account_type: "cash".to_string(),
                opening_balance_minor: 10_000,
                allow_negative_balance: false,
                currency_code: Some("INR".to_string()),
                currency_exponent: Some(2),
                bank_name: None,
                account_number: None,
                ifsc_or_routing: None,
            })
            .await
            .expect("create account failed");

        account_id = account.id.clone();

        let post_res = worker1
            .post_cashbook_voucher(CreateVoucherInput {
                account_id: account_id.clone(),
                direction: MovementDirection::Inflow,
                classification: CashbookClassification::OperatingIncome,
                payment_method: PaymentMethod::Cash,
                amount_minor: 50_000,
                business_date: "2026-10-19".to_string(),
                party_id: None,
                category_id: None,
                reference_note: Some("REF-PERSIST".to_string()),
                notes: Some("Persistent Voucher".to_string()),
                idempotency_key: "idem-persist-key-1".to_string(),
                confirmed_negative_balance: false,
            })
            .await
            .expect("post voucher failed");

        match post_res {
            PostVoucherResult::Posted(v) => {
                voucher_id = v.id;
            }
            _ => panic!("Expected Posted"),
        }
        // Worker 1 dropped here
    }

    // Phase 2: Start Worker 2 on identical file path
    {
        let worker2 = DbWorkerHandle::new(db_path.clone()).expect("worker2 spawn");

        // Query ledger and verify persisted state
        let (entries, summary) = worker2
            .get_cashbook_ledger(CashbookLedgerFilter {
                account_id: Some(account_id.clone()),
                ..Default::default()
            })
            .await
            .expect("get ledger failed");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].voucher.id, voucher_id);
        assert_eq!(entries[0].voucher.amount_minor, 50_000);
        assert_eq!(summary.total_cash_minor, 60_000); // 10,000 opening + 50,000 inflow

        // Idempotent retry with IDENTICAL payload on Worker 2
        let retry_res = worker2
            .post_cashbook_voucher(CreateVoucherInput {
                account_id: account_id.clone(),
                direction: MovementDirection::Inflow,
                classification: CashbookClassification::OperatingIncome,
                payment_method: PaymentMethod::Cash,
                amount_minor: 50_000,
                business_date: "2026-10-19".to_string(),
                party_id: None,
                category_id: None,
                reference_note: Some("REF-PERSIST".to_string()),
                notes: Some("Persistent Voucher".to_string()),
                idempotency_key: "idem-persist-key-1".to_string(),
                confirmed_negative_balance: false,
            })
            .await
            .expect("idempotent retry failed");

        match retry_res {
            PostVoucherResult::Posted(retried_v) => {
                assert_eq!(retried_v.id, voucher_id, "Idempotent replay must return original voucher");
            }
            _ => panic!("Expected Posted on idempotent replay"),
        }

        // Retry with ALTERED amount on Worker 2 -> Conflict!
        let conflict_res = worker2
            .post_cashbook_voucher(CreateVoucherInput {
                account_id: account_id.clone(),
                direction: MovementDirection::Inflow,
                classification: CashbookClassification::OperatingIncome,
                payment_method: PaymentMethod::Cash,
                amount_minor: 999_999,
                business_date: "2026-10-19".to_string(),
                party_id: None,
                category_id: None,
                reference_note: Some("REF-PERSIST".to_string()),
                notes: Some("Persistent Voucher".to_string()),
                idempotency_key: "idem-persist-key-1".to_string(),
                confirmed_negative_balance: false,
            })
            .await;

        assert!(conflict_res.is_err(), "Altered payload with reused key must conflict");
        assert!(conflict_res.unwrap_err().contains("Idempotency key conflict"));
    }
}

#[tokio::test]
async fn test_cashbook_display_filters_and_financial_balance_separation() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("filter_balance_separation.db");
    let worker = DbWorkerHandle::new(db_path.clone()).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Operating Account".to_string(),
            account_type: "bank".to_string(),
            opening_balance_minor: 10_000, // 10,000 minor units
            allow_negative_balance: false,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .expect("create account failed");

    // Receipt: 10,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 10_000,
            business_date: "2026-10-10".to_string(),
            party_id: None,
            category_id: None,
            reference_note: Some("Customer payment from Alice".to_string()),
            notes: Some("Alice Consulting".to_string()),
            idempotency_key: "idem-sep-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Payment: 2,500
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Outflow,
            classification: CashbookClassification::OperatingExpense,
            payment_method: PaymentMethod::Cash,
            amount_minor: 2_500,
            business_date: "2026-10-12".to_string(),
            party_id: None,
            category_id: None,
            reference_note: Some("Office stationery for Bob".to_string()),
            notes: Some("Bob Supplies".to_string()),
            idempotency_key: "idem-sep-2".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // 1. Unfiltered Statement
    let (all_entries, all_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(all_entries.len(), 2);
    assert_eq!(all_summary.opening_balance_minor, 10_000);
    assert_eq!(all_summary.period_inflows_minor, 10_000);
    assert_eq!(all_summary.period_outflows_minor, 2_500);
    assert_eq!(all_summary.closing_balance_minor, 17_500);
    assert_eq!(all_summary.total_cash_minor, 17_500);
    assert_eq!(all_summary.active_cash_minor, 17_500);
    assert!(all_summary.matching_inflows_minor.is_none());

    // 2. Search for "Alice" (matches only receipt)
    // CRITICAL INVARIANT: Searching for receipt must NOT change the statement's true closing balance (17,500)
    let (search_entries, search_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            search: Some("Alice".to_string()),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(search_entries.len(), 1, "Only Alice entry matches search");
    assert_eq!(search_entries[0].running_balance_minor, 20_000, "Running balance at receipt was 20,000");

    // True financial balances of the period MUST remain 17,500, NOT 20,000!
    assert_eq!(search_summary.opening_balance_minor, 10_000);
    assert_eq!(search_summary.period_inflows_minor, 10_000);
    assert_eq!(search_summary.period_outflows_minor, 2_500);
    assert_eq!(search_summary.closing_balance_minor, 17_500);
    assert_eq!(search_summary.total_cash_minor, 17_500);

    // Matching-result totals explicitly separate the search hits:
    assert_eq!(search_summary.matching_inflows_minor, Some(10_000));
    assert_eq!(search_summary.matching_outflows_minor, Some(0));
    assert_eq!(search_summary.matching_count, Some(1));

    // 3. Filter by classification = OperatingExpense (matches only payment)
    let (expense_entries, expense_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            classification: Some("operating_expense".to_string()),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(expense_entries.len(), 1, "Only expense entry matches classification");
    assert_eq!(expense_entries[0].running_balance_minor, 17_500, "Running balance at payment includes preceding receipt");

    // Statement balances remain intact:
    assert_eq!(expense_summary.opening_balance_minor, 10_000);
    assert_eq!(expense_summary.closing_balance_minor, 17_500);
    assert_eq!(expense_summary.matching_inflows_minor, Some(0));
    assert_eq!(expense_summary.matching_outflows_minor, Some(2_500));
    assert_eq!(expense_summary.matching_count, Some(1));

    // 4. Backdated entry verification
    // Insert backdated voucher on 2026-10-05 (before the 2026-10-10 receipt)
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::Capital,
            payment_method: PaymentMethod::BankTransfer,
            amount_minor: 5_000,
            business_date: "2026-10-05".to_string(),
            party_id: None,
            category_id: None,
            reference_note: Some("Backdated capital infusion".to_string()),
            notes: None,
            idempotency_key: "idem-sep-3-backdated".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Query chronological ledger:
    let (chrono_entries, chrono_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(chrono_entries.len(), 3);
    // Chronological order: 2026-10-05 (+5,000), 2026-10-10 (+10,000), 2026-10-12 (-2,500)
    assert_eq!(chrono_entries[0].movement.business_date, "2026-10-05");
    assert_eq!(chrono_entries[0].running_balance_minor, 15_000); // 10,000 + 5,000

    assert_eq!(chrono_entries[1].movement.business_date, "2026-10-10");
    assert_eq!(chrono_entries[1].running_balance_minor, 25_000); // 15,000 + 10,000

    assert_eq!(chrono_entries[2].movement.business_date, "2026-10-12");
    assert_eq!(chrono_entries[2].running_balance_minor, 22_500); // 25,000 - 2,500

    assert_eq!(chrono_summary.closing_balance_minor, 22_500);

    // Query date range: 2026-10-08 onwards.
    // Opening balance at 2026-10-08 must include the 2026-10-05 backdated entry!
    let (_, window_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            account_id: Some(account.id.clone()),
            start_date: Some("2026-10-08".to_string()),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(window_summary.opening_balance_minor, 15_000, "Period opening balance at 2026-10-08 includes backdated 2026-10-05 movement");
    assert_eq!(window_summary.closing_balance_minor, 22_500);
}

#[tokio::test]
async fn test_cashbook_reporting_contract_parity() {
    let dir = tempdir().expect("tempdir failed");
    let db_path = dir.path().join("cashbook_reporting_parity.db");
    let worker = DbWorkerHandle::new(db_path).expect("worker should spawn");

    let account = worker
        .create_money_account(CreateMoneyAccountDto {
            account_name: "Main Cash Till".to_string(),
            account_type: "cash".to_string(),
            opening_balance_minor: 0,
            allow_negative_balance: true,
            currency_code: Some("INR".to_string()),
            currency_exponent: Some(2),
            bank_name: None,
            account_number: None,
            ifsc_or_routing: None,
        })
        .await
        .unwrap();

    // 1. Post Baseline review fixture
    // Day prior (2026-10-19): Inflow 10,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 10_000,
            business_date: "2026-10-19".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: Some("Prior day sales".to_string()),
            idempotency_key: "parity-base-1".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Day selected (2026-10-20): Operating Inflow 5,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 5_000,
            business_date: "2026-10-20".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: Some("Today operating receipt".to_string()),
            idempotency_key: "parity-base-2".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Day selected (2026-10-20): Loan Inflow 20,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::Loan,
            payment_method: PaymentMethod::Cash,
            amount_minor: 20_000,
            business_date: "2026-10-20".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: Some("Working capital loan".to_string()),
            idempotency_key: "parity-base-3".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Day future (2026-10-21): Inflow 30,000
    worker
        .post_cashbook_voucher(CreateVoucherInput {
            account_id: account.id.clone(),
            direction: MovementDirection::Inflow,
            classification: CashbookClassification::OperatingIncome,
            payment_method: PaymentMethod::Cash,
            amount_minor: 30_000,
            business_date: "2026-10-21".to_string(),
            party_id: None,
            category_id: None,
            reference_note: None,
            notes: Some("Future day sales".to_string()),
            idempotency_key: "parity-base-4".to_string(),
            confirmed_negative_balance: false,
        })
        .await
        .unwrap();

    // Query 2026-10-20 to 2026-10-20
    let (entries, summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            start_date: Some("2026-10-20".to_string()),
            end_date: Some("2026-10-20".to_string()),
            include_archived: Some(false),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(entries.len(), 2);
    assert_eq!(summary.opening_balance_minor, 10_000);
    assert_eq!(summary.period_inflows_minor, 25_000);
    assert_eq!(summary.period_outflows_minor, 0);
    assert_eq!(summary.net_operating_cash_flow_minor, 5_000);
    assert_eq!(summary.closing_balance_minor, 35_000);
    assert_eq!(summary.total_cash_minor, 65_000);
    assert_eq!(summary.active_cash_minor, 65_000);
    assert!(summary.matching_inflows_minor.is_none());
    assert!(summary.matching_outflows_minor.is_none());

    // Query 2026-10-20 with non-matching search term
    let (search_entries, search_summary) = worker
        .get_cashbook_ledger(CashbookLedgerFilter {
            start_date: Some("2026-10-20".to_string()),
            end_date: Some("2026-10-20".to_string()),
            search: Some("NonExistentTerm".to_string()),
            include_archived: Some(false),
            ..Default::default()
        })
        .await
        .unwrap();

    assert_eq!(search_entries.len(), 0);
    assert_eq!(search_summary.opening_balance_minor, 10_000);
    assert_eq!(search_summary.period_inflows_minor, 25_000);
    assert_eq!(search_summary.period_outflows_minor, 0);
    assert_eq!(search_summary.net_operating_cash_flow_minor, 5_000);
    assert_eq!(search_summary.closing_balance_minor, 35_000);
    assert_eq!(search_summary.matching_inflows_minor, Some(0));
    assert_eq!(search_summary.matching_outflows_minor, Some(0));
    assert_eq!(search_summary.matching_count, Some(0));
}


