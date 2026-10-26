"""Tests for evaluation metrics, confusion matrix, calibration, and baseline accuracy."""

from __future__ import annotations

import pytest
from tools.laya.evaluate_billzen import (
    DeterministicRuleClassifier,
    compute_metrics,
    run_benchmark,
)
from tools.laya.prepare_dataset import RAW_CASES


def test_compute_metrics_perfect_predictions():
    """Perfect predictions should yield 1.0 accuracy, 1.0 macro-F1, 0.0 ECE, and 0.0 Brier."""
    records = [
        {"actual": "a", "pred": "a", "confidence": 1.0},
        {"actual": "b", "pred": "b", "confidence": 1.0},
        {"actual": "c", "pred": "c", "confidence": 1.0},
    ]
    m = compute_metrics(records, abstention_threshold=0.70)
    assert m["raw_accuracy"] == 1.0
    assert m["macro_f1"] == 1.0
    assert m["selective_precision"] == 1.0
    assert m["selective_coverage"] == 1.0
    assert m["brier_score"] == 0.0
    assert m["expected_calibration_error"] == 0.0


def test_compute_metrics_abstention_and_coverage():
    """Records with confidence below threshold must be excluded from selective precision."""
    records = [
        {"actual": "a", "pred": "a", "confidence": 0.90},  # Accepted, correct
        {"actual": "b", "pred": "c", "confidence": 0.40},  # Abstained, incorrect
        {"actual": "b", "pred": "b", "confidence": 0.50},  # Abstained, correct
    ]
    m = compute_metrics(records, abstention_threshold=0.70)
    assert m["total_cases"] == 3
    assert m["selective_coverage"] == round(1 / 3, 4)
    assert m["selective_precision"] == 1.0  # The 1 accepted record was correct!


def test_review_focus_negations_and_hypotheticals():
    """Review Focus class 1: Negations, hypotheticals, and unsupported actions must return clarify."""
    clf = DeterministicRuleClassifier()

    cases = [
        "Do not pay the rent this month, wait",
        "ഇന്ന് കടവാടക കൊടുക്കേണ്ടതില്ലെന്ന് പറഞ്ഞു",
        "Innu vadaka kodukkenda, pinne kodukkam",
        "لا تدفع الإيجار اليوم",
        "What if customer asks for refund?",
        "അടുത്ത മാസം പണം തന്നാൽ മാറ്റാമോ?",
        "Automatically submit e-invoice to government tax portal",
    ]
    for text in cases:
        pred, conf = clf.predict_navigate(text)
        assert pred == "clarify", f"Failed to clarify for text: '{text}', got: '{pred}'"
        assert conf >= 0.90


def test_review_focus_transfer_vs_expense():
    """Review Focus class 2: Transfers must never be classified as simple payments or receipts."""
    clf = DeterministicRuleClassifier()

    transfer_cases = [
        ("Transferred 10000 from cash register to bank account", "en"),
        ("Withdrew 2000 from ATM to petty cash box", "en"),
        ("ക്യാഷിൽ നിന്നും 25000 ബാങ്കിൽ നിക്ഷേപിച്ചു", "ml"),
        ("ബാങ്കിൽ നിന്നും 5000 രൂപ ക്യാഷ് ഡ്രോയറിലേക്ക് പിൻവലിച്ചു", "ml"),
        ("Cashil ninn bankilekku 5000 ittu", "manglish"),
        ("Bankil ninn 3000 cash withdraw cheythu", "manglish"),
        ("تحويل 5000 من الصندوق إلى الحساب البنكي", "ar"),
        ("سحب 2000 من البنك إلى الخزينة", "ar"),
    ]
    for text, lang in transfer_cases:
        pred, conf = clf.predict_navigate(text)
        assert pred == "account_transfer", (
            f"Transfer misclassified as '{pred}' for [{lang}]: '{text}'"
        )
        assert conf >= 0.90


def test_review_focus_missing_candidate_selects_none():
    """Review Focus class 3: If candidate categories do not match, classifier must select 'none'."""
    clf = DeterministicRuleClassifier()

    candidates = ["rent", "utilities", "salary", "none"]
    pred, conf = clf.predict_category("Purchased specialized medical equipment", candidates)
    assert pred == "none"
    assert conf >= 0.85


def test_deterministic_baseline_benchmark_performance():
    """Baseline deterministic engine must achieve >= 0.90 macro-F1 on reviewed synthetic corpus."""
    results = run_benchmark(RAW_CASES, abstention_threshold=0.70)
    overall = results["overall"]

    assert overall["raw_accuracy"] >= 0.90, f"Raw accuracy low: {overall['raw_accuracy']}"
    assert overall["macro_f1"] >= 0.90, f"Macro F1 low: {overall['macro_f1']}"
    assert overall["selective_precision"] >= 0.95, f"Selective precision low: {overall['selective_precision']}"

    # Verify each language slice
    for lang, metrics in results["by_language"].items():
        assert metrics["raw_accuracy"] >= 0.85, f"Language {lang} accuracy below 0.85: {metrics['raw_accuracy']}"


def test_review_route_errors_regression():
    """Failing regression test for Review Finding R3:
    - 'Pay electricity bill' -> cashbook_payment (not invoice_draft)
    - 'Paid supplier invoice' -> cashbook_payment (not invoice_draft)
    - 'Customer paid by bank transfer' -> cashbook_receipt (not account_transfer)
    - 'Salary was paid by bank transfer' -> cashbook_payment (not account_transfer)
    - 'Received gift from customer' -> cashbook_receipt (not clarify because of 'if' in 'gift')
    - 'Shift stock to shelf' -> not clarify because of 'if' in 'shift'
    - 'Show salary payments' -> reports_view (read-only query must not become payment posting)
    """
    clf = DeterministicRuleClassifier()

    cases = [
        ("Pay electricity bill", "cashbook_payment"),
        ("Paid supplier invoice", "cashbook_payment"),
        ("Customer paid by bank transfer", "cashbook_receipt"),
        ("Salary was paid by bank transfer", "cashbook_payment"),
        ("Received gift from customer", "cashbook_receipt"),
        ("Show salary payments", "reports_view"),
    ]

    for text, expected in cases:
        pred, conf = clf.predict_navigate(text)
        assert pred == expected, f"Failed for '{text}': expected '{expected}', got '{pred}'"

    # 'Shift stock to shelf': must not be clarify due to 'if' in 'shift'
    pred, _ = clf.predict_navigate("Shift stock to shelf")
    assert pred == "inventory_stock", f"Shift stock should map to inventory_stock, got '{pred}'"


def test_review_candidate_ties_and_permutation_regression():
    """Failing regression test for Review Finding R4:
    - Candidate ties (e.g. 'rent and salary') must consistently clarify or select none, NEVER picking whichever was first.
    - Candidate permutations must produce invariant prediction results.
    """
    clf = DeterministicRuleClassifier()

    # Tied input: text mentions both rent and salary equally
    pred1, _ = clf.predict_category("rent and salary", ["rent", "salary", "none"])
    pred2, _ = clf.predict_category("rent and salary", ["salary", "rent", "none"])

    # Both must match and neither should arbitrarily favor one over the other
    assert pred1 == pred2, f"Candidate order changed tie prediction: '{pred1}' vs '{pred2}'"
    assert pred1 in ["clarify", "none"], f"Tied candidates should clarify/none, got: '{pred1}'"

    # Permutation test on unambiguous case
    unambiguous_text = "Paid office rent"
    cand_order1 = ["rent", "utilities", "salary", "none"]
    cand_order2 = ["none", "salary", "utilities", "rent"]
    p1, _ = clf.predict_category(unambiguous_text, cand_order1)
    p2, _ = clf.predict_category(unambiguous_text, cand_order2)
    assert p1 == p2 == "rent"


def test_review_structured_candidates_with_uuid_and_direction():
    """Failing regression test for Review Finding R4:
    - Real-style candidate objects with UUIDs, human labels, and direction compatibility.
    """
    clf = DeterministicRuleClassifier()

    candidates = [
        {"id": "cat-uuid-001", "label": "Office Rent", "direction": "payment"},
        {"id": "cat-uuid-002", "label": "Electricity & Water", "direction": "payment"},
        {"id": "cat-uuid-003", "label": "Staff Salaries", "direction": "payment"},
        {"id": "cat-uuid-999", "label": "None of the above", "direction": "payment"},
    ]

    # Matching with direction = payment
    pred, conf = clf.predict_category(
        "Paid office rent for October",
        candidates,
        direction="payment",
    )
    assert pred == "cat-uuid-001", f"Expected matching UUID 'cat-uuid-001', got: '{pred}'"
    assert conf >= 0.85

    # If direction is receipt, payment categories must NOT match
    pred_wrong_dir, _ = clf.predict_category(
        "Paid office rent for October",
        candidates,
        direction="receipt",
    )
    assert pred_wrong_dir in ["none", "clarify", "cat-uuid-999"], f"Expected rejection on mismatched direction, got '{pred_wrong_dir}'"

