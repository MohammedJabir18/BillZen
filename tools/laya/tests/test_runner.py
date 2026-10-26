"""Tests for multi-provider evaluation runner, availability contracts, and not_run reporting."""

from __future__ import annotations

import pytest
from typing import Any, Dict, List, Optional, Tuple

from tools.laya.runner import (
    EvaluationProvider,
    OnnxLayaProvider,
    PythonLayaProvider,
    RulesProvider,
    run_multi_provider_evaluation,
)


class FakeTestProvider(EvaluationProvider):
    """Explicitly identified test-only fake provider for testing runner harness contracts."""

    def __init__(self, available: bool = True, default_pred: str = "rent"):
        self._available = available
        self._default_pred = default_pred
        self.name = "fake_test_provider"

    def is_available(self) -> Tuple[bool, str]:
        if self._available:
            return True, "Fake test provider ready"
        return False, "Simulated missing dependencies for test"

    def predict(
        self,
        text: str,
        task: str,
        candidates: Optional[List[Any]] = None,
        direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {"pred": self._default_pred, "confidence": 0.95}


def test_rules_provider_is_available():
    """RulesProvider must be ready and produce valid predictions."""
    provider = RulesProvider()
    ok, msg = provider.is_available()
    assert ok is True
    assert "ready" in msg.lower()

    res = provider.predict("Record payment of 1000", task="navigate.v1")
    assert res["pred"] == "cashbook_payment"
    assert res["confidence"] >= 0.70


def test_python_and_onnx_laya_providers_report_not_available_on_constrained_host():
    """On the reference host (1.4 GiB available RAM, no GPU, no exported weights), model providers must report not available."""
    py_provider = PythonLayaProvider()
    ok_py, msg_py = py_provider.is_available()
    assert ok_py is False
    assert any(k in msg_py.lower() for k in ["ram", "memory", "weight", "missing"])

    onnx_provider = OnnxLayaProvider()
    ok_onnx, msg_onnx = onnx_provider.is_available()
    assert ok_onnx is False
    assert any(k in msg_onnx.lower() for k in ["onnx", "weight", "missing"])


def test_runner_records_not_run_without_mock_pollution():
    """Unavailable providers must be recorded with status='not_run' and metrics=None, never mocked."""
    cases = [
        {
            "case_id": "c1",
            "task": "navigate.v1",
            "language": "en",
            "text": "Paid rent 1000",
            "expected": "cashbook_payment",
        }
    ]

    providers = [
        RulesProvider(),
        PythonLayaProvider(),
        OnnxLayaProvider(),
    ]

    report = run_multi_provider_evaluation(cases, providers)
    assert "results" in report
    results = report["results"]

    # Rules provider completed
    assert results["rules"]["status"] == "completed"
    assert results["rules"]["metrics"]["raw_accuracy"] == 1.0

    # Model providers must be NOT_RUN
    assert results["python_laya"]["status"] == "not_run"
    assert results["python_laya"]["metrics"] is None
    assert len(results["python_laya"]["reason"]) > 0

    assert results["onnx_laya"]["status"] == "not_run"
    assert results["onnx_laya"]["metrics"] is None
    assert len(results["onnx_laya"]["reason"]) > 0


def test_runner_with_fake_provider_harness():
    """Runner must execute available providers and compute valid metrics."""
    cases = [
        {
            "case_id": "c1",
            "task": "cashbook_category.v1",
            "direction": "payment",
            "language": "en",
            "text": "Paid rent",
            "candidates": ["rent", "utilities"],
            "expected": "rent",
        }
    ]

    fake = FakeTestProvider(available=True, default_pred="rent")
    report = run_multi_provider_evaluation(cases, [fake])
    assert report["results"]["fake_test_provider"]["status"] == "completed"
    assert report["results"]["fake_test_provider"]["metrics"]["raw_accuracy"] == 1.0
