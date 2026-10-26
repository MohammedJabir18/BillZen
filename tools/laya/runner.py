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


class PythonLayaProvider(EvaluationProvider):
    """PyTorch / HuggingFace reference execution provider."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "python_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")
        self._model = None
        self._tokenizer = None

    def check_readiness(self) -> Tuple[ProviderState, str]:
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
        weights_file = self.model_dir / "model.safetensors"
        if not weights_file.is_file():
            return (
                ProviderState.MISSING_ASSETS,
                f"Missing pretrained model weights ({weights_file.name} not found in {self.model_dir})",
            )

        # 3. Dependency check
        try:
            import torch  # type: ignore # noqa: F401
            import transformers  # type: ignore # noqa: F401
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

        # Lazy load model and tokenizer
        if self._model is None or self._tokenizer is None:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            self._tokenizer = AutoTokenizer.from_pretrained(str(self.model_dir))
            self._model = AutoModelForSequenceClassification.from_pretrained(str(self.model_dir))
            self._model.eval()

        inputs = self._tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        import torch
        with torch.no_grad():
            outputs = self._model(**inputs)
            logits = outputs.logits[0].tolist()

        probs = _softmax(logits)
        if task == "navigate.v1":
            options = [opt["id"] for opt in NAVIGATE_OPTIONS]
        elif task == "cashbook_category.v1":
            options = [c["id"] if isinstance(c, dict) else str(c) for c in (candidates or [])]
        else:
            options = ["clarify"]

        best_idx = logits.index(max(logits)) if logits else 0
        if best_idx < len(options):
            pred = options[best_idx]
            conf = probs[best_idx]
        else:
            pred = "clarify"
            conf = 0.5

        return {"pred": pred, "confidence": round(conf, 4)}


class OnnxLayaProvider(EvaluationProvider):
    """ONNX Runtime execution provider."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "onnx_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")
        self._session = None
        self._is_session_ready = False
        self._tokenizer = None

    def check_readiness(self) -> Tuple[ProviderState, str]:
        if self._is_session_ready and self._session is not None:
            return ProviderState.READY, "ONNX Laya provider ready (active session)"

        onnx_file = self.model_dir / "model.onnx"
        if not onnx_file.is_file():
            return (
                ProviderState.MISSING_ASSETS,
                f"Missing exported ONNX model artifact ({onnx_file.name} not found in {self.model_dir})",
            )

        try:
            import onnxruntime  # type: ignore # noqa: F401
        except ImportError as e:
            return ProviderState.MISSING_DEPENDENCIES, f"Missing onnxruntime dependency: {e}"

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

        # Lazy load ONNX session if not injected
        if self._session is None:
            import onnxruntime as ort
            onnx_file = self.model_dir / "model.onnx"
            self._session = ort.InferenceSession(str(onnx_file), providers=["CPUExecutionProvider"])
            self._is_session_ready = True

        # Tokenization & Input feeding
        input_names = [inp.name for inp in self._session.get_inputs()]
        input_feed: Dict[str, Any] = {}

        if "input_ids" in input_names:
            # Tokenize or fallback to deterministic ascii tokens
            tokens = [min(ord(ch), 255) for ch in text[:128]] or [1]
            try:
                import numpy as np  # type: ignore
                input_feed["input_ids"] = np.array([tokens], dtype=np.int64)
                if "attention_mask" in input_names:
                    input_feed["attention_mask"] = np.ones((1, len(tokens)), dtype=np.int64)
            except ImportError:
                input_feed["input_ids"] = [tokens]
                if "attention_mask" in input_names:
                    input_feed["attention_mask"] = [[1] * len(tokens)]
        elif "text" in input_names:
            try:
                import numpy as np  # type: ignore
                input_feed["text"] = np.array([text], dtype=object)
            except ImportError:
                input_feed["text"] = [text]

        outputs = self._session.run(None, input_feed)
        raw_logits = outputs[0]
        # Flatten to 1D
        if hasattr(raw_logits, "tolist"):
            raw_logits = raw_logits.tolist()
        if isinstance(raw_logits, list) and raw_logits and isinstance(raw_logits[0], list):
            raw_logits = raw_logits[0]

        probs = _softmax([float(x) for x in raw_logits])

        if task == "navigate.v1":
            options = [opt["id"] for opt in NAVIGATE_OPTIONS]
        elif task == "cashbook_category.v1":
            options = [c["id"] if isinstance(c, dict) else str(c) for c in (candidates or [])]
        else:
            options = ["clarify"]

        best_idx = raw_logits.index(max(raw_logits)) if raw_logits else 0
        if best_idx < len(options):
            pred = options[best_idx]
            conf = probs[best_idx]
        else:
            pred = "clarify"
            conf = 0.5

        return {"pred": pred, "confidence": round(conf, 4)}


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

