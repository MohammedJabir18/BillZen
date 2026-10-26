"""Tests for synthetic dataset integrity, case-group isolation, and option permutation invariance."""

from __future__ import annotations

import copy
import pytest
import random
from tools.laya.prepare_dataset import (
    NAVIGATE_OPTIONS,
    RAW_CASES,
    SUPPORTED_TASKS,
    split_grouped_dataset,
)


def test_unique_case_ids():
    """All raw cases must have strictly unique case_id strings."""
    ids = [c["case_id"] for c in RAW_CASES]
    assert len(ids) == len(set(ids)), f"Duplicate case IDs found: {[x for x in ids if ids.count(x) > 1]}"


def test_supported_tasks_and_fields():
    """Every case must belong to supported tasks and contain non-empty text, language, and expected label."""
    for c in RAW_CASES:
        assert c["task"] in SUPPORTED_TASKS, f"Unknown task: {c['task']}"
        assert c["language"] in ["en", "ml", "manglish", "ar"], f"Unsupported language: {c.get('language')}"
        assert len(c["text"].strip()) > 0, f"Empty text in case: {c['case_id']}"
        assert len(c["expected"].strip()) > 0, f"Empty expected in case: {c['case_id']}"

        if c["task"] == "cashbook_category.v1":
            assert "direction" in c, f"Missing direction in category case: {c['case_id']}"
            assert c["direction"] in ["payment", "receipt"], f"Invalid direction: {c['direction']}"
            assert "candidates" in c and isinstance(c["candidates"], list), f"Missing candidates in {c['case_id']}"
            assert c["expected"] in c["candidates"], f"Expected label '{c['expected']}' not in candidates in {c['case_id']}"


def test_no_private_or_sensitive_credentials():
    """Data must not contain real credentials, API tokens, passwords, or live tax IDs."""
    forbidden = ["password", "secret", "bearer", "ghp_", "sk-", "private_key", "aadhaar", "pan:"]
    for c in RAW_CASES:
        t_lower = c["text"].lower()
        for f in forbidden:
            assert f not in t_lower, f"Forbidden sensitive token '{f}' found in {c['case_id']}"


def test_case_group_split_isolation():
    """Grouped split must NEVER leak the same case_id across train, dev, calibration, and test."""
    splits = split_grouped_dataset(RAW_CASES, seed=42)

    train_ids = {c["case_id"] for c in splits["train"]}
    dev_ids = {c["case_id"] for c in splits["dev"]}
    calib_ids = {c["case_id"] for c in splits["calibration"]}
    test_ids = {c["case_id"] for c in splits["test"]}

    # Verify mutual exclusion
    assert len(train_ids & dev_ids) == 0, f"Train and Dev overlap: {train_ids & dev_ids}"
    assert len(train_ids & calib_ids) == 0, f"Train and Calib overlap: {train_ids & calib_ids}"
    assert len(train_ids & test_ids) == 0, f"Train and Test overlap: {train_ids & test_ids}"
    assert len(dev_ids & calib_ids) == 0, f"Dev and Calib overlap: {dev_ids & calib_ids}"
    assert len(dev_ids & test_ids) == 0, f"Dev and Test overlap: {dev_ids & test_ids}"
    assert len(calib_ids & test_ids) == 0, f"Calib and Test overlap: {calib_ids & test_ids}"

    # Verify complete union
    all_split_ids = train_ids | dev_ids | calib_ids | test_ids
    assert all_split_ids == {c["case_id"] for c in RAW_CASES}


def test_option_permutation_invariance():
    """Shuffling candidate options order must preserve the identity of the expected target."""
    rng = random.Random(123)
    for c in RAW_CASES:
        if c["task"] == "cashbook_category.v1":
            original_candidates = list(c["candidates"])
            shuffled_candidates = list(original_candidates)
            rng.shuffle(shuffled_candidates)

            # Target label must remain present and match
            assert c["expected"] in shuffled_candidates
            assert set(original_candidates) == set(shuffled_candidates)


def test_family_group_isolation_with_multiple_variants():
    """Review Finding R2: When multiple cases share the same group_id, all variants MUST remain in the same partition."""
    multi_variant_cases = [
        {"case_id": "c1_v1", "group_id": "grp_alpha", "task": "navigate.v1", "language": "en", "text": "Pay rent", "expected": "cashbook_payment"},
        {"case_id": "c1_v2", "group_id": "grp_alpha", "task": "navigate.v1", "language": "en", "text": "Paying rent", "expected": "cashbook_payment"},
        {"case_id": "c1_v3", "group_id": "grp_alpha", "task": "navigate.v1", "language": "en", "text": "Rent payment", "expected": "cashbook_payment"},
        {"case_id": "c2_v1", "group_id": "grp_beta", "task": "navigate.v1", "language": "en", "text": "Received cash", "expected": "cashbook_receipt"},
        {"case_id": "c2_v2", "group_id": "grp_beta", "task": "navigate.v1", "language": "en", "text": "Cash received", "expected": "cashbook_receipt"},
        {"case_id": "c3_v1", "group_id": "grp_gamma", "task": "navigate.v1", "language": "en", "text": "Bank to cash", "expected": "account_transfer"},
        {"case_id": "c4_v1", "group_id": "grp_delta", "task": "navigate.v1", "language": "en", "text": "New invoice", "expected": "invoice_draft"},
    ]

    splits = split_grouped_dataset(multi_variant_cases, seed=42)

    # Check for grp_alpha: c1_v1, c1_v2, c1_v3 must be in the exact same partition
    alpha_partitions = []
    for split_name, items in splits.items():
        found = [item["case_id"] for item in items if item.get("group_id") == "grp_alpha"]
        if found:
            alpha_partitions.append((split_name, found))

    assert len(alpha_partitions) == 1, (
        f"Family 'grp_alpha' leaked across multiple splits: {alpha_partitions}"
    )
    assert len(alpha_partitions[0][1]) == 3, "All 3 variants of grp_alpha must be together"


def test_split_grouped_dataset_rejects_duplicate_case_ids():
    """Dataset splitting must reject duplicate case_id at runtime."""
    dup_cases = [
        {"case_id": "c1", "group_id": "g1", "task": "navigate.v1", "language": "en", "text": "Text 1", "expected": "cashbook_payment"},
        {"case_id": "c1", "group_id": "g2", "task": "navigate.v1", "language": "en", "text": "Text 2", "expected": "cashbook_receipt"},
    ]
    with pytest.raises(ValueError, match="duplicate case_id"):
        split_grouped_dataset(dup_cases)


def test_split_grouped_dataset_rejects_invalid_split_ratios():
    """Dataset splitting must reject invalid split ratios."""
    cases = [
        {"case_id": f"c_{i}", "group_id": f"g_{i}", "task": "navigate.v1", "language": "en", "text": f"T {i}", "expected": "cashbook_payment"}
        for i in range(5)
    ]
    with pytest.raises(ValueError, match="ratio"):
        split_grouped_dataset(cases, train_ratio=0.80, dev_ratio=0.30, calib_ratio=0.10, test_ratio=0.10)


def test_validate_dataset_case_runtime_rejection():
    """validate_dataset_case must catch malformed cases, missing group_id, unknown tasks, and private data."""
    from tools.laya.prepare_dataset import validate_dataset_case

    # Valid case
    valid_c = {
        "case_id": "valid_01",
        "group_id": "grp_01",
        "task": "navigate.v1",
        "language": "en",
        "text": "Record payment of office rent",
        "expected": "cashbook_payment",
    }
    ok, errs = validate_dataset_case(valid_c)
    assert ok is True
    assert len(errs) == 0

    # Missing group_id
    bad_c1 = copy.deepcopy(valid_c)
    del bad_c1["group_id"]
    ok, errs = validate_dataset_case(bad_c1)
    assert ok is False
    assert any("group_id" in e for e in errs)

    # Unknown task
    bad_c2 = copy.deepcopy(valid_c)
    bad_c2["task"] = "unknown.task.v99"
    ok, errs = validate_dataset_case(bad_c2)
    assert ok is False
    assert any("task" in e for e in errs)

    # Private token in text
    bad_c3 = copy.deepcopy(valid_c)
    bad_c3["text"] = "Customer provided bearer token ghp_secretkey"
    ok, errs = validate_dataset_case(bad_c3)
    assert ok is False
    assert any("forbidden" in e.lower() or "sensitive" in e.lower() for e in errs)

    # Boolean group_id
    bad_c4 = copy.deepcopy(valid_c)
    bad_c4["group_id"] = True
    ok, errs = validate_dataset_case(bad_c4)
    assert ok is False
    assert any("group_id" in e for e in errs)

    # Null text (must not raise AttributeError)
    bad_c5 = copy.deepcopy(valid_c)
    bad_c5["text"] = None
    ok, errs = validate_dataset_case(bad_c5)
    assert ok is False
    assert any("text" in e for e in errs)

    # Invalid navigate expected label
    bad_c6 = copy.deepcopy(valid_c)
    bad_c6["expected"] = "unsupported_navigation_action"
    ok, errs = validate_dataset_case(bad_c6)
    assert ok is False
    assert any("expected" in e for e in errs)

    # Duplicate candidates in category task
    bad_c7 = {
        "case_id": "cat_test_dup",
        "group_id": "grp_cat_dup",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Paid office rent",
        "candidates": ["rent", "rent", "utilities"],
        "expected": "rent",
    }
    ok, errs = validate_dataset_case(bad_c7)
    assert ok is False
    assert any("duplicate" in e.lower() for e in errs)


def test_export_case_to_laya_finetune_state_contract():
    """Laya export format must strictly adhere to the pinned upstream {state, questions, expected} contract.
    
    Verifies against upstream items_from_rows requirements:
    - questions is a dict: qid -> {type, instructions, criteria: {cid: desc}}
    - expected is a dict: qid -> expected_label
    - instructions is plural
    - criteria is a dict mapping ID to description
    """
    from tools.laya.prepare_dataset import export_case_to_laya_finetune_format

    def simulate_upstream_items_from_rows(row: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any], str]]:
        """Simulate upstream laya/train.py items_from_rows schema iteration."""
        questions = row.get("questions", {})
        expected = row.get("expected", {})
        assert isinstance(questions, dict), f"questions must be a dict, got {type(questions)}"
        assert isinstance(expected, dict), f"expected must be a dict, got {type(expected)}"
        items = []
        for qid, q in questions.items():
            assert isinstance(q, dict), f"question '{qid}' must be a dict"
            assert q.get("type") == "choice"
            assert "instructions" in q and isinstance(q["instructions"], str)
            assert "criteria" in q and isinstance(q["criteria"], dict)
            target = expected.get(qid)
            assert target is not None, f"expected missing key for question '{qid}'"
            assert target in q["criteria"], f"expected target '{target}' not in criteria keys: {list(q['criteria'].keys())}"
            items.append((qid, q, target))
        return items

    # 1. Navigate task case
    nav_case = {
        "case_id": "nav_en_01",
        "group_id": "grp_nav_en_01",
        "task": "navigate.v1",
        "language": "en",
        "text": "Record payment of 1200 for office supplies",
        "expected": "cashbook_payment",
        "tags": ["standard_payment", "fixture_tag"],
    }

    nav_exported = export_case_to_laya_finetune_format(nav_case)
    assert "state" in nav_exported
    assert "questions" in nav_exported
    assert "expected" in nav_exported
    assert nav_exported["state"]["text"] == "Record payment of 1200 for office supplies"
    assert nav_exported["state"]["task"] == "navigate.v1"

    # Validate against simulated upstream items_from_rows
    nav_items = simulate_upstream_items_from_rows(nav_exported)
    assert len(nav_items) == 1
    qid, q, target = nav_items[0]
    assert qid == "navigate"
    assert target == "cashbook_payment"
    assert "cashbook_payment" in q["criteria"]
    assert "cashbook_receipt" in q["criteria"]
    assert isinstance(q["criteria"]["cashbook_payment"], str)

    # 2. Category task case with candidate shortlist
    cat_case = {
        "case_id": "cat_en_01",
        "group_id": "grp_cat_en_01",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Paid monthly office rent",
        "candidates": [
            {"id": "rent", "label": "Office Rent"},
            {"id": "utilities", "label": "Electricity & Water"},
            {"id": "none", "label": "None of the above"},
        ],
        "expected": "rent",
    }

    cat_exported = export_case_to_laya_finetune_format(cat_case)
    assert cat_exported["state"]["direction"] == "payment"

    cat_items = simulate_upstream_items_from_rows(cat_exported)
    assert len(cat_items) == 1
    c_qid, c_q, c_target = cat_items[0]
    assert c_qid == "category"
    assert c_target == "rent"
    assert c_q["criteria"]["rent"] == "Office Rent"
    assert c_q["criteria"]["utilities"] == "Electricity & Water"
    assert c_q["criteria"]["none"] == "None of the above"

    # Must NOT leak internal fixture bookkeeping
    assert "case_id" not in nav_exported
    assert "group_id" not in nav_exported
    assert "tags" not in nav_exported
    assert "case_id" not in cat_exported




def test_fresh_holdout_cases_coverage_and_isolation():
    """Review Finding R2: An independent fresh blind holdout must exist, with coverage of Arabic and Malayalam, and zero case_id overlap with RAW_CASES."""
    from tools.laya.prepare_dataset import FRESH_HOLDOUT_CASES, RAW_CASES

    assert len(FRESH_HOLDOUT_CASES) >= 20, "Holdout must contain at least 20 independent cases"

    # Zero ID overlap with RAW_CASES
    raw_ids = {c["case_id"] for c in RAW_CASES}
    holdout_ids = {c["case_id"] for c in FRESH_HOLDOUT_CASES}
    assert len(raw_ids & holdout_ids) == 0, f"Holdout shares case IDs with raw cases: {raw_ids & holdout_ids}"

    # Zero group_id overlap with RAW_CASES
    raw_groups = {c.get("group_id") for c in RAW_CASES}
    holdout_groups = {c.get("group_id") for c in FRESH_HOLDOUT_CASES}
    assert len(raw_groups & holdout_groups) == 0, f"Holdout shares group IDs with raw cases: {raw_groups & holdout_groups}"

    # Verify language coverage in holdout
    holdout_langs = {c["language"] for c in FRESH_HOLDOUT_CASES}
    assert {"en", "ml", "manglish", "ar"} <= holdout_langs, f"Missing languages in holdout: {holdout_langs}"

    # Verify task coverage
    holdout_tasks = {c["task"] for c in FRESH_HOLDOUT_CASES}
    assert {"navigate.v1", "cashbook_category.v1"} <= holdout_tasks

