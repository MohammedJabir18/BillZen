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
    """PyTorch / Laya Agent reference execution provider."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "python_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")
        self._agent = None

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
            self._agent = Agent(model_id_or_path=str(self.model_dir))

        res = self._agent.system_one(state, questions)
        ans = res.get("answers", {}).get(qid) or res.get(qid, {})

        return {
            "pred": ans.get("choice", "clarify"),
            "confidence": ans.get("confidence", 0.0),
            "answer_confidence": ans.get("answer_confidence", 0.0),
            "probabilities": ans.get("probabilities", {}),
        }


class OnnxLayaProvider(EvaluationProvider):
    """ONNX Runtime execution provider adhering to pinned Laya fused graph signature."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.name = "onnx_laya"
        self.model_dir = model_dir or (Path(__file__).resolve().parent / "assets")
        self._session = None
        self._is_session_ready = False
        self._tokenizer = None
        self._agent = None

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

        state, questions, qid = _build_typed_laya_request(text, task, candidates, direction)
        q_def = questions[qid]
        options = list(q_def["criteria"].keys())

        # 1. Prefer upstream ONNXAgent if laya package is installed and session not manually injected
        if self._session is None:
            try:
                from laya.onnx_agent import ONNXAgent
                if self._agent is None:
                    self._agent = ONNXAgent(model_path_or_dir=str(self.model_dir))
                res = self._agent.system_one(state, questions)
                ans = res.get("answers", {}).get(qid) or res.get(qid, {})
                return {
                    "pred": ans.get("choice", "clarify"),
                    "confidence": ans.get("confidence", 0.0),
                    "answer_confidence": ans.get("answer_confidence", 0.0),
                    "probabilities": ans.get("probabilities", {}),
                }
            except ImportError:
                pass

        # 2. Direct session or injected mock session execution
        if self._session is None:
            import onnxruntime as ort
            onnx_file = self.model_dir / "model.onnx"
            self._session = ort.InferenceSession(str(onnx_file), providers=["CPUExecutionProvider"])
            self._is_session_ready = True

        # Lazy load tokenizer if not already injected
        if self._tokenizer is None:
            tok_file = self.model_dir / "tokenizer" / "tokenizer.json"
            if not tok_file.is_file():
                tok_file = self.model_dir / "tokenizer.json"
            if tok_file.is_file():
                try:
                    from tokenizers import Tokenizer  # type: ignore
                    self._tokenizer = Tokenizer.from_file(str(tok_file))
                except ImportError:
                    pass

        if self._tokenizer is None:
            raise RuntimeError(
                "OnnxLayaProvider requires a loaded tokenizer to encode state and question options. "
                "ASCII ord() fallback is prohibited to preserve multilingual integrity."
            )

        # Tokenize input using tokenizer
        if hasattr(self._tokenizer, "encode"):
            enc = self._tokenizer.encode(text)
            token_ids = enc.ids if hasattr(enc, "ids") else enc
        else:
            raise RuntimeError("Tokenizer does not support encode()")

        input_names = [inp.name for inp in self._session.get_inputs()]
        input_feed: Dict[str, Any] = {}

        L = max(len(token_ids), 1)
        k = max(len(options), 2)  # pinned graph expects at least 2 marker columns

        # Prepare the 5 pinned graph inputs
        if "input_ids" in input_names:
            input_feed["input_ids"] = [token_ids]
        if "attention_mask" in input_names:
            input_feed["attention_mask"] = [[1] * L]
        if "marker_pos" in input_names:
            # Option marker positions (start of each option slot)
            input_feed["marker_pos"] = [[i for i in range(k)]]
        if "marker_mask" in input_names:
            # Boolean mask for active option slots
            mask = [True if i < len(options) else False for i in range(k)]
            input_feed["marker_mask"] = [mask]
        if "qtype" in input_names:
            # 0 for choice questions, 1 for score questions
            input_feed["qtype"] = [0]

        # If numpy is available, convert to numpy arrays matching dtypes
        try:
            import numpy as np  # type: ignore
            if "input_ids" in input_feed:
                input_feed["input_ids"] = np.array(input_feed["input_ids"], dtype=np.int64)
            if "attention_mask" in input_feed:
                input_feed["attention_mask"] = np.array(input_feed["attention_mask"], dtype=np.int64)
            if "marker_pos" in input_feed:
                input_feed["marker_pos"] = np.array(input_feed["marker_pos"], dtype=np.int64)
            if "marker_mask" in input_feed:
                input_feed["marker_mask"] = np.array(input_feed["marker_mask"], dtype=bool)
            if "qtype" in input_feed:
                input_feed["qtype"] = np.array(input_feed["qtype"], dtype=np.int64)
        except ImportError:
            pass

        outputs = self._session.run(None, input_feed)
        raw_logits = outputs[0]
        if hasattr(raw_logits, "tolist"):
            raw_logits = raw_logits.tolist()
        if isinstance(raw_logits, list) and raw_logits and isinstance(raw_logits[0], list):
            raw_logits = raw_logits[0]

        # Slice to number of actual options k_actual
        k_actual = len(options)
        logits_sliced = [float(x) for x in raw_logits[:k_actual]]
        probs = _softmax(logits_sliced)

        best_idx = logits_sliced.index(max(logits_sliced)) if logits_sliced else 0
        pred = options[best_idx] if best_idx < len(options) else "clarify"
        conf = probs[best_idx] if best_idx < len(probs) else 0.5

        prob_map = {opt: round(probs[i], 4) for i, opt in enumerate(options) if i < len(probs)}

        return {
            "pred": pred,
            "confidence": round(conf, 4),
            "answer_confidence": round(conf, 4),
            "probabilities": prob_map,
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

