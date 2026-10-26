"""Model-free evaluation harness and deterministic rules baseline for BillZen.

Evaluates navigation and category suggestion accuracy, macro-F1, selective precision,
selective coverage, ECE, and Brier score across languages (EN, ML, Manglish, AR).
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple


class DeterministicRuleClassifier:
    """Fast, offline, deterministic rules engine for Release A assistant tasks."""

    # Words indicating negation or hypothetical or unsupported requests
    # Use word boundary or exact token checking to avoid substring collisions (e.g. Arabic 'لا' in 'استلام')
    NEGATION_WORDS = {
        "not", "don't", "dont", "do not", "never", "wait", "shouldn't", "no need",
        "വേണ്ട", "കൊടുക്കേണ്ടതില്ല", "കൊടുക്കണ്ട", "മാറ്റിവെച്ചു", "വേണ്ടെന്ന്",
        "kodukkenda", "venda", "pinne", "matty",
        "لا تدفع", "توقف", "تأجيل", "ليس",
    }
    STANDALONE_NEGATIONS = {"لا", "no", "not"}

    HYPOTHETICAL_WORDS = {
        "if", "what if", "suppose", "assuming",
        "എങ്കിൽ", "മാറ്റാമോ",
        "engil", "aano", "maattaamo",
        "إذا", "لو", "هل يمكن",
    }

    UNSUPPORTED_WORDS = {
        "e-invoice", "tax portal", "zatca", "gst portal", "auto-reverse",
        "ഓട്ടോമാറ്റിക്", "റിവേഴ്സ് ചെയ്യുക",
        "portal", "automatic",
    }

    TRANSFER_WORDS = {
        "transferred", "transfer", "deposit", "deposited", "withdrew", "withdraw", "atm",
        "cash to bank", "bank to cash", "cash register to bank",
        "നിക്ഷേപിച്ചു", "പിൻവലിച്ചു", "ക്യാഷിൽ നിന്നും", "ബാങ്കിൽ നിന്നും",
        "bankil ninn", "cashil ninn", "bankilekku", "withdraw", "deposit",
        "تحويل", "سحب", "إيداع", "من الصندوق إلى البنك", "من البنك إلى الخزينة",
    }

    RECEIPT_WORDS = {
        "received", "receive", "collection", "inward", "from customer", "got", "paid by customer",
        "വാങ്ങി", "ലഭിച്ചു", "കിട്ടിയത്", "കളക്ഷൻ", "തന്ന", "തന്നു",
        "thannu", "labhichu", "kitiyathu", "collection", "vangy",
        "استلام", "مقبوضات", "إيراد", "تحصيل", "من العميل",
    }

    PAYMENT_WORDS = {
        "paid", "pay", "payment", "expense", "spent", "purchased",
        "കൊടുത്തു", "നൽകി", "ചെലവ്", "അടച്ചത്",
        "koduthu", "nalki", "chelavu", "adachathu",
        "دفع", "صرف", "سداد", "مصروف",
    }

    DRAFT_WORDS = {
        "draft", "invoice", "quotation", "bill",
        "ഇൻവോയ്സ്", "ഡ്രാഫ്റ്റ്", "ബില്ല്",
        "draft", "bill",
        "فاتورة", "مسودة",
    }

    STOCK_WORDS = {
        "stock", "inventory", "damaged", "reduce stock", "add stock", "pieces",
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

    # Category keywords
    CATEGORY_MAP: Dict[str, Set[str]] = {
        "rent": {"rent", "shop rent", "office rent", "കടവാടക", "വാടക", "vadaka", "إيجار", "الايجار"},
        "utilities": {
            "electricity", "water", "current", "power", "kseb", "utilities",
            "കറന്റ്", "വൈദ്യുതി", "വെള്ളം", "current bill", "كهرباء", "ماء", "فاتورة الكهرباء"
        },
        "salary": {"salary", "wage", "wages", "staff", "ശമ്പളം", "കൂലി", "വേതനം", "salary", "കൂലി", "رواتب", "أجور"},
        "maintenance": {
            "maintenance", "repair", "repairs", "painting", "റിപ്പയർ", "റിപ്പയറിങ്", "റിപ്പയറിംഗ്",
            "പെയിന്റ്", "പെയിന്റിങ്", "പെയിന്റിംഗ്", "ഷട്ടർ", "പണി", "صيانة", "تصليح"
        },
        "transport": {"transport", "freight", "delivery", "യാത്രാക്കൂലി", "വണ്ടിക്കൂലി", "നقل", "شحن"},
        "office_supplies": {"stationery", "office supplies", "print", "പേപ്പർ", "സ്റ്റേഷനറി", "قرطاسية"},
        "sales_cash": {
            "sales", "counter sales", "collection", "daily sales", "സെയിൽസ്", "വിൽപ്പന",
            "counter sales", "مبيعات", "المبيعات"
        },
        "service_income": {"service", "servicing", "repair service", "സർവീസിംഗ്", "സർവീസ്", "service charge", "خدمة", "أتعاب صيانة"},
        "scrap_sale": {"scrap", "waste", "cardboard", "ആക്രി", "പഴയ", "scrap iron", "പെട്ടി", "ബോക്സ്", "خردة", "سكراب"},
        "refund": {"refund", "return", "റീഫണ്ട്", "refund", "استرداد"},
    }

    def predict_navigate(self, text: str) -> Tuple[str, float]:
        """Predict navigation route with confidence."""
        lower = text.lower()
        tokens = set(re.findall(r"\w+", lower))

        # 1. First check standalone negations or negation phrases
        if tokens & self.STANDALONE_NEGATIONS:
            return "clarify", 0.95

        for word in self.NEGATION_WORDS:
            if word in lower:
                return "clarify", 0.95

        for word in self.HYPOTHETICAL_WORDS:
            if word in lower:
                return "clarify", 0.95

        for word in self.UNSUPPORTED_WORDS:
            if word in lower:
                return "clarify", 0.95

        # 2. Check transfer (must precede simple payment/receipt)
        for word in self.TRANSFER_WORDS:
            if word in lower:
                return "account_transfer", 0.95

        # 3. Check reports
        for word in self.REPORTS_WORDS:
            if word in lower:
                return "reports_view", 0.92

        # 4. Check inventory stock
        for word in self.STOCK_WORDS:
            if word in lower:
                return "inventory_stock", 0.92

        # 5. Check invoice draft
        for word in self.DRAFT_WORDS:
            if word in lower:
                return "invoice_draft", 0.90

        # 6. Check receipt vs payment
        for word in self.RECEIPT_WORDS:
            if word in lower:
                return "cashbook_receipt", 0.92

        for word in self.PAYMENT_WORDS:
            if word in lower:
                return "cashbook_payment", 0.92

        return "clarify", 0.50

    def predict_category(
        self, text: str, candidates: List[str]
    ) -> Tuple[str, float]:
        """Predict category among candidates with confidence."""
        lower = text.lower()
        scored_candidates: List[Tuple[str, int]] = []

        for cand in candidates:
            if cand == "none":
                continue
            keywords = self.CATEGORY_MAP.get(cand, set())
            score = 0
            for kw in keywords:
                if kw in lower:
                    score += 1
            if score > 0:
                scored_candidates.append((cand, score))

        if not scored_candidates:
            if "none" in candidates:
                return "none", 0.90
            return "clarify", 0.50

        # Pick best score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        best_cand, best_score = scored_candidates[0]
        confidence = min(0.98, 0.85 + 0.05 * best_score)
        return best_cand, confidence


def compute_metrics(
    eval_records: List[Dict[str, Any]],
    abstention_threshold: float = 0.70,
) -> Dict[str, Any]:
    """Calculate accuracy, macro-F1, selective precision, selective coverage, ECE and Brier."""
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

    # Brier score: mean of (confidence - outcome)^2
    brier_scores = [
        (r["confidence"] - (1.0 if r["pred"] == r["actual"] else 0.0)) ** 2
        for r in eval_records
    ]
    brier = sum(brier_scores) / len(brier_scores) if brier_scores else 0.0

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

    return {
        "total_cases": total,
        "raw_accuracy": round(raw_accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "selective_precision": round(selective_precision, 4),
        "selective_coverage": round(coverage, 4),
        "brier_score": round(brier, 4),
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

        if task == "navigate.v1":
            pred, conf = clf.predict_navigate(text)
        elif task == "cashbook_category.v1":
            candidates = c.get("candidates", [])
            pred, conf = clf.predict_category(text, candidates)
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
