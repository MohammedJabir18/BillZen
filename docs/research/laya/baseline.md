# BillZen Assistant: Grouped Synthetic Dataset & Baseline Evaluation Report

> **Updated 2026-10-26 (Post-Review V1/V3 Corrections):** Metrics below are derived directly from machine-readable reports (`tools/laya/reports/benchmark_dev.json` and `benchmark_holdout.json`). Development metrics reflect exact source behavior (58/59 correct; single error is Arabic `nav_ar_02` where clarify was returned instead of receipt). All numbers include exact counts and 95% Wilson confidence intervals. Small task×language cells are explicitly flagged for insufficient evidence. Heuristic rule scores are uncalibrated confidence indicators, not calibrated probabilities. No deep learning model was executed; rules results must not be conflated with Laya model performance.

**Date:** 2026-10-26, Asia/Kolkata  
**Scope:** Task 2 (Grouped Synthetic Labels & Rules Baseline Diagnostic Harness)  
**Status:** Foundation Tooling Verified; Exact Machine-Readable Evaluation Reports Generated  

---

## 1. Dataset Architecture & Grouped Isolation

The dataset tooling generates strictly isolated partitions for the two Release A tasks:
1. `navigate.v1`: Quick Action intent routing (`cashbook_receipt`, `cashbook_payment`, `account_transfer`, `invoice_draft`, `inventory_stock`, `reports_view`, `clarify`).
   * *Scope notice:* `reports_view` routes to Cashbook cash/voucher summaries only. It does NOT represent statutory Profit & Loss (P&L), credit ledger, or tax e-invoicing features.
2. `cashbook_category.v1`: Contextual Cashbook category selection from candidate shortlists (`rent`, `utilities`, `salary`, `maintenance`, `transport`, `office_supplies`, `sales_cash`, `service_income`, `scrap_sale`, `refund`, `none`).

### Grouped Split Invariants
- Each scenario family is assigned a stable `group_id`.
- The partitioner (`split_grouped_dataset`) partitions strictly by `group_id` before flattening, guaranteeing that multiple variants or paraphrases of the same scenario stay in the exact same partition.
- Validated at runtime by `validate_dataset_case`: strictly rejects missing fields, non-string text/group IDs, boolean group IDs, invalid navigation targets, malformed/duplicate candidates, and private data.
- Tested upstream export: `export_case_to_laya_format` converts internal fixture cases into clean standard instruction/input/output format without leaking internal tags, group IDs, or fixture metadata.

### Dataset Splits
- **Development & Regression Corpus** (`RAW_CASES`): 59 cases used for prototype development and regression verification across English, Malayalam script, Manglish, and Arabic.
  - Partition counts: Train: 38 (64.4%), Dev: 9 (15.3%), Calibration: 6 (10.2%), Test: 6 (10.2%).
- **Frozen Held-Out Snapshot (v1.0.0)** (`FRESH_HOLDOUT_CASES` / `holdout.jsonl`): 23 independently authored cases reserved for held-out evaluation across English, Malayalam, Manglish, and Arabic.
  - *Freeze notice:* This 23-case snapshot is frozen. Rules will NOT be tuned against its failures while continuing to describe it as an unseen holdout. Future benchmark expansions will introduce separately versioned, independently authored batches.

---

## 2. Review Focus & Corrective Regressions

The evaluation harness implements robust semantic rules addressing all Review Focus classes and foundation review findings (R3, R4, V2):

1. **Payment vs. Invoice Draft Distinction**:
   - Utterances like `"Pay electricity bill"` and `"Paid supplier invoice"` are correctly recognized as `cashbook_payment` (paying an existing obligation), whereas `invoice_draft` strictly requires draft/bill creation contexts (`"New invoice draft"`, `"Create quotation"`).
2. **Account Transfers vs. Method Context**:
   - `"Customer paid by bank transfer"` routes to `cashbook_receipt` (bank is the payment method, not an internal account transfer).
   - `"Salary was paid by bank transfer"` routes to `cashbook_payment`.
   - Internal movements between company accounts (`"Transferred 10000 from cash register to bank account"`, `"Withdrew 2000 from ATM to petty cash"`) route to `account_transfer`.
3. **Read-Only / Reporting Intent**:
   - Queries like `"Show salary payments"` or `"View cash statement"` route to `reports_view` or `clarify`, preventing read-only lookups from becoming financial posting forms.
4. **Negation & Hypothetical Token Boundaries**:
   - Standalone word boundaries (`\bif\b`) prevent false-positive clarifications on unrelated words (e.g. `"Received gift from customer"` routes to `cashbook_receipt`, `"Shift stock to shelf"` routes to `inventory_stock`).
5. **Candidate Invariance & Ambiguous Ties**:
   - Evaluated across permutations: candidate order shuffling does not alter category predictions.
   - Ambiguous ties (e.g. `"rent and salary"` with candidates `["rent", "salary"]`) consistently abstain to `clarify`, rather than arbitrarily selecting whichever candidate was listed first.
   - Supports real-world candidate objects (`{id, label, direction}`) and ignores candidates incompatible with the current voucher direction.
6. **Host Safety Contract (V2)**:
   - Dedicated host policy module (`tools/laya/host_policy.py`) filters out inactive (`is_active: false`) and archived categories before assistant evaluation.
   - Compound or conflicting navigation requests (e.g. `"Pay rent and record customer receipt"`) explicitly abstain to `clarify`.
   - Stale currency or context changes force abstention.
   - Unknown candidate IDs are strictly prevented from reaching the host.

---

## 3. Empirical Evaluation Results (Machine-Derived)

Derived directly from `tools/laya/reports/benchmark_dev.json` and `benchmark_holdout.json`:

### A. Summary Metric Comparison

| Metric | Development (59 cases) | Held-Out Snapshot v1.0.0 (23 cases) |
|---|---:|---:|
| **Total Cases** | 59 | 23 |
| **Raw Correct Count** | **58 / 59** | **17 / 23** |
| **Raw Accuracy** | **0.9831** | **0.7391** |
| **Raw Accuracy 95% Wilson CI** | **[0.9100, 0.9970]** | **[0.5353, 0.8745]** |
| **Macro-F1** | **0.9866** | **0.6400** |
| **Decision Accepted Count** | 58 / 59 (98.31%) | 18 / 23 (78.26%) |
| **Decision Correct Count** | 58 / 58 | 17 / 18 |
| **Decision Precision (Selective Precision)** | **1.0000** | **0.9444** |
| **Decision Precision 95% Wilson CI** | **[0.9379, 1.0000]** | **[0.7424, 0.9901]** |
| **Actionable Accepted Count** | 48 / 59 (81.36%) | 16 / 23 (69.57%) |
| **Actionable Correct Count** | 48 / 48 | 16 / 16 |
| **Actionable Precision** | **1.0000** | **1.0000** |
| **Actionable Precision 95% Wilson CI** | **[0.9259, 1.0000]** | **[0.8064, 1.0000]** |
| **Binary Correctness Brier Score** | **0.0089** | **0.0946** |
| **Expected Calibration Error (ECE)** | **0.0708** | **0.1283** |

*Note on Dev Error:* The single incorrect case in Development (58/59) is Arabic case `nav_ar_02` (`"استلمنا 1500 كاش من العميل مقابل خدمة الصيانة"`), where the conservative negation boundary returned `clarify` instead of `cashbook_receipt`.

### B. Held-Out Task × Language Matrix & Evidence Sufficiency

*Rule:* Cells with $n < 10$ cannot establish statistical confidence and are explicitly flagged for insufficient evidence.

| Task | Language | Count | Correct | Accuracy | Evidence Sufficiency |
|---|---|---:|---:|---:|---|
| `cashbook_category.v1` | Arabic (`ar`) | 3 | 3 | 1.0000 | ⚠️ Insufficient evidence ($n=3 < 10$) |
| `cashbook_category.v1` | English (`en`) | 4 | 4 | 1.0000 | ⚠️ Insufficient evidence ($n=4 < 10$) |
| `cashbook_category.v1` | Manglish (`manglish`) | 4 | 4 | 1.0000 | ⚠️ Insufficient evidence ($n=4 < 10$) |
| `cashbook_category.v1` | Malayalam (`ml`) | 4 | 3 | 0.7500 | ⚠️ Insufficient evidence ($n=4 < 10$) |
| `navigate.v1` | Arabic (`ar`) | 2 | 0 | 0.0000 | ⚠️ Insufficient evidence ($n=2 < 10$) |
| `navigate.v1` | English (`en`) | 2 | 1 | 0.5000 | ⚠️ Insufficient evidence ($n=2 < 10$) |
| `navigate.v1` | Manglish (`manglish`) | 2 | 1 | 0.5000 | ⚠️ Insufficient evidence ($n=2 < 10$) |
| `navigate.v1` | Malayalam (`ml`) | 2 | 1 | 0.5000 | ⚠️ Insufficient evidence ($n=2 < 10$) |

---

## 4. Honest Status on Model Feasibility & Task 3

1. **Pretrained Laya Model Status**:
   - The pretrained `laya-multilingual` weights were **NOT evaluated or executed** on the primary workstation due to host memory constraints (~1.4–1.5 GiB available RAM vs conservative 4.0 GiB safety ceiling).
   - The reported accuracy and latency numbers belong entirely to the local `DeterministicRuleClassifier`. They must never be described as pretrained Laya performance.
2. **Functional Model Tooling & Dataset Contracts Implemented**:
   - `tools/laya/prepare_dataset.py` now implements the typed `{state, questions, expected}` schema matching upstream Laya `docs/finetune.md` (`export_case_to_laya_finetune_format`).
   - `tools/laya/runner.py` implements the full provider lifecycle (`ProviderState`: `READY`, `MISSING_ASSETS`, `MISSING_DEPENDENCIES`, `INSUFFICIENT_RESOURCES`, `NOT_IMPLEMENTED`, `FAILED`), real tensor scoring and softmax prediction paths for ONNX/Python providers, and isolated multi-provider error containment.
   - `tools/laya/host_policy.py` provides host safety filtering, context staleness checks, finite confidence validation, and compound intent disambiguation while permitting harmless item conjunctions ("electricity and water").
3. **External Runbook for Reproducible Execution**:
   - Detailed instructions for CPU ONNX export, dynamic INT8 quantization, and comparative benchmarking on an adequately resourced external host are codified in [`external-runbook.md`](./external-runbook.md).
4. **Runtime Footprint & Budgets**:
   - Preparation / export budget: requires $\ge$ 4.0–8.0 GiB available memory and 10-minute timeout for PyTorch/ONNX conversion.
   - Target desktop assistant budget: **500 MiB target RSS** with a **750 MiB hard watchdog ceiling** and p50 <= 150 ms latency. Heavy weights remain unrun locally until certified via the external runbook.
