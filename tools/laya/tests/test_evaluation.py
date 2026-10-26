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
