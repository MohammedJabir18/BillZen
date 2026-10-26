"""Model-free evaluation harness and deterministic rules baseline for BillZen.

Evaluates navigation and category suggestion accuracy, macro-F1, selective precision,
selective coverage, ECE, and binary correctness Brier score across languages (EN, ML, Manglish, AR).
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple, Union


class DeterministicRuleClassifier:
    """Fast, offline, deterministic rules engine for Release A assistant tasks."""

    # Words indicating negation or hypothetical or unsupported requests
    # Strict regex word-boundary matching for short words to prevent substring collisions (e.g. 'if' in 'gift'/'shift')
    NEGATION_PHRASES = {
        "don't", "dont", "do not", "never", "wait", "shouldn't", "no need",
        "വേണ്ട", "കൊടുക്കേണ്ടതില്ല", "കൊടുക്കണ്ട", "മാറ്റിവെച്ചു", "വേണ്ടെന്ന്",
        "kodukkenda", "venda", "pinne", "matty",
        "لا تدفع", "توقف", "تأجيل", "ليس",
    }
    STANDALONE_NEGATIONS = {"no", "not", "لا"}

    HYPOTHETICAL_PHRASES = {
        "what if", "suppose", "assuming",
        "എങ്കിൽ", "മാറ്റാമോ",
        "engil", "aano", "maattaamo",
        "إذا", "لو", "هل يمكن",
    }
    # 'if' must be matched as a standalone token
    STANDALONE_HYPOTHETICALS = {"if"}

    UNSUPPORTED_WORDS = {
        "e-invoice", "tax portal", "zatca", "gst portal", "auto-reverse",
        "ഓട്ടോമാറ്റിക്", "റിവേഴ്സ് ചെയ്യുക",
        "portal", "automatic",
    }

    # Internal account transfer verbs (actual movement between internal company cash & bank accounts)
    INTERNAL_TRANSFER_PATTERNS = [
        re.compile(r"\btransferred?\b.*\b(from\s+cash\s+to\s+bank|to\s+bank\s+account|from\s+cash\s+register)\b", re.I),
        re.compile(r"\bwithdrew?\b.*\b(from\s+atm|to\s+petty\s+cash|to\s+cash\s+drawer|from\s+bank\s+to\s+cash)\b", re.I),
        re.compile(r"\b(cash\s+register\s+to\s+bank|cash\s+to\s+bank|bank\s+to\s+cash)\b", re.I),
        re.compile(r"(ക്യാഷിൽ\s*നിന്നും.*ബാങ്കിൽ|ബാങ്കിൽ\s*നിന്നും.*ക്യാഷ്|ബാങ്കിൽ\s*നിക്ഷേപിച്ചു|ക്യാഷ്\s*ഡ്രോയറിലേക്ക്\s*പിൻവലിച്ചു)"),
        re.compile(r"(cashil\s*ninn.*bankilekku|bankil\s*ninn.*cash|cash\s*withdraw\s*cheythu)"),
        re.compile(r"(تحويل.*من\s+الصندوق\s+إلى\s+الحساب\s+البنكي|سحب.*من\s+البنك\s+إلى\s+الخزينة)"),
    ]

    # Payment method indicators (specifies method of payment/receipt, NOT an account transfer)
    PAYMENT_METHOD_WORDS = {
        "by bank transfer", "via bank", "bank transfer", "netbanking", "cheque", "card",
        "ബാങ്ക് ട്രാൻസ്ഫർ വഴി", "ചെക്ക് വഴി",
        "تحويل بنكي", "تحويل مصرفي", "شيك", "بطاقة",
    }

    # Read-only search/statement queries (must route to reports_view or clarify, never payment/receipt posting)
    READ_ONLY_PREFIXES = {
        "show", "list", "view", "display", "print", "summary of",
        "കാണണം", "റിപ്പോർട്ട്", "ലിസ്റ്റ്",
        "عرض", "كشف", "طباعة",
    }

    # Invoice draft creation contexts (must be distinct from paying a bill)
    DRAFT_CREATION_PATTERNS = [
        re.compile(r"\b(new\s+invoice|create\s+(a\s+)?(new\s+)?(invoice|draft|quotation|bill)|generate\s+invoice)\b", re.I),
        re.compile(r"(പുതിയ.*ഇൻവോയ്സ്|ഇൻവോയ്സ്\s*ഡ്രാഫ്റ്റ്|പുതിയൊരു\s*ബില്ല്)"),
        re.compile(r"(puthiya\s+bill\s+draft|bill\s+draft\s+undakkanam)"),
        re.compile(r"(إنشاء\s+مسودة\s+فاتورة|فاتورة\s+مبيعات\s+جديدة)"),
    ]

    STOCK_WORDS = {
        "stock", "inventory", "damaged", "reduce stock", "add stock", "pieces", "shelf", "shift stock",
        "സ്റ്റോക്ക്", "പീസ്", "ഡാമേജ്",
        "stock", "damaged",
        "المخزون", "مخزون", "تالفة", "بضاعة",
    }

    REPORTS_WORDS = {
        "report", "reports", "statement", "summary",
        "റിപ്പോർട്ട്", "സ്റ്റേറ്റ്മെന്റ്", "റിപ്പോർട്ട", "സ്റ്റേറ്റ്മെന്റ",
        "reports", "statement",
        "تقرير", "كشف", "كشف الحساب",
    }

    RECEIPT_WORDS = {
        "received", "receive", "collection", "inward", "from customer", "got",
        "paid by customer", "customer paid", "customer gave", "gift",
        "വാങ്ങി", "ലഭിച്ചു", "കിട്ടിയത്", "കളക്ഷൻ", "തന്ന", "തന്നു", "കസ്റ്റമർ തന്ന",
        "thannu", "labhichu", "kitiyathu", "collection", "vangy",
        "استلام", "مقبوضات", "إيراد", "تحصيل", "من العميل", "دفع العميل",
    }

    PAYMENT_WORDS = {
        "paid", "pay", "payment", "expense", "spent", "purchased", "settled bill", "pay electricity", "paid supplier",
        "കൊടുത്തു", "നൽകി", "ചെലവ്", "അടച്ചത്",
        "koduthu", "nalki", "chelavu", "adachathu",
        "دفع", "صرف", "سداد", "مصروف",
    }

    # Category synonyms and keyword mapping
    CATEGORY_SYNONYMS: Dict[str, Set[str]] = {
        "rent": {"rent", "shop rent", "office rent", "കടവാടക", "വാടക", "vadaka", "إيجار", "الايجار"},
        "utilities": {
            "electricity", "water", "current", "power", "kseb", "utilities", "electric", "bill",
            "കറന്റ്", "വൈദ്യുതി", "വെള്ളം", "current bill", "كهرباء", "ماء", "فاتورة الكهرباء"
        },
        "salary": {"salary", "salaries", "wage", "wages", "staff", "ശമ്പളം", "കൂലി", "വേതനം", "salary", "കൂലി", "رواتب", "أجور"},
        "maintenance": {
            "maintenance", "repair", "repairs", "painting", "റിപ്പയർ", "റിപ്പയറിങ്", "റിപ്പയറിംഗ്",
            "പെയിന്റ്", "പെയിന്റിങ്", "പെയിന്റിംഗ്", "ഷട്ടർ", "പണി", "صيانة", "تصليح"
        },
        "transport": {"transport", "freight", "delivery", "travel", "യാത്രാക്കൂലി", "വണ്ടിക്കൂലി", "നقل", "شحن"},
        "office_supplies": {"stationery", "office supplies", "print", "paper", "പേപ്പർ", "സ്റ്റേഷനറി", "قرطاسية"},
        "sales_cash": {
            "sales", "counter sales", "collection", "daily sales", "സെയിൽസ്", "വിൽപ്പന",
            "counter sales", "مبيعات", "المبيعات"
        },
        "service_income": {"service", "servicing", "repair service", "സർവീസിംഗ്", "സർവീസ്", "service charge", "خدمة", "أتعاب صيانة"},
        "scrap_sale": {"scrap", "waste", "cardboard", "ആക്രി", "പഴയ", "scrap iron", "പെട്ടി", "ബോക്സ്", "خردة", "سكراب"},
        "refund": {"refund", "return", "റീഫണ്ട്", "refund", "استرداد"},
    }

    def predict_navigate(self, text: str) -> Tuple[str, float]:
        """Predict navigation route with calibrated heuristic confidence."""
        lower = text.lower()
        tokens = set(re.findall(r"\w+", lower))

        # 1. First check standalone negations or negation phrases
        if tokens & self.STANDALONE_NEGATIONS:
            return "clarify", 0.95

        for phrase in self.NEGATION_PHRASES:
            if phrase in lower:
                return "clarify", 0.95

        # Check hypothetical tokens (word boundary enforced)
        if tokens & self.STANDALONE_HYPOTHETICALS:
            return "clarify", 0.95

        for phrase in self.HYPOTHETICAL_PHRASES:
            if phrase in lower:
                return "clarify", 0.95

        for word in self.UNSUPPORTED_WORDS:
            if word in lower:
                return "clarify", 0.95

        # 2. Check read-only queries (e.g. "show salary payments", "view cash report")
        for ro in self.READ_ONLY_PREFIXES:
            if lower.startswith(ro) or f" {ro} " in f" {lower} ":
                return "reports_view", 0.90

        # 3. Check internal account transfers (cash <-> bank movements)
        for pattern in self.INTERNAL_TRANSFER_PATTERNS:
            if pattern.search(lower):
                return "account_transfer", 0.95

        # 4. Check reports
        for word in self.REPORTS_WORDS:
            if word in lower:
                return "reports_view", 0.92

        # 5. Check invoice draft creation (must precede simple payments)
        for pattern in self.DRAFT_CREATION_PATTERNS:
            if pattern.search(lower):
                return "invoice_draft", 0.92

        # 6. Check inventory stock
        for word in self.STOCK_WORDS:
            if word in lower:
                return "inventory_stock", 0.92

        # 7. Check receipt vs payment
        # Check if "customer paid" / "paid by customer" overrides generic "paid"
        is_customer_payment = (
            "customer paid" in lower
            or "paid by customer" in lower
            or "കസ്റ്റമർ തന്ന" in lower
            or "دفع العميل" in lower
        )
        has_receipt = any(w in lower for w in self.RECEIPT_WORDS)
        has_payment = any(w in lower for w in self.PAYMENT_WORDS)

        if is_customer_payment:
            return "cashbook_receipt", 0.92

        if has_receipt and not has_payment:
            return "cashbook_receipt", 0.92
        elif has_payment and not has_receipt:
            return "cashbook_payment", 0.92
        elif has_receipt and has_payment:
            # Conflicting receipt and payment signals in one utterance -> abstain
            return "clarify", 0.50

        # Generic draft words if nothing else matched
        if "draft" in lower or "quotation" in lower:
            return "invoice_draft", 0.85

        return "clarify", 0.50

    def predict_category(
        self,
        text: str,
        candidates: List[Union[str, Dict[str, Any]]],
        direction: Optional[str] = None,
    ) -> Tuple[str, float]:
        """Predict category among candidates with direction checking and tie-breaking.

        Supports candidates as string IDs or objects with id, label, and direction.
        Tied scores consistently abstain to 'clarify' or 'none'.
        """
        lower = text.lower()
        scored_candidates: List[Tuple[str, int]] = []

        # Normalize candidates into standard dicts
        normalized_candidates: List[Dict[str, Any]] = []
        for c in candidates:
            if isinstance(c, str):
                normalized_candidates.append({"id": c, "label": c, "direction": None})
            elif isinstance(c, dict):
                normalized_candidates.append({
                    "id": c.get("id", ""),
                    "label": c.get("label", ""),
                    "direction": c.get("direction"),
                })

        none_cand_id = "none"
        for c in normalized_candidates:
            cid = c["id"]
            label = c["label"].lower()
            cdir = c.get("direction")

            if cid.lower() in ["none", "none_of_the_above"] or "none" in label:
                none_cand_id = cid
                continue

            # Direction compatibility check
            if direction and cdir and direction.lower() != cdir.lower():
                continue

            score = 0
            # 1. Check if candidate label or words match text
            label_words = [w for w in re.findall(r"\w+", label) if len(w) > 2]
            for lw in label_words:
                if lw in lower:
                    score += 1

            # 2. Check synonyms if candidate maps to standard keys
            for std_key, synonyms in self.CATEGORY_SYNONYMS.items():
                if std_key in cid.lower() or any(lw in synonyms for lw in label_words):
                    for syn in synonyms:
                        if syn in lower:
                            score += 1

            if score > 0:
                scored_candidates.append((cid, score))

        if not scored_candidates:
            return none_cand_id, 0.90

        # Sort descending by score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        top_cand, top_score = scored_candidates[0]

        # Check for ties among top scorers
        ties = [c for c, s in scored_candidates if s == top_score]
        if len(ties) > 1:
            # Ambiguous tie: multiple candidate categories match equally -> abstain
            return "clarify", 0.50

        confidence = min(0.98, 0.85 + 0.05 * top_score)
        return top_cand, confidence


def compute_metrics(
    eval_records: List[Dict[str, Any]],
    abstention_threshold: float = 0.70,
) -> Dict[str, Any]:
    """Calculate accuracy, macro-F1, selective precision, selective coverage, ECE and binary correctness Brier."""
    if not eval_records:
        return {}

    total = len(eval_records)
    accepted_records = [r for r in eval_records if r["confidence"] >= abstention_threshold]
    coverage = len(accepted_records) / total if total > 0 else 0.0

    accepted_correct = sum(1 for r in accepted_records if r["pred"] == r["actual"])
    selective_precision = (
        accepted_correct / len(accepted_records) if accepted_records else 0.0
    )

    all_correct = sum(1 for r in eval_records if r["pred"] == r["actual"])
    raw_accuracy = all_correct / total if total > 0 else 0.0

    # Macro-F1 calculation
    labels: Set[str] = {r["actual"] for r in eval_records} | {r["pred"] for r in eval_records}
    f1_list: List[float] = []
    confusion: Dict[str, Dict[str, int]] = {lbl: {o: 0 for o in labels} for lbl in labels}

    for r in eval_records:
        confusion[r["actual"]][r["pred"]] += 1

    for lbl in labels:
        tp = confusion[lbl][lbl]
        fp = sum(confusion[o][lbl] for o in labels if o != lbl)
        fn = sum(confusion[lbl][o] for o in labels if o != lbl)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        f1_list.append(f1)

    macro_f1 = sum(f1_list) / len(f1_list) if f1_list else 0.0

    # Binary correctness Brier score: mean of (confidence - outcome)^2
    # Note: This measures binary correctness calibration of the top-1 heuristic confidence, not multiclass distribution
    binary_brier_scores = [
        (r["confidence"] - (1.0 if r["pred"] == r["actual"] else 0.0)) ** 2
        for r in eval_records
    ]
    binary_brier = sum(binary_brier_scores) / len(binary_brier_scores) if binary_brier_scores else 0.0

    # Expected Calibration Error (ECE) with 10 bins
    num_bins = 10
    ece = 0.0
    for b in range(num_bins):
        low = b / num_bins
        high = (b + 1) / num_bins
        bin_items = [
            r for r in eval_records
            if low <= r["confidence"] < high or (b == num_bins - 1 and r["confidence"] == high)
        ]
        if bin_items:
            bin_acc = sum(1 for r in bin_items if r["pred"] == r["actual"]) / len(bin_items)
            bin_conf = sum(r["confidence"] for r in bin_items) / len(bin_items)
            ece += (len(bin_items) / total) * abs(bin_acc - bin_conf)

    # Actionable suggestions (excluding clarify and none)
    actionable_accepted = [
        r for r in accepted_records if r["pred"] not in ["clarify", "none", "none_of_the_above"]
    ]
    actionable_coverage = len(actionable_accepted) / total if total > 0 else 0.0

    return {
        "total_cases": total,
        "raw_accuracy": round(raw_accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "selective_precision": round(selective_precision, 4),
        "selective_coverage": round(coverage, 4),
        "actionable_coverage": round(actionable_coverage, 4),
        "binary_correctness_brier": round(binary_brier, 4),
        "brier_score": round(binary_brier, 4),
        "expected_calibration_error": round(ece, 4),
        "confusion_matrix": confusion,
    }


def run_benchmark(
    cases: List[Dict[str, Any]],
    abstention_threshold: float = 0.70,
) -> Dict[str, Any]:
    """Run deterministic benchmark across task and language slices."""
    clf = DeterministicRuleClassifier()
    records: List[Dict[str, Any]] = []

    for c in cases:
        task = c["task"]
        text = c["text"]
        actual = c["expected"]
        lang = c.get("language", "en")
        direction = c.get("direction")

        if task == "navigate.v1":
            pred, conf = clf.predict_navigate(text)
        elif task == "cashbook_category.v1":
            candidates = c.get("candidates", [])
            pred, conf = clf.predict_category(text, candidates, direction=direction)
        else:
            continue

        records.append({
            "case_id": c["case_id"],
            "task": task,
            "language": lang,
            "text": text,
            "actual": actual,
            "pred": pred,
            "confidence": conf,
        })

    # Overall metrics
    overall = compute_metrics(records, abstention_threshold)

    # Per-task metrics
    by_task: Dict[str, Any] = {}
    for task_name in ["navigate.v1", "cashbook_category.v1"]:
        task_recs = [r for r in records if r["task"] == task_name]
        by_task[task_name] = compute_metrics(task_recs, abstention_threshold)

    # Per-language metrics
    by_lang: Dict[str, Any] = {}
    for lang_code in ["en", "ml", "manglish", "ar"]:
        lang_recs = [r for r in records if r["language"] == lang_code]
        by_lang[lang_code] = compute_metrics(lang_recs, abstention_threshold)

    return {
        "overall": overall,
        "by_task": by_task,
        "by_language": by_lang,
        "records": records,
    }
