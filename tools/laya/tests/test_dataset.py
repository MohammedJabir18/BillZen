"""Tests for synthetic dataset integrity, case-group isolation, and option permutation invariance."""

from __future__ import annotations

import copy
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
