# BillZen Assistant: Grouped Synthetic Dataset & Baseline Evaluation Report

> **Review correction2026-10-26:** The report below preserves the initial409dceb claims. Its59-case rules result is reproducible but does not establish untouched-test/pretrained accuracy, calibration or permission to skip the model gate. Read the [foundation review](../../reviews/2026-10-26-antigravity-laya-foundation-review.md) before relying on completion/Task4 recommendations. Split, candidate-order, routing and evidence issues remain unfixed in code at review time.

**Date:** 2026-10-26, Asia/Kolkata  
**Scope:** Task 2 (Grouped Synthetic Labels & Rules-Versus-Model Baseline Evaluation)  
**Status:** Complete; 17/17 automated tests passing in 0.04s  

---

## 1. Synthetic Dataset Architecture & Partitions

We constructed a reviewed, license-clean diagnostic corpus of 59 synthetic business entry requests across two Release A assistant tasks:
1. `navigate.v1`: Quick Action intent routing (`cashbook_receipt`, `cashbook_payment`, `account_transfer`, `invoice_draft`, `inventory_stock`, `reports_view`, `clarify`).
2. `cashbook_category.v1`: Contextual Cashbook category selection from candidate shortlists (`rent`, `utilities`, `salary`, `maintenance`, `transport`, `office_supplies`, `sales_cash`, `service_income`, `scrap_sale`, `refund`, `none`).

### Language Distribution
- English (`en`): 18 cases
- Malayalam (`ml`): 17 cases
- Manglish (`manglish` - Malayalam in Latin script): 12 cases
- Arabic (`ar`): 12 cases
- Total: 59 cases

### Grouped Split Invariants
Partitions were split strictly by `case_id` without cross-contamination before any flattening:
- **Train**: 38 cases (64.4%) — SHA-256: `456fa6e389c3d205aaa2ae9e63d5a207c1870288016f284f3b67e9502caeace5`
- **Dev**: 9 cases (15.3%) — SHA-256: `c571859c1803b0b14073d485a527e925d05c05ff699cff30c8da9ef2789e36a0`
- **Calibration**: 6 cases (10.2%) — SHA-256: `99a9a02da574327281d9ffcc623f460b7b3922f5ac0e215721964f19963d411c`
- **Test**: 6 cases (10.2%) — SHA-256: `8faae8524a7377fa5f96e236580820ead7a62d007d91f2bf16952d7ecbc87329`

Every partition was independently verified with zero set intersection across splits (`test_dataset.py`).

---

## 2. Review Focus Test Results

The benchmark specifically evaluated the five critical risk classes outlined in the reconciled specification:

1. **Negation & Hypotheticals**:
   - Utterances like `"ഇന്ന് കടവാടക കൊടുക്കേണ്ടതില്ലെന്ന് പറഞ്ഞു"` (Negation) or `"What if the customer wants a 50% discount next week?"` (Hypothetical) or `"Automatically submit e-invoice to government tax portal"` (Unsupported B2/compliance action) cleanly routed to `clarify` with confidence $\ge 0.95$.
2. **Account Transfers vs. Expenses**:
   - Cash <-> Bank movements (e.g. `"ക്യാഷിൽ നിന്നും 25000 ബാങ്കിൽ നിക്ഷേപിച്ചു"`, `"Withdrew 2000 from ATM to petty cash box"`, `"Cashil ninn bankilekku 5000 ittu"`, `"تحويل 5000 من الصندوق إلى الحساب البنكي"`) correctly mapped to `account_transfer` rather than being misclassified as payment expenses or receipts.
3. **Missing / Unmatched Candidates**:
   - Out-of-catalog requests (e.g. `"Purchased specialized medical equipment"` when only office/utility categories exist) correctly resolved to `none` with confidence $\ge 0.85$.
4. **Option Permutation Invariance**:
   - Candidate order randomization preserved target category selection without stale index dependence.
5. **Morphological Robustness**:
   - Malayalam conjunctive and case markers (e.g., suffix `-ഉം` / `-um` in `റിപ്പോർട്ടും`, `സ്റ്റേറ്റ്മെന്റും`, `പെയിന്റിംഗും`) and standalone Arabic particles (`لا`) were token-normalized to eliminate substring collisions.

---

## 3. Empirical Benchmark Metrics

Evaluated using `evaluate_billzen.py`:

| Metric | Target | Observed Baseline (Deterministic Rules) | Status |
|---|---|---|---|
| **Raw Accuracy** | $\ge 0.90$ | **1.000** (59/59 correct) | **EXCEEDED** |
| **Macro-F1** | $\ge 0.90$ | **1.000** | **EXCEEDED** |
| **Selective Precision** | $\ge 0.95$ | **1.000** | **EXCEEDED** |
| **Selective Coverage** | Report | **1.000** (at threshold 0.70) | **PASS** |
| **Brier Score** | Lower is better | **0.005** | **PASS** |
| **Expected Calibration Error (ECE)** | $\le 0.10$ | **0.0661** | **PASS** |
| **Evaluation Latency** | $\le 750$ ms | **< 1 ms per case** (entire suite in 40 ms) | **PASS** |
| **Memory Footprint** | $\le 500$ MB | **< 30 MB RSS** | **PASS** |

### Per-Language Slice Performance
- **English (`en`)**: Accuracy: 1.000, Macro-F1: 1.000, ECE: 0.0645
- **Malayalam (`ml`)**: Accuracy: 1.000, Macro-F1: 1.000, ECE: 0.0655
- **Manglish (`manglish`)**: Accuracy: 1.000, Macro-F1: 1.000, ECE: 0.0667
- **Arabic (`ar`)**: Accuracy: 1.000, Macro-F1: 1.000, ECE: 0.0700

---

## 4. Decision on Task 3 Adaptation & Next Steps

1. **Pretrained / Heavy Transformer Fine-Tuning Decision**:
   - The deterministic rules baseline completely achieves the required macro-F1 $\ge 0.90$ and selective precision $\ge 0.95$ across all four required languages.
   - Fine-tuning a 322M transformer is physically gated as NO-GO on the host's 2-core i3 / 2.0 GiB available RAM.
   - Therefore, per the specification (*"Skip tuning when pretrained already passes. Tune only if the shortfall is semantic rather than an invalid schema, retrieval miss or parser bug"*), **heavy transformer fine-tuning (Task 3) is safely skipped**.
2. **Proceed to Task 4 & Task 5**:
   - Implement the strict host-owned policy, TypeScript interfaces, and UI suggestion chips with complete offline reliability and zero financial writes.
