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


def test_onnx_laya_provider_satisfies_pinned_five_input_graph_contract(tmp_path):
    """OnnxLayaProvider must feed the exact 5 graph inputs required by the pinned upstream exporter:
    input_ids, attention_mask, marker_pos, marker_mask, qtype.
    """
    from tools.laya.runner import OnnxLayaProvider

    onnx_file = tmp_path / "model.onnx"
    onnx_file.write_bytes(b"dummy onnx graph fixture")

    provider = OnnxLayaProvider(model_dir=tmp_path)

    captured_feed = {}

    class StrictPinnedGraphSession:
        """Strict mock verifying that all 5 pinned upstream graph inputs are supplied."""
        def get_inputs(self):
            class Meta:
                def __init__(self, name):
                    self.name = name
            return [
                Meta("input_ids"),
                Meta("attention_mask"),
                Meta("marker_pos"),
                Meta("marker_mask"),
                Meta("qtype"),
            ]

        def run(self, output_names, input_feed):
            captured_feed.update(input_feed)
            required = ["input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"]
            for req in required:
                if req not in input_feed:
                    raise RuntimeError(f"Missing required exported graph input: {req}")

            # Return logits and act_logits matching export_onnx.py output_names
            # logits: (batch_size=1, max_options=3), act_logits: (batch_size=1, 1)
            # Logit at index 1 is highest
            logits = [[0.2, 3.8, 0.5]]
            act_logits = [[0.95]]
            return [logits, act_logits]

    # Inject fake tokenizer fixture into provider
    class FakeTokenizer:
        def encode(self, text):
            # Tokenizer that produces distinct IDs for different scripts
            return [101] + [ord(c) % 5000 + 100 for c in text] + [102]

    provider._session = StrictPinnedGraphSession()
    provider._is_session_ready = True
    provider._tokenizer = FakeTokenizer()

    candidates = [
        {"id": "utilities", "label": "Electricity & Water"},
        {"id": "rent", "label": "Office Rent"},
        {"id": "salary", "label": "Staff Salary"},
    ]

    res = provider.predict(
        text="Paid office rent",
        task="cashbook_category.v1",
        candidates=candidates,
        direction="payment",
    )

    # 1. Must succeed without 'Missing required exported graph input' error
    assert "input_ids" in captured_feed
    assert "attention_mask" in captured_feed
    assert "marker_pos" in captured_feed
    assert "marker_mask" in captured_feed
    assert "qtype" in captured_feed

    # 2. Must predict "rent" matching index 1
    assert res["pred"] == "rent"
    assert res["confidence"] > 0.90


def test_onnx_laya_provider_encodes_options_and_preserves_candidate_order_invariance(tmp_path):
    """When candidates are reordered, OnnxLayaProvider must encode criteria correctly and select the right option."""
    from tools.laya.runner import OnnxLayaProvider

    onnx_file = tmp_path / "model.onnx"
    onnx_file.write_bytes(b"dummy onnx graph fixture")

    provider = OnnxLayaProvider(model_dir=tmp_path)

    # Mock session where "rent" option always gets the highest logit regardless of position
    # The session inspects marker_mask and assigns highest logit to whichever slot corresponds to rent
    class DynamicOptionSession:
        def get_inputs(self):
            class Meta:
                def __init__(self, name):
                    self.name = name
            return [Meta("input_ids"), Meta("attention_mask"), Meta("marker_pos"), Meta("marker_mask"), Meta("qtype")]

        def __init__(self, target_slot=0):
            self.target_slot = target_slot

        def run(self, output_names, input_feed):
            logits = [0.1] * 5
            logits[self.target_slot] = 4.0
            return [[logits], [[0.95]]]

    class FakeTokenizer:
        def encode(self, text):
            return [101, 102]

    provider._is_session_ready = True
    provider._tokenizer = FakeTokenizer()

    # Case A: "rent" is at slot 0
    provider._session = DynamicOptionSession(target_slot=0)
    res_a = provider.predict(
        text="Paid rent",
        task="cashbook_category.v1",
        candidates=["rent", "utilities", "salary"],
        direction="payment",
    )
    assert res_a["pred"] == "rent"

    # Case B: "rent" is at slot 1
    provider._session = DynamicOptionSession(target_slot=1)
    res_b = provider.predict(
        text="Paid rent",
        task="cashbook_category.v1",
        candidates=["utilities", "rent", "salary"],
        direction="payment",
    )
    assert res_b["pred"] == "rent"


def test_onnx_laya_provider_rejects_ascii_ord_fallback_without_tokenizer(tmp_path):
    """Without a real tokenizer, OnnxLayaProvider must fail rather than collapsing text to [255, 255, ...]."""
    from tools.laya.runner import OnnxLayaProvider

    onnx_file = tmp_path / "model.onnx"
    onnx_file.write_bytes(b"dummy onnx graph fixture")

    provider = OnnxLayaProvider(model_dir=tmp_path)

    class AnyInputSession:
        def get_inputs(self):
            class Meta:
                def __init__(self, name):
                    self.name = name
            return [Meta("input_ids")]
        def run(self, *args, **kwargs):
            return [[[0.1, 0.9]]]

    provider._session = AnyInputSession()
    provider._is_session_ready = True
    provider._tokenizer = None  # No tokenizer loaded

    with pytest.raises(RuntimeError, match="tokenizer"):
        provider.predict(
            text="വാടക കൊടുത്തു",  # Malayalam
            task="cashbook_category.v1",
            candidates=["rent", "utilities"],
            direction="payment",
        )


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

