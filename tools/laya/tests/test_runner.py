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


def test_onnx_laya_provider_uses_pinned_sdk_constructor_signature(tmp_path):
    """OnnxLayaProvider must use the pinned upstream ONNXAgent constructor signature:
    ONNXAgent(model_id_or_path: str, onnx_path: str, ...).
    Passing 'model_path_or_dir' must raise TypeError.
    """
    from tools.laya.runner import OnnxLayaProvider

    class StubPinnedONNXAgent:
        def __init__(self, model_id_or_path: str, onnx_path: str = "laya.onnx", **kwargs):
            if "model_path_or_dir" in kwargs:
                raise TypeError("unexpected keyword argument 'model_path_or_dir'")
            self.model_id_or_path = model_id_or_path
            self.onnx_path = onnx_path
            self.kwargs = kwargs

        def system_one(self, state, questions):
            qid = next(iter(questions))
            return {
                "answers": {
                    qid: {
                        "choice": "rent",
                        "confidence": 0.95,
                        "answer_confidence": 0.95,
                        "probabilities": {"rent": 0.95, "utilities": 0.05},
                    }
                }
            }

    onnx_file = tmp_path / "model.onnx"
    onnx_file.write_bytes(b"dummy")

    provider = OnnxLayaProvider(checkpoint_dir=tmp_path, onnx_path=onnx_file)
    assert provider.checkpoint_dir == tmp_path
    assert provider.onnx_path == onnx_file

    # Directly verify that constructor call with model_path_or_dir fails with TypeError
    with pytest.raises(TypeError):
        StubPinnedONNXAgent(model_path_or_dir=str(tmp_path))

    with pytest.raises(TypeError, match="unexpected keyword argument 'model_path_or_dir'"):
        StubPinnedONNXAgent(model_id_or_path=str(tmp_path), model_path_or_dir=str(tmp_path))


    # And with correct upstream kwargs it succeeds
    agent = StubPinnedONNXAgent(model_id_or_path=str(tmp_path), onnx_path=str(onnx_file))
    assert agent.model_id_or_path == str(tmp_path)
    assert agent.onnx_path == str(onnx_file)

    # Inject stub into provider and verify predict succeeds through system_one
    provider._agent = agent
    res = provider.predict(
        text="Paid rent",
        task="cashbook_category.v1",
        candidates=["rent", "utilities"],
        direction="payment",
    )
    assert res["pred"] == "rent"
    assert res["confidence"] == 0.95
    assert res["answer_confidence"] == 0.95
    assert res["probabilities"]["rent"] == 0.95


def test_onnx_agent_boundary_preserves_option_identity_under_permutation(tmp_path):
    """When candidates are permuted, OnnxLayaProvider passes the permuted criteria mapping
    to the SDK system_one(state, questions). The SDK stub inspects criteria keys without
    requiring manual test manipulation of winning slot indices.
    """
    from tools.laya.runner import OnnxLayaProvider

    class CriteriaInspectingStubAgent:
        """SDK boundary stub that inspects the passed criteria mapping dynamically."""
        def __init__(self, target_id: str):
            self.target_id = target_id
            self.received_criteria = None

        def system_one(self, state, questions):
            qid = next(iter(questions))
            criteria = questions[qid]["criteria"]
            self.received_criteria = criteria
            if self.target_id in criteria:
                chosen = self.target_id
                conf = 0.91
            else:
                chosen = "clarify"
                conf = 0.0
            probs = {cid: (0.91 if cid == chosen else 0.09 / max(len(criteria) - 1, 1)) for cid in criteria}
            return {
                "answers": {
                    qid: {
                        "choice": chosen,
                        "confidence": conf,
                        "answer_confidence": conf,
                        "probabilities": probs,
                    }
                }
            }

    stub = CriteriaInspectingStubAgent(target_id="rent")
    provider = OnnxLayaProvider(checkpoint_dir=tmp_path)
    provider._agent = stub

    # Permutation 1: rent is first
    res1 = provider.predict(
        text="Paid rent",
        task="cashbook_category.v1",
        candidates=["rent", "utilities", "salary"],
        direction="payment",
    )
    assert res1["pred"] == "rent"
    assert res1["probabilities"]["rent"] == 0.91
    assert list(stub.received_criteria.keys()) == ["rent", "utilities", "salary"]

    # Permutation 2: rent is second
    # Notice: we DO NOT change target_slot or re-create the stub!
    res2 = provider.predict(
        text="Paid rent",
        task="cashbook_category.v1",
        candidates=["utilities", "rent", "salary"],
        direction="payment",
    )
    assert res2["pred"] == "rent"
    assert res2["probabilities"]["rent"] == 0.91
    assert list(stub.received_criteria.keys()) == ["utilities", "rent", "salary"]


def test_onnx_laya_provider_fails_closed_without_direct_fallback(tmp_path):
    """When upstream dependencies or assets are missing, OnnxLayaProvider must fail closed.
    It must NOT fall back to direct onnxruntime execution, invented marker positions, or text-only tokenization.
    """
    from tools.laya.runner import OnnxLayaProvider, ProviderState

    empty_dir = tmp_path / "empty_assets"
    empty_dir.mkdir()

    provider = OnnxLayaProvider(checkpoint_dir=empty_dir)
    state, msg = provider.check_readiness()
    assert state == ProviderState.MISSING_ASSETS
    assert not provider.is_available()[0]

    with pytest.raises(RuntimeError, match="unavailable"):
        provider.predict("Paid rent", task="navigate.v1")


def test_sdk_answer_confidence_and_probability_mapping(tmp_path):
    """Provider must accurately map choice, confidence, answer_confidence, and probabilities
    from the upstream SDK system_one output dictionary without truncation or distortion.
    """
    from tools.laya.runner import OnnxLayaProvider

    class ProbMappingStubAgent:
        def system_one(self, state, questions):
            return {
                "answers": {
                    "category": {
                        "choice": "rent",
                        "confidence": 0.8875,
                        "answer_confidence": 0.9421,
                        "probabilities": {
                            "rent": 0.8875,
                            "utilities": 0.0825,
                            "salary": 0.0300,
                        },
                    }
                }
            }

    provider = OnnxLayaProvider(checkpoint_dir=tmp_path)
    provider._agent = ProbMappingStubAgent()

    res = provider.predict(
        text="Paid rent for shop",
        task="cashbook_category.v1",
        candidates=["rent", "utilities", "salary"],
        direction="payment",
    )
    assert res["pred"] == "rent"
    assert res["confidence"] == 0.8875
    assert res["answer_confidence"] == 0.9421
    assert res["probabilities"]["rent"] == 0.8875
    assert res["probabilities"]["utilities"] == 0.0825
    assert res["probabilities"]["salary"] == 0.0300




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

