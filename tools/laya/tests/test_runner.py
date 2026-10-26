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

    def check_readiness(self) -> Tuple[Any, str]:
        from tools.laya.runner import ProviderState
        if self._available:
            return ProviderState.READY, "Fake test provider ready"
        return ProviderState.MISSING_DEPENDENCIES, "Simulated missing dependencies for test"

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


def test_provider_states_and_readiness_lifecycle():
    """Providers must expose structured ProviderState distinguishing dependencies, assets, and memory."""
    from tools.laya.runner import ProviderState

    assert ProviderState.READY == "ready"
    assert ProviderState.MISSING_ASSETS == "missing_assets"
    assert ProviderState.MISSING_DEPENDENCIES == "missing_dependencies"
    assert ProviderState.INSUFFICIENT_RESOURCES == "insufficient_resources"
    assert ProviderState.NOT_IMPLEMENTED == "provider_not_implemented"

    py_provider = PythonLayaProvider()
    state_py, reason_py = py_provider.check_readiness()
    assert state_py in [ProviderState.INSUFFICIENT_RESOURCES, ProviderState.MISSING_ASSETS, ProviderState.MISSING_DEPENDENCIES]

    onnx_provider = OnnxLayaProvider()
    state_onnx, reason_onnx = onnx_provider.check_readiness()
    assert state_onnx in [ProviderState.MISSING_ASSETS, ProviderState.MISSING_DEPENDENCIES]


def test_onnx_laya_provider_real_inference_with_mock_session(tmp_path):
    """OnnxLayaProvider must execute real tensor scoring and softmax without raising NotImplementedError."""
    from tools.laya.runner import OnnxLayaProvider

    # Create dummy asset files
    onnx_file = tmp_path / "model.onnx"
    onnx_file.write_bytes(b"dummy onnx graph fixture")
    tok_file = tmp_path / "tokenizer.json"
    tok_file.write_text("{}", encoding="utf-8")

    provider = OnnxLayaProvider(model_dir=tmp_path)

    # Mock onnxruntime session returning logits for 3 classes: [0.1, 2.5, 0.4] -> argmax is index 1
    class MockOrtSession:
        def get_inputs(self):
            class InputMeta:
                name = "input_ids"
            return [InputMeta()]

        def run(self, output_names, input_feed):
            # Logits where index 1 ("rent") has the highest score (batch_size 1, 3 classes)
            return [[[0.2, 3.8, 0.5]]]

    provider._session = MockOrtSession()
    provider._is_session_ready = True

    candidates = ["utilities", "rent", "salary"]
    res = provider.predict(
        text="Paid office rent",
        task="cashbook_category.v1",
        candidates=candidates,
        direction="payment",
    )

    # Must predict "rent" with high softmax probability, NOT raise NotImplementedError!
    assert res["pred"] == "rent"
    assert res["confidence"] > 0.90


def test_runner_handles_provider_execution_failure_gracefully():
    """If a provider throws during execution, runner must mark it failed and preserve other providers."""
    class CrashingProvider(EvaluationProvider):
        name = "crashing_provider"

        def check_readiness(self) -> Tuple[Any, str]:
            from tools.laya.runner import ProviderState
            return ProviderState.READY, "Ready"

        def predict(self, *args, **kwargs) -> Dict[str, Any]:
            raise RuntimeError("Inference runtime crash (e.g. CUDA OOM or corrupted graph)")

    cases = [
        {
            "case_id": "c1",
            "task": "navigate.v1",
            "language": "en",
            "text": "Paid rent 1000",
            "expected": "cashbook_payment",
        }
    ]

    providers = [RulesProvider(), CrashingProvider()]
    report = run_multi_provider_evaluation(cases, providers)

    results = report["results"]
    assert results["rules"]["status"] == "completed"
    assert results["rules"]["metrics"]["raw_accuracy"] == 1.0

    assert results["crashing_provider"]["status"] == "failed"
    assert results["crashing_provider"]["metrics"] is None
    assert "Inference runtime crash" in results["crashing_provider"]["error"]

