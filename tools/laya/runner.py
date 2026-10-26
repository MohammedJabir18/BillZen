"""Multi-provider evaluation runner for BillZen assistant research.

Provides a unified interface across deterministic rules, PyTorch-Laya reference,
and ONNX Runtime reference providers with explicit 'not_run' reporting.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from tools.laya.evaluate_billzen import DeterministicRuleClassifier, compute_metrics


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
    def is_available(self) -> Tuple[bool, str]:
        """Check whether provider dependencies, hardware bounds, and model assets are satisfied."""
        pass

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

    def is_available(self) -> Tuple[bool, str]:
        return True, "Deterministic rules baseline ready"

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


class PythonLayaProvider(EvaluationProvider):
    """PyTorch / HuggingFace reference execution provider."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "python_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")

    def is_available(self) -> Tuple[bool, str]:
        # 1. Hardware memory safety check
        avail_mb = _get_available_memory_mb()
        min_required_mb = 4096
        if avail_mb is not None and avail_mb < min_required_mb:
            return (
                False,
                f"Insufficient available host RAM for safe unquantized PyTorch loading "
                f"(MemAvailable: {avail_mb} MiB < {min_required_mb} MiB required; "
                f"risk of swap thrashing and desktop OOM-freeze)",
            )

        # 2. Checkpoint presence check
        weights_file = self.model_dir / "model.safetensors"
        if not weights_file.is_file():
            return (
                False,
                f"Missing pretrained model weights ({weights_file.name} not found in {self.model_dir})",
            )

        # 3. Dependency check
        try:
            import torch  # type: ignore # noqa: F401
            import transformers  # type: ignore # noqa: F401
        except ImportError as e:
            return False, f"Missing Python deep learning dependencies: {e}"

        return True, "Python Laya PyTorch provider ready"

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
        raise NotImplementedError("Model execution withheld pending adequate memory allocation")


class OnnxLayaProvider(EvaluationProvider):
    """ONNX Runtime execution provider."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "onnx_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")

    def is_available(self) -> Tuple[bool, str]:
        onnx_file = self.model_dir / "model.onnx"
        if not onnx_file.is_file():
            return (
                False,
                f"Missing exported ONNX model artifact ({onnx_file.name} not found in {self.model_dir})",
            )

        try:
            import onnxruntime  # type: ignore # noqa: F401
        except ImportError as e:
            return False, f"Missing onnxruntime dependency: {e}"

        return True, "ONNX Laya provider ready"

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
        raise NotImplementedError("ONNX execution withheld pending export")


def run_multi_provider_evaluation(
    cases: List[Dict[str, Any]],
    providers: List[EvaluationProvider],
    abstention_threshold: float = 0.70,
) -> Dict[str, Any]:
    """Execute multi-provider evaluation with strict 'not_run' recording for unavailable providers.
    
    Unavailable providers are recorded with status='not_run' and metrics=None.
    Predictions from rules or mock providers are NEVER copied into model results.
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

        # Execute provider
        records: List[Dict[str, Any]] = []
        for c in cases:
            task = c["task"]
            text = c["text"]
            actual = c["expected"]
            lang = c.get("language", "en")
            direction = c.get("direction")
            candidates = c.get("candidates")

            out = provider.predict(text, task=task, candidates=candidates, direction=direction)
            pred = out.get("pred", "clarify")
            conf = out.get("confidence", 0.0)

            records.append({
                "case_id": c.get("case_id", ""),
                "task": task,
                "language": lang,
                "text": text,
                "actual": actual,
                "pred": pred,
                "confidence": conf,
            })

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
