"""Tests for host candidate filtering, context safety, and compound navigation policies."""

from __future__ import annotations

import pytest
from tools.laya.host_policy import (
    filter_candidates_for_host,
    validate_assistant_result_against_host,
)


def test_filter_candidates_drops_inactive_and_archived():
    """Inactive or archived candidates must be dropped before being considered by the assistant."""
    raw = [
        {"id": "c1", "label": "Active Rent", "direction": "payment", "is_active": True, "archived": False},
        {"id": "c2", "label": "Archived Rent", "direction": "payment", "is_active": True, "archived": True},
        {"id": "c3", "label": "Inactive Utilities", "direction": "payment", "is_active": False, "archived": False},
        {"id": "c4", "label": "Wrong Direction", "direction": "receipt", "is_active": True, "archived": False},
    ]

    filtered, dropped = filter_candidates_for_host(raw, direction="payment")
    assert len(filtered) == 1
    assert filtered[0]["id"] == "c1"
    assert len(dropped) == 3


def test_filter_candidates_rejects_duplicates_and_malformed():
    """Candidates missing ID/label or duplicate IDs must be safely handled."""
    raw = [
        {"id": "c1", "label": "Salary", "direction": "payment", "is_active": True},
        {"id": "c1", "label": "Salary Duplicate", "direction": "payment", "is_active": True},
        {"id": "", "label": "Empty ID", "direction": "payment", "is_active": True},
        {"label": "No ID", "direction": "payment", "is_active": True},
    ]

    filtered, dropped = filter_candidates_for_host(raw, direction="payment")
    assert len(filtered) == 1
    assert filtered[0]["id"] == "c1"
    assert any("duplicate" in d.lower() for d in dropped)
    assert any("empty" in d.lower() or "missing" in d.lower() for d in dropped)


def test_host_validation_rejects_unknown_ids_and_stale_context():
    """Assistant results predicting unknown IDs or running against stale context must abstain safely."""
    allowed = {"rent", "utilities", "salary"}
    context = {"expected_currency": "INR", "active_tab": "cashbook"}

    # Unknown ID returned by model
    bad_result = {"pred": "unregistered_category_xyz", "confidence": 0.95}
    safe_out = validate_assistant_result_against_host(bad_result, allowed, context)
    assert safe_out["is_actionable"] is False
    assert safe_out["pred"] == "clarify"
    assert safe_out["reason"] == "unknown_candidate_id"

    # Stale currency context
    stale_context = {"expected_currency": "SAR", "active_tab": "cashbook"}
    valid_result = {"pred": "rent", "confidence": 0.95, "currency": "INR"}
    safe_stale = validate_assistant_result_against_host(valid_result, allowed, stale_context)
    assert safe_stale["is_actionable"] is False
    assert safe_stale["reason"] == "stale_context"


def test_host_validation_detects_compound_navigation_intents():
    """Compound requests combining multiple conflicting actions must force clarification."""
    allowed_nav = {
        "cashbook_payment", "cashbook_receipt", "account_transfer",
        "invoice_draft", "inventory_stock", "reports_view", "clarify"
    }
    context = {"expected_currency": "INR"}

    compound_inputs = [
        "Pay rent 5000 and record customer receipt 2000",
        "കടവാടക കൊടുത്തു കൂടാതെ കസ്റ്റമർ തന്ന പണം വാങ്ങി",
        "ادفع الإيجار واستلم نقود من العميل",
    ]

    for text in compound_inputs:
        raw_result = {"pred": "cashbook_payment", "confidence": 0.92, "text": text}
        out = validate_assistant_result_against_host(raw_result, allowed_nav, context)
        assert out["is_actionable"] is False
        assert out["pred"] == "clarify"
        assert out["reason"] == "compound_intent"
