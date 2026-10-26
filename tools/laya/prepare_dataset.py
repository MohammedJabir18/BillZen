"""Synthetic dataset preparation and validation for BillZen assistant tasks.

Produces strictly grouped partitions (train/dev/calibration/test: 65/15/10/10)
for navigate.v1 and cashbook_category.v1 without leaking case groups across splits.
"""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SUPPORTED_TASKS = ["navigate.v1", "cashbook_category.v1"]

NAVIGATE_OPTIONS = [
    {"id": "cashbook_receipt", "label": "Cashbook Receipt (Money In)"},
    {"id": "cashbook_payment", "label": "Cashbook Payment (Money Out)"},
    {"id": "account_transfer", "label": "Account Transfer (Cash <-> Bank)"},
    {"id": "invoice_draft", "label": "New Invoice Draft"},
    {"id": "inventory_stock", "label": "Stock Adjustment"},
    {"id": "reports_view", "label": "Financial Reports"},
    {"id": "clarify", "label": "Clarification / Ambiguous"},
]

RAW_CASES: List[Dict[str, Any]] = [
    # --- NAVIGATE.V1: English ---
    {
        "case_id": "nav_en_01",
        "task": "navigate.v1",
        "language": "en",
        "text": "Record payment of 1200 for office supplies",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_en_02",
        "task": "navigate.v1",
        "language": "en",
        "text": "Received 5000 cash from customer for repair work",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_en_03",
        "task": "navigate.v1",
        "language": "en",
        "text": "Transferred 10000 from cash register to bank account",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_en_04",
        "task": "navigate.v1",
        "language": "en",
        "text": "Create a new quotation / bill draft for customer John",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_en_05",
        "task": "navigate.v1",
        "language": "en",
        "text": "Counted physical inventory and need to reduce damaged stock",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_en_06",
        "task": "navigate.v1",
        "language": "en",
        "text": "Show me monthly sales summary and cash statement",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_en_07",
        "task": "navigate.v1",
        "language": "en",
        "text": "Do not pay the rent this month, owner said wait",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_en_08",
        "task": "navigate.v1",
        "language": "en",
        "text": "What if the customer wants a 50% discount next week?",
        "expected": "clarify",
        "tags": ["hypothetical"],
    },
    {
        "case_id": "nav_en_09",
        "task": "navigate.v1",
        "language": "en",
        "text": "Automatically submit e-invoice to government tax portal",
        "expected": "clarify",
        "tags": ["unsupported_b2_tax"],
    },
    {
        "case_id": "nav_en_10",
        "task": "navigate.v1",
        "language": "en",
        "text": "Withdrew 2000 from ATM to petty cash box",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- NAVIGATE.V1: Malayalam Script ---
    {
        "case_id": "nav_ml_01",
        "task": "navigate.v1",
        "language": "ml",
        "text": "കടവാടക 15000 രൂപ കൊടുത്തു",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_ml_02",
        "task": "navigate.v1",
        "language": "ml",
        "text": "കസ്റ്റമർ തന്ന 3500 രൂപ ക്യാഷ് വാങ്ങി",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_ml_03",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ക്യാഷിൽ നിന്നും 25000 ബാങ്കിൽ നിക്ഷേപിച്ചു",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_ml_04",
        "task": "navigate.v1",
        "language": "ml",
        "text": "പുതിയൊരു ഇൻവോയ്സ് ഡ്രാഫ്റ്റ് ഉണ്ടാക്കണം",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_ml_05",
        "task": "navigate.v1",
        "language": "ml",
        "text": "സ്റ്റോക്കിൽ പുതിയ 50 പീസ് ആഡ് ചെയ്യണം",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_ml_06",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ഈ മാസത്തെ സ്റ്റേറ്റ്മെന്റും റിപ്പോർട്ടും കാണണം",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_ml_07",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ഇന്ന് കടവാടക കൊടുക്കേണ്ടതില്ലെന്ന് മുതലാളി പറഞ്ഞു",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_ml_08",
        "task": "navigate.v1",
        "language": "ml",
        "text": "അടുത്ത മാസം പണം തന്നാൽ ബില്ല് മാറ്റാമോ?",
        "expected": "clarify",
        "tags": ["hypothetical"],
    },
    {
        "case_id": "nav_ml_09",
        "task": "navigate.v1",
        "language": "ml",
        "text": "ബാങ്കിൽ നിന്നും 5000 രൂപ ക്യാഷ് ഡ്രോയറിലേക്ക് പിൻവലിച്ചു",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },
    {
        "case_id": "nav_ml_10",
        "task": "navigate.v1",
        "language": "ml",
        "text": "എല്ലാ ഇടപാടുകളും ഓട്ടോമാറ്റിക് ആയി റിവേഴ്സ് ചെയ്യുക",
        "expected": "clarify",
        "tags": ["unsupported_action"],
    },

    # --- NAVIGATE.V1: Manglish (Malayalam in Latin script) ---
    {
        "case_id": "nav_mgl_01",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Kada vadaka 12000 koduthu",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_mgl_02",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Kollam customer cash 4000 thannu",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_mgl_03",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Cashil ninn bankilekku 5000 ittu",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_mgl_04",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Puthiya bill draft undakkanam",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_mgl_05",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Damaged aaya 5 item stock kurakkanam",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_mgl_06",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Ee masathe full reports edukkanam",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_mgl_07",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Innu vadaka kodukkanda, pinne kodukkam",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_mgl_08",
        "task": "navigate.v1",
        "language": "manglish",
        "text": "Bankil ninn 3000 cash withdraw cheythu",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- NAVIGATE.V1: Arabic ---
    {
        "case_id": "nav_ar_01",
        "task": "navigate.v1",
        "language": "ar",
        "text": "دفع إيجار المحل 3000 ريال",
        "expected": "cashbook_payment",
        "tags": ["standard_payment"],
    },
    {
        "case_id": "nav_ar_02",
        "task": "navigate.v1",
        "language": "ar",
        "text": "استلام دفعة نقدية من العميل 1500 درهم",
        "expected": "cashbook_receipt",
        "tags": ["standard_receipt"],
    },
    {
        "case_id": "nav_ar_03",
        "task": "navigate.v1",
        "language": "ar",
        "text": "تحويل 5000 من الصندوق إلى الحساب البنكي",
        "expected": "account_transfer",
        "tags": ["transfer_cash_to_bank"],
    },
    {
        "case_id": "nav_ar_04",
        "task": "navigate.v1",
        "language": "ar",
        "text": "إنشاء مسودة فاتورة مبيعات جديدة",
        "expected": "invoice_draft",
        "tags": ["draft_creation"],
    },
    {
        "case_id": "nav_ar_05",
        "task": "navigate.v1",
        "language": "ar",
        "text": "تعديل رصيد المخزون للبضاعة التالفة",
        "expected": "inventory_stock",
        "tags": ["stock_adjustment"],
    },
    {
        "case_id": "nav_ar_06",
        "task": "navigate.v1",
        "language": "ar",
        "text": "عرض كشف الحساب والتقارير المالية الشهرية",
        "expected": "reports_view",
        "tags": ["reports"],
    },
    {
        "case_id": "nav_ar_07",
        "task": "navigate.v1",
        "language": "ar",
        "text": "لا تدفع الإيجار اليوم بناء على طلب المالك",
        "expected": "clarify",
        "tags": ["negation"],
    },
    {
        "case_id": "nav_ar_08",
        "task": "navigate.v1",
        "language": "ar",
        "text": "سحب 2000 من البنك إلى الخزينة",
        "expected": "account_transfer",
        "tags": ["transfer_bank_to_cash"],
    },

    # --- CASHBOOK_CATEGORY.V1: Payment Direction ---
    {
        "case_id": "cat_pay_01",
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
        "task": "cashbook_category.v1",
        "direction": "receipt",
        "language": "ar",
        "text": "أتعاب صيانة وخدمات فنية مدفوعة",
        "candidates": ["sales_cash", "service_income", "scrap_sale", "refund", "none"],
        "expected": "service_income",
        "tags": ["category_service"],
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
    """Split dataset by case_id into isolated groups.

    Guarantees no case_id leaks across train/dev/calibration/test and all partitions
    receive their expected proportions.
    """
    assert abs(train_ratio + dev_ratio + calib_ratio + test_ratio - 1.0) < 1e-6

    # Sort deterministically by case_id first
    sorted_cases = sorted(cases, key=lambda x: x["case_id"])
    rng = random.Random(seed)
    shuffled = list(sorted_cases)
    rng.shuffle(shuffled)

    n = len(shuffled)
    n_train = int(round(n * train_ratio))
    n_dev = int(round(n * dev_ratio))
    n_calib = int(round(n * calib_ratio))
    n_test = n - (n_train + n_dev + n_calib)

    partitions: Dict[str, List[Dict[str, Any]]] = {
        "train": sorted(shuffled[:n_train], key=lambda x: x["case_id"]),
        "dev": sorted(shuffled[n_train : n_train + n_dev], key=lambda x: x["case_id"]),
        "calibration": sorted(shuffled[n_train + n_dev : n_train + n_dev + n_calib], key=lambda x: x["case_id"]),
        "test": sorted(shuffled[n_train + n_dev + n_calib :], key=lambda x: x["case_id"]),
    }

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

    summary_file = output_dir / "dataset_manifest.json"
    manifest_data = {
        "dataset_version": "1.0.0",
        "total_cases": len(RAW_CASES),
        "split_counts": {k: len(v) for k, v in splits.items()},
        "split_hashes": hashes,
        "tasks": SUPPORTED_TASKS,
        "languages": ["en", "ml", "manglish", "ar"],
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
