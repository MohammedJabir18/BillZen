"""Multi-provider evaluation runner for BillZen assistant research.

Provides a unified interface across deterministic rules, PyTorch-Laya reference,
and ONNX Runtime reference providers with explicit 'not_run' reporting.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from tools.laya.evaluate_billzen import DeterministicRuleClassifier, compute_metrics
from tools.laya.prepare_dataset import NAVIGATE_OPTIONS


class ProviderState(str, Enum):
    """Structured lifecycle readiness states for evaluation providers."""
    READY = "ready"
    MISSING_ASSETS = "missing_assets"
    MISSING_DEPENDENCIES = "missing_dependencies"
    INSUFFICIENT_RESOURCES = "insufficient_resources"
    NOT_IMPLEMENTED = "provider_not_implemented"
    FAILED = "execution_failed"


def _softmax(logits: List[float]) -> List[float]:
    """Numerically stable softmax for logits."""
    if not logits:
        return []
    max_l = max(logits)
    exps = [math.exp(x - max_l) for x in logits]
    sum_e = sum(exps)
    if sum_e == 0:
        return [1.0 / len(logits)] * len(logits)
    return [e / sum_e for e in exps]


def _get_available_memory_mb() -> Optional[int]:
    """Read available memory in MiB from Linux /proc/meminfo if available."""
    meminfo = Path("/proc/meminfo")
    if not meminfo.is_file():
        return None
    try:
        with meminfo.open("r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    parts = line.split()
                    return int(parts[1]) // 1024
    except Exception:
        return None
    return None


class EvaluationProvider(ABC):
    """Abstract base provider for BillZen assistant evaluation."""

    name: str = "base_provider"

    @abstractmethod
    def check_readiness(self) -> Tuple[ProviderState, str]:
        """Check whether provider dependencies, hardware bounds, and model assets are satisfied."""
        pass

    def is_available(self) -> Tuple[bool, str]:
        """Convenience method returning True if state is READY."""
        state, msg = self.check_readiness()
        return (state == ProviderState.READY), msg

    @abstractmethod
    def predict(
        self,
        text: str,
        task: str,
        candidates: Optional[List[Any]] = None,
        direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate prediction and confidence score."""
        pass


class RulesProvider(EvaluationProvider):
    """Deterministic, offline rule-based classification baseline."""

    def __init__(self) -> None:
        self.name = "rules"
        self._clf = DeterministicRuleClassifier()

    def check_readiness(self) -> Tuple[ProviderState, str]:
        return ProviderState.READY, "Deterministic rules baseline ready"

    def predict(
        self,
        text: str,
        task: str,
        candidates: Optional[List[Any]] = None,
        direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        if task == "navigate.v1":
            pred, conf = self._clf.predict_navigate(text)
        elif task == "cashbook_category.v1":
            pred, conf = self._clf.predict_category(text, candidates or [], direction=direction)
        else:
            pred, conf = "clarify", 0.0
        return {"pred": pred, "confidence": conf}


def _build_typed_laya_request(
    text: str,
    task: str,
    candidates: Optional[List[Any]] = None,
    direction: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Any]], str]:
    """Construct upstream {state, questions} schema matching export_case_to_laya_finetune_format."""
    from tools.laya.prepare_dataset import export_case_to_laya_finetune_format
    raw_case = {
        "text": text,
        "task": task,
        "language": "en",
    }
    if task == "navigate.v1":
        raw_case["expected"] = "cashbook_payment"  # placeholder for exporter validation
    elif task == "cashbook_category.v1":
        raw_case["direction"] = direction or "payment"
        raw_case["candidates"] = candidates or []
        if candidates:
            first = candidates[0]
            raw_case["expected"] = first.get("id") if isinstance(first, dict) else str(first)
        else:
            raw_case["expected"] = "none"
            raw_case["candidates"] = ["none"]
    else:
        raise ValueError(f"Unsupported task: '{task}'")

    exported = export_case_to_laya_finetune_format(raw_case)
    qid = "navigate" if task == "navigate.v1" else "category"
    return exported["state"], exported["questions"], qid


class PythonLayaProvider(EvaluationProvider):
    """PyTorch / Laya Agent reference execution provider wrapping pinned upstream Laya Agent."""

    def __init__(
        self,
        checkpoint_dir: Optional[Union[Path, str]] = None,
        model_dir: Optional[Union[Path, str]] = None,
    ) -> None:
        self.name = "python_laya"
        c_dir = checkpoint_dir or model_dir or (Path(__file__).resolve().parent / "assets")
        self.checkpoint_dir = Path(c_dir)
        self.model_dir = self.checkpoint_dir
        self._agent = None

    def check_readiness(self) -> Tuple[ProviderState, str]:
        if self._agent is not None:
            return ProviderState.READY, "Python Laya provider ready (active agent)"

        # 1. Hardware memory safety check (safe unquantized load requires >= 4096 MiB)
        avail_mb = _get_available_memory_mb()
        min_required_mb = 4096
        if avail_mb is not None and avail_mb < min_required_mb:
            return (
                ProviderState.INSUFFICIENT_RESOURCES,
                f"Insufficient available host RAM for safe unquantized PyTorch loading "
                f"(MemAvailable: {avail_mb} MiB < {min_required_mb} MiB required; "
                f"risk of swap thrashing and desktop OOM-freeze)",
            )

        # 2. Checkpoint presence check
        weights_file = self.checkpoint_dir / "model.safetensors"
        if not weights_file.is_file():
            return (
                ProviderState.MISSING_ASSETS,
                f"Missing pretrained model weights ({weights_file.name} not found in {self.checkpoint_dir})",
            )

        # 3. Upstream Laya package check
        try:
            import torch  # type: ignore # noqa: F401
            import transformers  # type: ignore # noqa: F401
            import laya.agent  # type: ignore # noqa: F401
        except ImportError as e:
            return ProviderState.MISSING_DEPENDENCIES, f"Missing Python deep learning dependencies: {e}"

        return ProviderState.READY, "Python Laya PyTorch provider ready"

    def predict(
        self,
        text: str,
        task: str,
        candidates: Optional[List[Any]] = None,
        direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        ok, msg = self.is_available()
        if not ok:
            raise RuntimeError(f"PythonLayaProvider unavailable: {msg}")

        state, questions, qid = _build_typed_laya_request(text, task, candidates, direction)

        if self._agent is None:
            from laya.agent import Agent
            self._agent = Agent(model_id_or_path=str(self.checkpoint_dir))

        res = self._agent.system_one(state, questions)
        ans = res.get("answers", {}).get(qid) or res.get(qid, {})

        return {
            "pred": ans.get("choice", "clarify"),
            "confidence": float(ans.get("confidence", 0.0)),
            "answer_confidence": float(ans.get("answer_confidence", 0.0)),
            "probabilities": ans.get("probabilities", {}),
        }


class OnnxLayaProvider(EvaluationProvider):
    """ONNX Runtime execution provider wrapping pinned upstream Laya ONNXAgent."""

    def __init__(
        self,
        checkpoint_dir: Optional[Union[Path, str]] = None,
        onnx_path: Optional[Union[Path, str]] = None,
        model_dir: Optional[Union[Path, str]] = None,
    ) -> None:
        self.name = "onnx_laya"
        c_dir = checkpoint_dir or model_dir or (Path(__file__).resolve().parent / "assets")
        self.checkpoint_dir = Path(c_dir)
        self.model_dir = self.checkpoint_dir
        if onnx_path is not None:
            self.onnx_path = Path(onnx_path)
        else:
            if (self.checkpoint_dir / "model.onnx").is_file():
                self.onnx_path = self.checkpoint_dir / "model.onnx"
            else:
                self.onnx_path = self.checkpoint_dir / "laya.onnx"
        self._agent = None

    def check_readiness(self) -> Tuple[ProviderState, str]:
        if self._agent is not None:
            return ProviderState.READY, "ONNX Laya provider ready (active agent)"

        if not self.onnx_path.is_file():
            return (
                ProviderState.MISSING_ASSETS,
                f"Missing exported ONNX model artifact ({self.onnx_path.name} not found at {self.onnx_path})",
            )

        if not self.checkpoint_dir.is_dir():
            return (
                ProviderState.MISSING_ASSETS,
                f"Missing model checkpoint directory ({self.checkpoint_dir})",
            )

        try:
            import onnxruntime  # type: ignore # noqa: F401
            import laya.onnx_agent  # type: ignore # noqa: F401
        except ImportError as e:
            return ProviderState.MISSING_DEPENDENCIES, f"Missing ONNX Laya dependencies: {e}"

        return ProviderState.READY, "ONNX Laya provider ready"

    def predict(
        self,
        text: str,
        task: str,
        candidates: Optional[List[Any]] = None,
        direction: Optional[str] = None,
    ) -> Dict[str, Any]:
        ok, msg = self.is_available()
        if not ok:
            raise RuntimeError(f"OnnxLayaProvider unavailable: {msg}")

        state, questions, qid = _build_typed_laya_request(text, task, candidates, direction)

        if self._agent is None:
            from laya.onnx_agent import ONNXAgent
            self._agent = ONNXAgent(model_id_or_path=str(self.checkpoint_dir), onnx_path=str(self.onnx_path))

        res = self._agent.system_one(state, questions)
        ans = res.get("answers", {}).get(qid) or res.get(qid, {})

        return {
            "pred": ans.get("choice", "clarify"),
            "confidence": float(ans.get("confidence", 0.0)),
            "answer_confidence": float(ans.get("answer_confidence", 0.0)),
            "probabilities": ans.get("probabilities", {}),
        }


def run_multi_provider_evaluation(
    cases: List[Dict[str, Any]],
    providers: List[EvaluationProvider],
    abstention_threshold: float = 0.70,
) -> Dict[str, Any]:
    """Execute multi-provider evaluation with strict 'not_run' recording for unavailable providers.
    
    Unavailable providers are recorded with status='not_run' and metrics=None.
    Predictions from rules or mock providers are NEVER copied into model results.
    Runtime execution crashes in a provider are isolated and recorded as status='failed'.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    results: Dict[str, Any] = {}

    for provider in providers:
        p_name = provider.name
        is_ready, reason = provider.is_available()

        if not is_ready:
            results[p_name] = {
                "provider": p_name,
                "status": "not_run",
                "reason": reason,
                "metrics": None,
                "records": [],
            }
            continue

        # Execute provider with failure containment
        records: List[Dict[str, Any]] = []
        execution_failed = False
        error_msg = ""

        for c in cases:
            task = c["task"]
            text = c["text"]
            actual = c["expected"]
            lang = c.get("language", "en")
            direction = c.get("direction")
            candidates = c.get("candidates")

            try:
                out = provider.predict(text, task=task, candidates=candidates, direction=direction)
                pred = out.get("pred", "clarify")
                conf = out.get("confidence", 0.0)
            except Exception as e:
                execution_failed = True
                error_msg = f"Provider execution failed on case '{c.get('case_id')}': {e}"
                break

            records.append({
                "case_id": c.get("case_id", ""),
                "task": task,
                "language": lang,
                "text": text,
                "actual": actual,
                "pred": pred,
                "confidence": conf,
            })

        if execution_failed:
            results[p_name] = {
                "provider": p_name,
                "status": "failed",
                "reason": reason,
                "error": error_msg,
                "metrics": None,
                "records": records,
            }
        else:
            metrics = compute_metrics(records, abstention_threshold=abstention_threshold)
            results[p_name] = {
                "provider": p_name,
                "status": "completed",
                "reason": reason,
                "metrics": metrics,
                "records": records,
            }

    return {
        "timestamp": timestamp,
        "total_cases": len(cases),
        "abstention_threshold": abstention_threshold,
        "results": results,
    }

