"""Synthetic dataset preparation and validation for BillZen assistant tasks.

Produces strictly grouped partitions (train/dev/calibration/test: 65/15/10/10)
for navigate.v1 and cashbook_category.v1 with zero leakage of case families across splits.
"""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


SUPPORTED_TASKS = ["navigate.v1", "cashbook_category.v1"]
SUPPORTED_LANGUAGES = ["en", "ml", "manglish", "ar"]
FORBIDDEN_TOKENS = ["password", "secret", "bearer", "ghp_", "sk-", "private_key", "aadhaar", "pan:"]

NAVIGATE_OPTIONS = [
    {"id": "cashbook_receipt", "label": "Cashbook Receipt (Money In)"},
    {"id": "cashbook_payment", "label": "Cashbook Payment (Money Out)"},
    {"id": "account_transfer", "label": "Account Transfer (Cash <-> Bank)"},
    {"id": "invoice_draft", "label": "New Invoice Draft"},
    {"id": "inventory_stock", "label": "Stock Adjustment"},
    {"id": "reports_view", "label": "Financial Reports"},
    {"id": "clarify", "label": "Clarification / Ambiguous"},
]


def validate_dataset_case(case_dict: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate runtime schema, tasks, directions, candidates, and privacy invariants."""
    errors: List[str] = []

    required_fields = ["case_id", "group_id", "task", "language", "text", "expected"]
    for req in required_fields:
        if req not in case_dict:
            errors.append(f"Missing required field '{req}'")
        else:
            val = case_dict[req]
            if not isinstance(val, str) or not val.strip():
                errors.append(f"Field '{req}' must be a non-empty string, got {type(val).__name__}: {val}")

    if errors:
        return False, errors

    task = case_dict["task"]
    if task not in SUPPORTED_TASKS:
        errors.append(f"Unsupported task: '{task}'")

    lang = case_dict["language"]
    if lang not in SUPPORTED_LANGUAGES:
        errors.append(f"Unsupported language: '{lang}'")

    text = case_dict["text"].lower()
    for forb in FORBIDDEN_TOKENS:
        if forb in text:
            errors.append(f"Forbidden sensitive token '{forb}' detected in text")

    valid_nav_ids = {opt["id"] for opt in NAVIGATE_OPTIONS}
    if task == "navigate.v1":
        if case_dict["expected"] not in valid_nav_ids:
            errors.append(
                f"Invalid navigate expected target '{case_dict['expected']}'; must be one of {sorted(valid_nav_ids)}"
            )

    elif task == "cashbook_category.v1":
        direction = case_dict.get("direction")
        if direction not in ["payment", "receipt"]:
            errors.append(f"Invalid category direction: '{direction}'")

        candidates = case_dict.get("candidates")
        if not isinstance(candidates, list) or len(candidates) == 0:
            errors.append("candidates must be a non-empty list")
        else:
            cand_ids: List[str] = []
            seen_cand_ids: Set[str] = set()
            for c_idx, c in enumerate(candidates):
                if isinstance(c, dict):
                    cid = c.get("id")
                    if not isinstance(cid, str) or not cid.strip():
                        errors.append(f"Candidate at index {c_idx} missing valid string 'id'")
                        continue
                elif isinstance(c, str):
                    cid = c.strip()
                    if not cid:
                        errors.append(f"Candidate at index {c_idx} cannot be an empty string")
                        continue
                else:
                    errors.append(f"Candidate at index {c_idx} has invalid type: {type(c).__name__}")
                    continue

                if cid in seen_cand_ids:
                    errors.append(f"Duplicate candidate ID '{cid}' in candidates list")
                seen_cand_ids.add(cid)
                cand_ids.append(cid)

            if case_dict["expected"] not in cand_ids:
                errors.append(
                    f"Expected target '{case_dict['expected']}' not in candidate IDs: {cand_ids}"
                )

    return (len(errors) == 0), errors


def export_case_to_laya_format(case_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Convert internal dataset case to clean standard instruction format without fixture metadata."""
    task = case_dict.get("task", "")
    text = case_dict.get("text", "")
    expected = case_dict.get("expected", "")

    if task == "navigate.v1":
        instruction = (
            "Classify the user intent into one of the BillZen navigation actions: "
            "cashbook_payment, cashbook_receipt, account_transfer, invoice_draft, "
            "inventory_stock, reports_view, clarify."
        )
    elif task == "cashbook_category.v1":
        candidates = case_dict.get("candidates", [])
        cand_str = ", ".join(c["id"] if isinstance(c, dict) else str(c) for c in candidates)
        instruction = (
            f"Select the most appropriate {case_dict.get('direction', 'transaction')} "
            f"category from the following options: {cand_str}."
        )
    else:
        instruction = "Process the following business input for BillZen."

    return {
        "instruction": instruction,
        "input": text,
        "output": expected,
    }



# Development and regression fixture cases (original 59 cases, preserved with explicit group_id)
RAW_CASES: List[Dict[str, Any]] = [
    # --- NAVIGATE.V1: English ---
    {
        "case_id": "nav_en_01",
        "group_id": "grp_nav_en_01",
        "task": "navigate.v1",
        "language": "en",
        "text": "Record payment of 1200 for office supplies",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_en_02",
        "group_id": "grp_nav_en_02",
        "task": "navigate.v1",
        "language": "en",
        "text": "Received 5000 cash from customer for repair work",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_en_03",
        "group_id": "grp_nav_en_03",
        "task": "navigate.v1",
        "language": "en",
        "text": "Transferred 10000 from cash register to bank account",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_en_04",
        "group_id": "grp_nav_en_04",
        "task": "navigate.v1",
        "language": "en",
        "text": "Create a new quotation / bill draft for customer John",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_en_05",
        "group_id": "grp_nav_en_05",
        "task": "navigate.v1",
        "language": "en",
        "text": "Counted physical inventory and need to reduce damaged stock",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_en_06",
        "group_id": "grp_nav_en_06",
        "task": "navigate.v1",
        "language": "en",
        "text": "Show me monthly sales summary and cash statement",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_en_07",
        "group_id": "grp_nav_en_07",
        "task": "navigate.v1",
        "language": "en",
        "text": "Do not pay the rent this month, owner said wait",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_en_08",
        "group_id": "grp_nav_en_08",
        "task": "navigate.v1",
        "language": "en",
        "text": "What if the customer wants a 50% discount next week?",
        "expected": "clarify",
        "tags": ["hypothetical"],
    },
    {
        "case_id": "nav_en_09",
        "group_id": "grp_nav_en_09",
        "task": "navigate.v1",
        "language": "en",
        "text": "Automatically submit e-invoice to government tax portal",
        "expected": "clarify",
        "tags": ["unsupported_b2_tax"],
    },
    {
        "case_id": "nav_en_10",
        "group_id": "grp_nav_en_10",
        "task": "navigate.v1",
        "language": "en",
        "text": "Withdrew 2000 from ATM to petty cash box",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- NAVIGATE.V1: Malayalam Script ---
    {
        "case_id": "nav_ml_01",
        "group_id": "grp_nav_ml_01",
        "task": "navigate.v1",
        "language": "ml",
        "text": "കടവാടക 15000 രൂപ കൊടുത്തു",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_ml_02",
        "group_id": "grp_nav_ml_02",
        "task": "navigate.v1",
        "language": "ml",
        "text": "കസ്റ്റമർ തന്ന 3500 രൂപ ക്യാഷ് വാങ്ങി",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_ml_03",
        "group_id": "grp_nav_ml_03",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ക്യാഷിൽ നിന്നും 25000 ബാങ്കിൽ നിക്ഷേപിച്ചു",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_ml_04",
        "group_id": "grp_nav_ml_04",
        "task": "navigate.v1",
        "language": "ml",
        "text": "പുതിയൊരു ഇൻവോയ്സ് ഡ്രാഫ്റ്റ് ഉണ്ടാക്കണം",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_ml_05",
        "group_id": "grp_nav_ml_05",
        "task": "navigate.v1",
        "language": "ml",
        "text": "സ്റ്റോക്കിൽ പുതിയ 50 പീസ് ആഡ് ചെയ്യണം",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_ml_06",
        "group_id": "grp_nav_ml_06",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ഈ മാസത്തെ സ്റ്റേറ്റ്മെന്റും റിപ്പോർട്ടും കാണണം",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_ml_07",
        "group_id": "grp_nav_ml_07",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ഇന്ന് കടവാടക കൊടുക്കേണ്ടതില്ലെന്ന് മുതലാളി പറഞ്ഞു",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_ml_08",
        "group_id": "grp_nav_ml_08",
        "task": "navigate.v1",
        "language": "ml",
        "text": "അടുത്ത മാസം പണം തന്നാൽ ബില്ല് മാറ്റാമോ?",
        "expected": "clarify",
        "tags": ["hypothetical"],
    },
    {
        "case_id": "nav_ml_09",
        "group_id": "grp_nav_ml_09",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ബാങ്കിൽ നിന്നും 5000 രൂപ ക്യാഷ് ഡ്രോയറിലേക്ക് പിൻവലിച്ചു",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },
    {
        "case_id": "nav_ml_10",
        "group_id": "grp_nav_ml_10",
        "task": "navigate.v1",
        "language": "ml",
        "text": "എല്ലാ ഇടപാടുകളും ഓട്ടോമാറ്റിക് ആയി റിവേഴ്സ് ചെയ്യുക",
        "expected": "clarify",
        "tags": ["unsupported_action"],
    },

    # --- NAVIGATE.V1: Manglish (Malayalam in Latin script) ---
    {
        "case_id": "nav_mgl_01",
        "group_id": "grp_nav_mgl_01",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Kada vadaka 12000 koduthu",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_mgl_02",
        "group_id": "grp_nav_mgl_02",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Kollam customer cash 4000 thannu",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_mgl_03",
        "group_id": "grp_nav_mgl_03",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Cashil ninn bankilekku 5000 ittu",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_mgl_04",
        "group_id": "grp_nav_mgl_04",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Puthiya bill draft undakkanam",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_mgl_05",
        "group_id": "grp_nav_mgl_05",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Damaged aaya 5 item stock kurakkanam",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_mgl_06",
        "group_id": "grp_nav_mgl_06",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Ee masathe full reports edukkanam",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_mgl_07",
        "group_id": "grp_nav_mgl_07",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Innu vadaka kodukkanda, pinne kodukkam",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_mgl_08",
        "group_id": "grp_nav_mgl_08",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Bankil ninn 3000 cash withdraw cheythu",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- NAVIGATE.V1: Arabic ---
    {
        "case_id": "nav_ar_01",
        "group_id": "grp_nav_ar_01",
        "task": "navigate.v1",
        "language": "ar",
        "text": "دفع إيجار المحل 3000 ريال",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_ar_02",
        "group_id": "grp_nav_ar_02",
        "task": "navigate.v1",
        "language": "ar",
        "text": "استلام دفعة نقدية من العميل 1500 درهم",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_ar_03",
        "group_id": "grp_nav_ar_03",
        "task": "navigate.v1",
        "language": "ar",
        "text": "تحويل 5000 من الصندوق إلى الحساب البنكي",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_ar_04",
        "group_id": "grp_nav_ar_04",
        "task": "navigate.v1",
        "language": "ar",
        "text": "إنشاء مسودة فاتورة مبيعات جديدة",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_ar_05",
        "group_id": "grp_nav_ar_05",
        "task": "navigate.v1",
        "language": "ar",
        "text": "تعديل رصيد المخزون للبضاعة التالفة",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_ar_06",
        "group_id": "grp_nav_ar_06",
        "task": "navigate.v1",
        "language": "ar",
        "text": "عرض كشف الحساب والتقارير المالية الشهرية",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_ar_07",
        "group_id": "grp_nav_ar_07",
        "task": "navigate.v1",
        "language": "ar",
        "text": "لا تدفع الإيجار اليوم بناء على طلب المالك",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_ar_08",
        "group_id": "grp_nav_ar_08",
        "task": "navigate.v1",
        "language": "ar",
        "text": "سحب 2000 من البنك إلى الخزينة",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- CASHBOOK_CATEGORY.V1: Payment Direction ---
    {
        "case_id": "cat_pay_01",
        "group_id": "grp_cat_pay_01",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Paid monthly shop rent for October",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "rent",
        "tags": ["category_rent"],
    },
    {
        "case_id": "cat_pay_02",
        "group_id": "grp_cat_pay_02",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Electricity bill and water supply charges",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "utilities",
        "tags": ["category_utilities"],
    },
    {
        "case_id": "cat_pay_03",
        "group_id": "grp_cat_pay_03",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Staff monthly advance salary payment",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "salary",
        "tags": ["category_salary"],
    },
    {
        "case_id": "cat_pay_04",
        "group_id": "grp_cat_pay_04",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Purchased specialized medical equipment",
        "candidates": ["rent", "utilities", "salary", "transport", "none"],
        "expected": "none",
        "tags": ["no_matching_candidate"],
    },
    {
        "case_id": "cat_pay_05",
        "group_id": "grp_cat_pay_05",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ml",
        "text": "ഈ മാസത്തെ കടവാടക കൊടുത്തു",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "rent",
        "tags": ["category_rent"],
    },
    {
        "case_id": "cat_pay_06",
        "group_id": "grp_cat_pay_06",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ml",
        "text": "കെ.എസ്.ഇ.ബി കറന്റ് ബില്ല് അടച്ചത്",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "utilities",
        "tags": ["category_utilities"],
    },
    {
        "case_id": "cat_pay_07",
        "group_id": "grp_cat_pay_07",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ml",
        "text": "ഹെൽപ്പർമാർക്ക് ആഴ്ച ശമ്പളം നൽകി",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "salary",
        "tags": ["category_salary"],
    },
    {
        "case_id": "cat_pay_08",
        "group_id": "grp_cat_pay_08",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ml",
        "text": "ഷട്ടർ റിപ്പയറിംഗും പെയിന്റിംഗും",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "maintenance",
        "tags": ["category_maintenance"],
    },
    {
        "case_id": "cat_pay_09",
        "group_id": "grp_cat_pay_09",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "manglish",
        "text": "Staffinu weekly salary koduthu",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "salary",
        "tags": ["category_salary"],
    },
    {
        "case_id": "cat_pay_10",
        "group_id": "grp_cat_pay_10",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "manglish",
        "text": "Current bill electricity charge",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "utilities",
        "tags": ["category_utilities"],
    },
    {
        "case_id": "cat_pay_11",
        "group_id": "grp_cat_pay_11",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ar",
        "text": "دفع فاتورة الكهرباء والماء الشهرية",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "utilities",
        "tags": ["category_utilities"],
    },
    {
        "case_id": "cat_pay_12",
        "group_id": "grp_cat_pay_12",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ar",
        "text": "رواتب العمال عن شهر أكتوبر",
        "candidates": ["rent", "utilities", "salary", "maintenance", "transport", "none"],
        "expected": "salary",
        "tags": ["category_salary"],
    },

    # --- CASHBOOK_CATEGORY.V1: Receipt Direction ---
    {
        "case_id": "cat_rec_01",
        "group_id": "grp_cat_rec_01",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "en",
        "text": "Daily retail counter sales cash collection",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "sales_cash",
        "tags": ["category_sales"],
    },
    {
        "case_id": "cat_rec_02",
        "group_id": "grp_cat_rec_02",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "en",
        "text": "Customer paid for mobile repair service charges",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "service_income",
        "tags": ["category_service"],
    },
    {
        "case_id": "cat_rec_03",
        "group_id": "grp_cat_rec_03",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "en",
        "text": "Sold waste cardboard boxes and scrap iron",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "scrap_sale",
        "tags": ["category_scrap"],
    },
    {
        "case_id": "cat_rec_04",
        "group_id": "grp_cat_rec_04",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "en",
        "text": "Received unexpected grant from foreign charity",
        "candidates": ["sales_cash", "service_income", "refund", "none"],
        "expected": "none",
        "tags": ["no_matching_candidate"],
    },
    {
        "case_id": "cat_rec_05",
        "group_id": "grp_cat_rec_05",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ml",
        "text": "ഇന്നത്തെ കൗണ്ടർ സെയിൽസ് കളക്ഷൻ",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "sales_cash",
        "tags": ["category_sales"],
    },
    {
        "case_id": "cat_rec_06",
        "group_id": "grp_cat_rec_06",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ml",
        "text": "കമ്പ്യൂട്ടർ സർവീസിംഗ് ചാർജ്ജ് കിട്ടിയത്",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "service_income",
        "tags": ["category_service"],
    },
    {
        "case_id": "cat_rec_07",
        "group_id": "grp_cat_rec_07",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ml",
        "text": "പഴയ കാർഡ്ബോർഡ് പെട്ടികൾ വിറ്റ കാശ്",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "scrap_sale",
        "tags": ["category_scrap"],
    },
    {
        "case_id": "cat_rec_08",
        "group_id": "grp_cat_rec_08",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "manglish",
        "text": "Innathe counter sales collection",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "sales_cash",
        "tags": ["category_sales"],
    },
    {
        "case_id": "cat_rec_09",
        "group_id": "grp_cat_rec_09",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "manglish",
        "text": "Laptop service charge labhichathu",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "service_income",
        "tags": ["category_service"],
    },
    {
        "case_id": "cat_rec_10",
        "group_id": "grp_cat_rec_10",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ar",
        "text": "إيرادات المبيعات النقدية اليومية من الصندوق",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "sales_cash",
        "tags": ["category_sales"],
    },
    {
        "case_id": "cat_rec_11",
        "group_id": "grp_cat_rec_11",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ar",
        "text": "أتعاب صيانة وخدمات فنية مدفوعة",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "service_income",
        "tags": ["category_service"],
    },
]

# Fresh, independently authored blind holdout corpus (Review Finding R2)
# Covers both tasks and all 4 languages (EN, ML, Manglish, AR) with zero overlap with RAW_CASES
FRESH_HOLDOUT_CASES: List[Dict[str, Any]] = [
    # Navigation: English
    {
        "case_id": "hld_nav_en_01",
        "group_id": "grp_hld_nav_en_01",
        "task": "navigate.v1",
        "language": "en",
        "text": "Pay office electricity bill",
        "expected": "cashbook_payment",
    },
    {
        "case_id": "hld_nav_en_02",
        "group_id": "grp_hld_nav_en_02",
        "task": "navigate.v1",
        "language": "en",
        "text": "Customer paid invoice via bank transfer",
        "expected": "cashbook_receipt",
    },
    {
        "case_id": "hld_nav_en_03",
        "group_id": "grp_hld_nav_en_03",
        "task": "navigate.v1",
        "language": "en",
        "text": "Deposited shop cash into SBI bank account",
        "expected": "account_transfer",
    },
    {
        "case_id": "hld_nav_en_04",
        "group_id": "grp_hld_nav_en_04",
        "task": "navigate.v1",
        "language": "en",
        "text": "Print annual profit and loss report",
        "expected": "reports_view",
    },
    {
        "case_id": "hld_nav_en_05",
        "group_id": "grp_hld_nav_en_05",
        "task": "navigate.v1",
        "language": "en",
        "text": "Received unexpected gift from regular client",
        "expected": "cashbook_receipt",
    },

    # Navigation: Malayalam Script
    {
        "case_id": "hld_nav_ml_01",
        "group_id": "grp_hld_nav_ml_01",
        "task": "navigate.v1",
        "language": "ml",
        "text": "സ്റ്റാഫ് അഡ്വാൻസ് ശമ്പളം 5000 നൽകി",
        "expected": "cashbook_payment",
    },
    {
        "case_id": "hld_nav_ml_02",
        "group_id": "grp_hld_nav_ml_02",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ക്യാഷ് ഡ്രോയറിൽ നിന്നും 10000 ബാങ്കിൽ നിക്ഷേപിച്ചു",
        "expected": "account_transfer",
    },
    {
        "case_id": "hld_nav_ml_03",
        "group_id": "grp_hld_nav_ml_03",
        "task": "navigate.v1",
        "language": "ml",
        "text": "പഴയ ഇൻവോയ്സുകളുടെ ലിസ്റ്റ് കാണണം",
        "expected": "reports_view",
    },
    {
        "case_id": "hld_nav_ml_04",
        "group_id": "grp_hld_nav_ml_04",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ഇന്ന് ആർക്കും പണം കൊടുക്കേണ്ടതില്ല",
        "expected": "clarify",
    },

    # Navigation: Manglish
    {
        "case_id": "hld_nav_mgl_01",
        "group_id": "grp_hld_nav_mgl_01",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Current bill online aayi adachu",
        "expected": "cashbook_payment",
    },
    {
        "case_id": "hld_nav_mgl_02",
        "group_id": "grp_hld_nav_mgl_02",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Customer cash direct aayi thannu",
        "expected": "cashbook_receipt",
    },
    {
        "case_id": "hld_nav_mgl_03",
        "group_id": "grp_hld_nav_mgl_03",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Bank accountil ninn petty cashilekku eduthu",
        "expected": "account_transfer",
    },

    # Navigation: Arabic
    {
        "case_id": "hld_nav_ar_01",
        "group_id": "grp_hld_nav_ar_01",
        "task": "navigate.v1",
        "language": "ar",
        "text": "سداد فاتورة الإنترنت للمكتب",
        "expected": "cashbook_payment",
    },
    {
        "case_id": "hld_nav_ar_02",
        "group_id": "grp_hld_nav_ar_02",
        "task": "navigate.v1",
        "language": "ar",
        "text": "استلام دفعة نقدية جديدة من الزبون",
        "expected": "cashbook_receipt",
    },
    {
        "case_id": "hld_nav_ar_03",
        "group_id": "grp_hld_nav_ar_03",
        "task": "navigate.v1",
        "language": "ar",
        "text": "إيداع مالي من الخزينة إلى البنك الأهلي",
        "expected": "account_transfer",
    },
    {
        "case_id": "hld_nav_ar_04",
        "group_id": "grp_hld_nav_ar_04",
        "task": "navigate.v1",
        "language": "ar",
        "text": "كشف المصروفات النقدية لهذا الأسبوع",
        "expected": "reports_view",
    },

    # Cashbook Category: Payment & Receipt across languages
    {
        "case_id": "hld_cat_pay_01",
        "group_id": "grp_hld_cat_pay_01",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "en",
        "text": "Freight charges for goods delivery",
        "candidates": ["rent", "utilities", "salary", "transport", "none"],
        "expected": "transport",
    },
    {
        "case_id": "hld_cat_pay_02",
        "group_id": "grp_hld_cat_pay_02",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ml",
        "text": "കടയിലെ ലൈറ്റ് മാറ്റിവെച്ച ചെലവ്",
        "candidates": ["rent", "utilities", "salary", "maintenance", "none"],
        "expected": "maintenance",
    },
    {
        "case_id": "hld_cat_pay_03",
        "group_id": "grp_hld_cat_pay_03",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "manglish",
        "text": "Delivery vehicle diesel charge",
        "candidates": ["rent", "utilities", "salary", "transport", "none"],
        "expected": "transport",
    },
    {
        "case_id": "hld_cat_pay_04",
        "group_id": "grp_hld_cat_pay_04",
        "task": "cashbook_category.v1",
        "direction": "payment",
        "language": "ar",
        "text": "شراء أدوات قرطاسية وأوراق طباعة",
        "candidates": ["rent", "utilities", "salary", "office_supplies", "none"],
        "expected": "office_supplies",
    },
    {
        "case_id": "hld_cat_rec_01",
        "group_id": "grp_hld_cat_rec_01",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "en",
        "text": "Vendor refund for returned damaged stock",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "refund",
    },
    {
        "case_id": "hld_cat_rec_02",
        "group_id": "grp_hld_cat_rec_02",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ml",
        "text": "സപ്ലയറിൽ നിന്നും റീഫണ്ട് ലഭിച്ചു",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "refund",
    },
    {
        "case_id": "hld_cat_rec_03",
        "group_id": "grp_hld_cat_rec_03",
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ar",
        "text": "استرداد نقدي من المورد للبضاعة المرتجعة",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "refund",
    },
]


def split_grouped_dataset(
    cases: List[Dict[str, Any]],
    seed: int = 42,
    train_ratio: float = 0.65,
    dev_ratio: float = 0.15,
    calib_ratio: float = 0.10,
    test_ratio: float = 0.10,
) -> Dict[str, List[Dict[str, Any]]]:
    """Split dataset by group_id into strictly isolated partitions.

    Guarantees that all variants/paraphrases sharing the same group_id
    reside in the exact same partition, with zero leakage across train/dev/calib/test.
    """
    total_ratio = train_ratio + dev_ratio + calib_ratio + test_ratio
    if abs(total_ratio - 1.0) >= 1e-5:
        raise ValueError(f"Split ratios must sum to 1.0, got: {total_ratio}")

    for r_name, r_val in [
        ("train_ratio", train_ratio),
        ("dev_ratio", dev_ratio),
        ("calib_ratio", calib_ratio),
        ("test_ratio", test_ratio),
    ]:
        if r_val < 0.0 or r_val > 1.0:
            raise ValueError(f"{r_name} must be between 0.0 and 1.0, got: {r_val}")

    # Validate all cases and verify unique case_ids
    seen_case_ids: Set[str] = set()
    for c in cases:
        cid = c.get("case_id")
        if cid in seen_case_ids:
            raise ValueError(f"Found duplicate case_id in dataset: '{cid}'")
        seen_case_ids.add(cid)

        is_valid, errs = validate_dataset_case(c)
        if not is_valid:
            raise ValueError(f"Case '{cid}' failed validation: {'; '.join(errs)}")

    # Group cases by family / group_id
    families: Dict[str, List[Dict[str, Any]]] = {}
    for c in cases:
        gid = c.get("group_id", c["case_id"])
        families.setdefault(gid, []).append(c)

    family_keys = sorted(families.keys())
    rng = random.Random(seed)
    rng.shuffle(family_keys)

    n_families = len(family_keys)
    n_train_f = int(round(n_families * train_ratio))
    n_dev_f = int(round(n_families * dev_ratio))
    n_calib_f = int(round(n_families * calib_ratio))

    train_families = set(family_keys[:n_train_f])
    dev_families = set(family_keys[n_train_f : n_train_f + n_dev_f])
    calib_families = set(family_keys[n_train_f + n_dev_f : n_train_f + n_dev_f + n_calib_f])
    test_families = set(family_keys[n_train_f + n_dev_f + n_calib_f :])

    partitions: Dict[str, List[Dict[str, Any]]] = {
        "train": [],
        "dev": [],
        "calibration": [],
        "test": [],
    }

    for gid, items in families.items():
        if gid in train_families:
            partitions["train"].extend(items)
        elif gid in dev_families:
            partitions["dev"].extend(items)
        elif gid in calib_families:
            partitions["calibration"].extend(items)
        elif gid in test_families:
            partitions["test"].extend(items)

    for k in partitions:
        partitions[k].sort(key=lambda x: x["case_id"])

    return partitions


def build_and_save_dataset_artifacts(output_dir: Path) -> Dict[str, str]:
    """Generates partitions, saves them, and returns SHA256 checksums."""
    output_dir.mkdir(parents=True, exist_ok=True)
    splits = split_grouped_dataset(RAW_CASES)

    hashes: Dict[str, str] = {}
    for split_name, items in splits.items():
        file_path = output_dir / f"{split_name}.jsonl"
        with file_path.open("w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        content = file_path.read_bytes()
        hashes[split_name] = hashlib.sha256(content).hexdigest()

    # Also save fresh blind holdout set independently
    holdout_file = output_dir / "holdout.jsonl"
    with holdout_file.open("w", encoding="utf-8") as f:
        for item in FRESH_HOLDOUT_CASES:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
    hashes["holdout"] = hashlib.sha256(holdout_file.read_bytes()).hexdigest()

    summary_file = output_dir / "dataset_manifest.json"
    manifest_data = {
        "dataset_version": "1.1.0",
        "total_dev_cases": len(RAW_CASES),
        "total_holdout_cases": len(FRESH_HOLDOUT_CASES),
        "split_counts": {k: len(v) for k, v in splits.items()},
        "holdout_count": len(FRESH_HOLDOUT_CASES),
        "split_hashes": hashes,
        "tasks": SUPPORTED_TASKS,
        "languages": SUPPORTED_LANGUAGES,
    }
    with summary_file.open("w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    return hashes


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "datasets"
    h = build_and_save_dataset_artifacts(out)
    print("Dataset generated successfully:")
    for k, v in h.items():
        print(f"  {k}: {v}")
