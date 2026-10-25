# Laya for BillZen: evidence, design and adoption decision

Date: 2026-10-25, Asia/Kolkata. **Status: proposed research/design; no AI implementation, weights download, training or inference benchmark performed.** Owner preference: desktop first; Android later; training hardware undecided. This assessment supersedes neither B1's completed source status nor the separate B2/B3 product gates.

## 1. Recommendation

Evaluate Laya as an **optional, local, multilingual decision assistant**. Start with navigation/action intent and suggestions for an already selected Cashbook direction. Keep all money, stock, debt, tax, numbering and persistence decisions in BillZen's existing deterministic domain and command layers. Require a separate explicit user action in the ordinary form to save a financial operation.

Use one pinned multilingual checkpoint first. Establish a rules/fuzzy-search baseline, measure the pretrained checkpoint, and fine-tune only where labeled evaluation demonstrates a benefit. Do not make a Python interpreter, network access or a large model mandatory for using BillZen. If accuracy, calibration, memory, latency, licensing or runtime parity fails, ship the manual workflow and defer AI.

The request supplied one identifiable repository URL. This report evaluates that repository and the current local BillZen checkout; it does not claim to have inspected an unidentified second upload.

## 2. Evidence boundaries and provenance

BillZen source studied: `9158c404b88113f4f02eacf0eac43832b08c97a5`. Read curated brain memory, current architecture/roadmap, draft specifications/evidence, financial types/adapters, native command/worker paths, application/navigation and localization structure, package manifests and Tauri CSP. Relevant Graphify dependency inspection covered draft worker/domain/adapter/application relationships. Graph evidence is partial: local code-only extraction lacks SQL/semantic coverage and does not establish runtime behavior.

Laya source pinned to [`7a77439b0923d6efe00052d50a7f787840bfce98`](https://github.com/NandhaKishorM/laya/tree/7a77439b0923d6efe00052d50a7f787840bfce98), repository release commit 0.4.15 dated 2026-10-24. Read Python training/calibration/confidence/routing/agent/export sources, Python packaging, Rust SDK/model packaging/calibration sources and TypeScript SDK/export documentation. Upstream source snapshots were inspected in `/tmp`, not executed or added to BillZen.

**The code commit does not identify model weights.** Hugging Face checkpoint revision, every weight/tokenizer/config hash, export environment and runtime asset provenance must be resolved in Phase 0. Model cards accessed at mutable main are descriptive evidence, not a pinned deployable bundle. No measured BillZen accuracy, RAM, latency, training duration, CPU compatibility, Android or browser feasibility is claimed here.

Primary sources, with distinct responsibilities:

| Source | What it establishes |
|---|---|
| [Pinned Laya README](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/README.md) | Typed decision engine and checkpoint families |
| [Multilingual model card](https://huggingface.co/convaiinnovations/laya-multilingual) | Checkpoint architecture, languages, limits, published evaluations and license |
| [mmBERT base card](https://huggingface.co/jhu-clsp/mmBERT-base) | Base encoder provenance and MIT license |
| [Fine-tuning guide](https://nandhakishorm.github.io/laya/finetune/) and [pinned trainer](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/laya/train.py) | RLCD/soft-CE, freezing, option shuffling and calibration split implementation |
| [Evaluation guide](https://nandhakishorm.github.io/laya/evals/) | Evaluation schema, slices, confidence metrics and selective prediction |
| [Routing guide](https://nandhakishorm.github.io/laya/routing/) | Checkpoint routing and its language assumptions |
| [Pinned Rust README](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/laya-rust/README.md) | Integration, blocking runtime and documented known gaps |
| [Pinned model/export guide](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/laya-rust/MODELS.md) | Artifact availability, export procedure, disk estimates and split/fused formats |
| [Rust manifest](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/laya-rust/Cargo.toml) and [TypeScript SDK](https://github.com/NandhaKishorM/laya/blob/7a77439b0923d6efe00052d50a7f787840bfce98/laya-ts/README.md) | Dependency/toolchain/backend constraints |
| [Guardrail limitations](https://nandhakishorm.github.io/laya/guardrail-limitations/) | Known indirect-injection misses; scores cannot authorize privileged actions |

## 3. What BillZen does today

BillZen is an offline business ledger and operational application, not a chatbot shell. React 19, TypeScript, Vite 8 and Tauri 2 provide the UI/desktop-mobile boundary. Native Rust owns SQLite on a serialized database worker with WAL, migrations and transactional audit/idempotency. Browser mode uses durable IndexedDB adapters. EN/ML/AR, RTL, keyboard/focus handling, responsive dialogs and reduced motion are established product requirements.

| Area | Current source behavior | Consequence for AI |
|---|---|---|
| Company and money | Company currency/timezone; integer minor units, 2/3 decimal currencies; quantity scaled by 1000 | Model must not calculate totals, convert currencies or reinterpret unsaved values |
| Cashbook | Atomic receipt/payment, movement and audit; numbering, retries, reversal, negative-balance confirmation | Assistant may suggest fields; only existing explicit command commits |
| Transfers | Atomic paired legs, common number and paired reversal; excluded from business income/expense | Never classify an account transfer as a new expense/receipt automatically |
| Catalog and stock | Products/barcodes, active/archive handling, immutable stock adjustments/opposite corrections | Candidate ranking cannot alter stock or select archived items silently |
| Customers | Explicit Customer-to-Cashbook-party links and history | Similar names do not authorize merging/linking; history is not invoice debt |
| Reports | Deterministic queries, filters, CSV and printing | Model proposes allowlisted filters; database computes every total |
| B1 invoice drafts | Multiple editable drafts, exact totals, native/browser retries, conflict and recovery; backup 1.2 | AI can assist selection; drafts still have zero stock/cash/debt/final-number effects |
| Future product | B2 finalization/numbering/stock and B3 settlement/dues/returns gated; sync deferred | Laya must not introduce these through an assistant shortcut |

Actual source interfaces include `postCashbookVoucher`, `reverseCashbookVoucher`, `getCashbookLedger`, `createInvoiceDraft`, `updateInvoiceDraft`, `getInvoiceDraft`, `listInvoiceDrafts` and `deleteInvoiceDraft`. AI should produce proposals consumed by UI, not gain a second write path around these adapters. The native database worker is a financial serialization boundary, not an inference executor.

Current CSP allows self/scoped IPC rather than an arbitrary inference server. Preserve that boundary. Complete workspace backup 1.2 stores authoritative records and draft journals, not model weights or transient editor recovery. Keep optional assistant assets/cache separate from portable business data.

Published/installed desktop remains 0.1.6; Android remains 0.1.5/code1010. Current B1 source is newer and unreleased. Exact B1 source CI [40109783757](https://github.com/MohammedJabir18/BillZen/actions/runs/40109783757) was observed completed/success. This research does not release B1 or AI.

## 4. What Laya can and cannot supply

Laya uses an encoder and a typed decision head. Its principal answer types are **choice**, **ordinal score** and **noul** (yes/no likelihood). It does not autoregressively generate unrestricted responses. This is useful when BillZen owns a finite set of valid answers and can check the returned ID.

It does not itself supply conversational text generation, explanations grounded in an arbitrary ledger, OCR, speech recognition, translation, unrestricted entity/amount/date extraction or time-series forecasting. Separate components would be needed for those capabilities. Even a finite valid choice can be confidently wrong; constrained output does not make the decision factually correct.

| Checkpoint | Upstream description | BillZen decision |
|---|---|---|
| `convaiinnovations/laya` | English ModernBERT-large, 421M; default 512 tokens | Not the initial multilingual default |
| `convaiinnovations/laya-multilingual` | mmBERT-base plus head, 322M total; default 1024 tokens; ML/AR included | First experimental candidate across EN/ML/AR/Manglish |
| `laya-typed-decisions` | English 421M; specialized on four published workflows | Not evidence of billing-domain or Malayalam specialization |

The multilingual card describes an explicit larger-context configuration, but the first benchmark should preserve the checkpoint's default 1024-token envelope and its separate head budget. Long options can truncate or become indistinguishable. Passing the entire ledger or thousands of products is unsuitable: retrieve a small local shortlist, keep stable IDs, add `none/clarify`, and reject truncated/oversized tasks.

Published GPU timings (such as T4 measurements) are not desktop CPU or UI response guarantees. The multilingual model card reports MASSIVE macro accuracy around 0.366 and ECE around 0.387; these are different tasks, but clearly do not justify a universal accuracy promise. The fine-tuning guide likewise shows a large base-to-tuned difference on a particular typed benchmark, not a BillZen result. Malayalam language inclusion and Manglish robustness must be tested independently.

### Runtime maturity risks

1. Python package is 0.4.15; Rust `laya-onnx` is 0.1.0 and documents routing/language behavior based on Python 0.4.14. Its known gaps include abstention thresholds, histogram binning and per-language temperatures. BillZen must implement its own validated acceptance/abstention policy; a Python configuration file alone is insufficient.
2. Rust uses edition 2024 and ONNX Runtime binding `ort = 2.0.0-rc.13`. BillZen's existing Rust application uses edition 2021. Coexistence is possible with a suitable toolchain, but resolved dependency/toolchain/native-library compatibility needs proof, not an assumption.
3. The pinned model guide says pre-exported ONNX files are not published yet. Export locally from pinned weights. Approximate multilingual disk sizes are 644 MB PyTorch and 1.2 GB ONNX, about 1.9 GB together. These are upstream disk estimates, not download availability or measured peak RAM.
4. Rust supports blocking fused or split inference; shared engine sessions serialize forward passes. Loading the model per request or dispatching many threads is not a throughput solution.
5. TypeScript supports Node/browser ONNX paths, WebGPU and WASM fallback, but this establishes neither Android WebView fitness nor affordable browser memory/cache behavior.
6. The code and Laya model card declare Apache-2.0; base mmBERT declares MIT. Record all applicable licenses, notices, tokenizer and derived asset provenance. Dataset permissions require their own review.

## 5. Useful features in priority order

| Priority | User experience | Decision boundary and fallback |
|---|---|---|
| P0: action/navigation | Malayalam/Manglish/English request opens Cashbook, transfer, draft, stock or reports form | Finite route IDs; unsupported/ambiguous => clarification or normal navigation; no submission |
| P0: category suggestion | After direction is chosen, suggest a compatible active category from note and shortlist | Filter by direction/type first; user accepts a named suggestion; financial save remains separate |
| P1: report filter assistant | Choose report intent and compatible filter candidates | Date/amount deterministic parsing with editable review; query allowlist, no generated SQL |
| P1: candidate reranking | Rank a few products/customers from local exact/barcode/fuzzy retrieval | Stable IDs and `none`; explicit selection, archive/version checks; never auto-link parties |
| P2: possible duplicate notice | Flag similar notes among candidates already selected by amount/date/account rules | Nonblocking notice; no fraud verdict, deletion or automatic reversal |
| P2: stock reason/help | Suggest a reason label or curated translated help topic | Business validation and help text are host-owned; no invented instructions |
| Future-dependent | CSV column-role suggestions, OCR-text routing, voice-command intent | Requires separate import/OCR/ASR features and plans; Laya only classifies supplied text |

Suggested examples are invented, not benchmark results:

- `കടവാടക കൊടുത്തത്` in a payment form: suggest an active rent category if present.
- `supplierinu 2500 koduthu`: propose payment direction if unambiguous, but ask purpose/category; it does not prove a purchase, stock movement or supplier balance.
- `cashil ninn bankilekku 5000`: propose the Transfer form. Host parses/reviews 5000; model does not move money.
- `റഫീഖ് നൽകിയ 1000`: offer a receipt route and customer/party shortlist with `none`; do not create/link a party or infer settled debt.
- Negations, quotes, hypothetical commands, mixed Arabic digits and requests for future credit/return operations must be explicit evaluation cases, not silently coerced into supported actions.

Maximum useful adoption means reducing typing and selection mistakes while preserving trust. A general chat box promising to run the whole business is a poor first target for this model.

## 6. Proposed desktop architecture

```text
User text + current form context
    -> host rules / deterministic parser / local candidate retrieval
    -> bounded typed task + stable candidate IDs + context digest
    -> optional dedicated Rust AI host process (one lazily loaded ONNX session)
    -> typed probabilities / diagnostics
    -> host calibration, whitelist, truncation and stale-context checks
    -> translated suggestion or clarification
    -> explicit user edit/accept in ordinary form
    -> ordinary user save -> existing adapter/domain/SQLite worker
```

Prefer a separate Rust AI host process for production fault containment and enforceable deadlines. Begin with a standalone benchmark executable before integrating Tauri sidecar packaging. A dedicated in-process worker can be evaluated as a simpler alternative only if fault/timeout requirements are explicitly relaxed: cancelling a future does not stop a blocking ONNX call or isolate OOM. Never run inference on the UI thread or serialized SQLite worker. Read a small candidate snapshot, release the DB operation, then infer.

**Process contract:** bounded JSON lines over private stdio; no listening HTTP port, shell execution, database path, raw SQL or write commands. Host permits one active inference and at most two queued requests. Drop superseded queued work; discard late results by request ID. Reuse one model/session. A host timeout returns manual fallback and terminates/restarts the optional child when necessary; it cannot interrupt a financial transaction because the child never owns one.

**Proposed task envelope:** `requestId`, `task` (`navigate` or `cashbook_category` initially), `schemaVersion`, `text`, `locale`, `contextDigest`, `candidateDigest`, `candidates: {id,label}[]`. Host adds the current currency and relevant source ID/version to its context digest, not to arbitrary model instructions. First-version limits: 8 KiB UTF-8 text, 12 choices including `none`, 96 characters per label, 32 KiB entire protocol frame; enforce tokenizer budgets as well. These are proposed host limits, not Laya capacity claims.

**Result envelope:** request/context/candidate digests, model manifest ID, calibration ID, outcome (`suggestion`, `clarify`, `unavailable`), candidate ID and finite probabilities. Reject unknown IDs, missing candidates, NaN/Infinity, invalid ranges, malformed envelopes, schema/model mismatch, truncation and stale source/currency/selection. Do not display entropy-derived confidence as probability of correctness. Model output cannot name an adapter to execute.

The model sees the shortest necessary user text and candidate labels, not the complete database, backup, hidden credentials or repository. User notes and labels are untrusted text. A guardrail low-risk score is not authorization. Fine-tuning does not replace this boundary.

**UI:** optional local-assistant setting; explicit Ask/Suggest action; loading/cancel state with no blocked navigation; accessible named buttons, keyboard and screen-reader status; EN/ML/AR and RTL. Existing workflows work while model is absent, loading, corrupt, disabled or timed out. Do not issue inference on every keystroke. On accepting a proposal, re-read current context and use the ordinary form; a separate Save/Confirm action remains required.

**Assets:** optional, explicit provisioning with verified manifest/hashes and an offline local-folder option; zero runtime auto-download on startup. Store outside Git and workspace backups. Manifest includes source/weight revisions, file sizes/hashes, tokenizer/config, export environment, runtime version, task schema, calibration and licenses. Check free space, install atomically and retain the previous verified bundle until replacement is usable. App updater publication and model publication are separate later actions.

## 7. Dataset and fine-tuning design

### Data ownership and task design

Do not train by dumping BillZen's source code, SQL database or backups into a model. Train labeled decisions representing desired tasks. Business rules and live records stay in code/local retrieval. Default dataset is synthetic or explicitly licensed, human-reviewed examples. Real notes, invoices, contacts and financial records require separate explicit opt-in and minimization; there is no automatic upload or feedback training.

Start with two separate task schemas: `navigate.v1` and `cashbook_category.v1`. Navigation labels map only to current supported forms, plus `clarify`. Category candidates come from the selected form's compatible active categories plus `none`; do not bake each merchant's private taxonomy into global weights. Questions, task descriptions, option order and candidate IDs are versioned. For dynamic candidate sets, evaluate both known labels and unseen merchant taxonomies.

Suggested initial evaluation budget: 500–1000 utterances spread across English, Malayalam script, Arabic and Manglish/code-switching, tasks, ambiguity and hard negatives. This is a planning budget, not sufficient evidence of any guaranteed error rate. Aim for at least 100 independent cases in each priority task/language slice before drawing an initial diagnostic conclusion; expand the corpus if these coverage goals exceed the budget. If pretrained results are insufficient, create an initial 2000–5000 labeled decision items and use learning curves before collecting more.

Preserve a source-case/group ID before producing multiple questions, paraphrases or option permutations. Split **whole groups** into train/dev/calibration/test (initial allocation 65/15/10/10), keeping merchant/template/conversation families separate where applicable. Hold out some synthetic merchants and label sets. Never copy the same note's variants across partitions.

The upstream default calibration splitter operates on flattened decision items, so correlated questions can leak. A BillZen wrapper must group-split first, reserve an external calibration set, disable the trainer's internal random calibration allocation, and explicitly fit/save calibration afterward. Confirm the exact pinned trainer APIs in the wrapper's tests. `--eval` is not an untouched final test if repeatedly used for model selection.

Required labels/cases include transfers versus expenses, loans/capital/refunds/advances, negation and historical/hypothetical text, unsupported B2/B3 intent, missing/archived/duplicate-name candidates, wrong currency, malformed/long text, Arabic digits, spelling variants, code switching, `none/clarify` and reordered options. Human adjudication decides ambiguous labels; teacher predictions are suggestions, never ground truth. Store provenance/license and split hashes without private records.

### Training experiments

1. Measure exact keywords, existing barcode/exact/fuzzy search and deterministic parser baseline.
2. Measure the pinned pretrained multilingual checkpoint with identical cases/candidates.
3. Compare a frozen-encoder/head-only adaptation with full fine-tuning, where hardware permits.
4. Compare `soft-ce` and upstream `rlcd`; use option shuffling with correctly remapped labels. Neither objective is assumed superior in this domain.
5. Use dev metrics for early stopping/selection; compare three seeds for promising candidates; inspect class-prior collapse and performance of `none/clarify`. Select the smallest reliable adaptation, not the largest training run.
6. Fit calibration on the reserved calibration groups and evaluate the final untouched test once for promotion. Report later retests as reused test evidence and refresh it before subsequent promotions.

Upstream exposes `encoder_lr`, `head_lr`, `freeze_encoder`, `shuffle_options`, seed, calibration allocation and both losses. Its defaults (including learning rates/epoch count) are starting configurations, not BillZen-optimal values. Log microbatch, accumulation and optimizer updates: `epochs * ceil(ceil(N_train / microbatch) / accumulation)`. Reduce microbatch on memory pressure without pretending it leaves the effective batch unchanged.

There is no demonstrated first-class LoRA/QLoRA recipe in the inspected trainer. Do not prescribe a causal-LLM adapter workflow to this encoder/head without a separate validated implementation. CPU training may be possible for a small head-only experiment; full encoder tuning should be profiled on an available suitable GPU. No hardware purchase, rental price or training duration is specified while hardware is unknown.

### Runtime calibration and export

Laya's maximum choice probability, entropy-based confidence and action-head probability are different quantities. Only evaluate the deployed representation. Use per-task/language/choice-count calibration where data supports it; missing or sparse calibration means host clarification, not an implicit threshold of zero. Estimate selective precision/coverage and uncertainty intervals, not only average accuracy or an impressive-looking score.

Export pinned tuned weights with the upstream Rust exporter and verify against Python. Compare tokenization, tensor/config shapes, option ordering, raw/calibrated probabilities, chosen IDs, `none` and threshold decisions. An argmax-only check is insufficient near a threshold. Establish a numeric tolerance on the same corpus and record threshold-adjacent flips; no unexplained flips pass. Implement only calibration transforms Rust actually reproduces, or supply a tested host transform. Do not silently omit per-language calibration.

Illustrative upstream export command after environment/weights are pinned (not executed in this research):

```bash
python laya-rust/tools/export_onnx.py /path/to/billzen-checkpoint --out onnx/billzen --verify
```

INT8 is a separate optimization experiment after unquantized parity. Re-measure accuracy, calibration, latency and peak RAM; re-calibrate after quantization. Disk reduction does not guarantee proportional RSS reduction. Save model/optimizer training outputs outside Git; keep only synthetic fixtures, code, manifests and reports in the repository.

## 8. Evaluation and go/no-go gates

These are **proposed acceptance criteria**, not achieved measurements. Phase 0 must name the reference desktop OS/CPU/RAM, runtime provider and available-memory ceiling before performance promotion.

| Dimension | Required evidence |
|---|---|
| Business safety | Zero model-triggered financial writes; every malformed/stale/unknown-ID proposal rejected; all existing no-effect draft and financial invariants pass |
| Utility | Compare against rules/fuzzy baseline and actual form completion; keep the feature only if it saves selection/typing effort without increasing correction burden |
| Routing quality | Initial target macro-F1 >= 0.90 in each supported language slice, with per-class confusion and `clarify` reported |
| Visible suggestions | Initial target selective precision >= 0.95, reporting accepted count, coverage and 95% uncertainty intervals; this point target alone is insufficient proof of low risk |
| Abstention | Ambiguity, unsupported intent, invalid context, truncation and missing calibration fall back; do not force coverage or auto-confirm |
| Probability quality | ECE, Brier, reliability curves, risk-coverage/AURC per task/language and option count; entropy is not labeled P(correct) |
| Runtime | Python/ONNX/host parity corpus, option permutations, no unexplained accepted/abstained threshold flips; corrupt assets fail closed |
| Performance | Initial warm p95 target <= 750 ms for a short note on the named desktop; record p50/p95/cold load/peak RSS/disk/CPU and queue behavior; revise target transparently if hardware cannot meet it |
| Responsiveness | Model load/inference never blocks ledger reads/writes or navigation; loading visible/cancellable; timeout/crash/offline produce usable ordinary forms |
| Privacy/offline | After explicit asset provision, demonstrate zero model network requests and no raw-note telemetry or private records in training artifacts/Git |
| Accessibility | EN/ML/AR+RTL, keyboard/screen reader/reduced motion, themes and responsive states, including unavailable/clarification flows |
| Platform acceptance | Exact packaged desktop binary and runtime libraries tested; hosted CI is not physical Windows/macOS/Android acceptance |

A 95% precision point estimate on a small set must not become a "95% guaranteed" UI claim. Report confidence bounds and failure examples. Financial safety derives from the boundary and validation, not the benchmark score.

## 9. Delivery sequence and boundaries

The [implementation plan](../superpowers/plans/2026-10-25-laya-billzen-integration.md) decomposes the work into evidence, dataset, tuning, runtime and UI sections. Only research/docs are delivered now. Later implementation should use the owner's inline execution preference with independent final review, coherent verified commits and actual remote CI reporting.

Desktop first means first prove the native ONNX path and exact packaging. Android later needs independent ABI/native-library compatibility (including applicable page-size support), model storage, peak RSS, battery/thermal/background behavior and physical-device tests. Desktop success does not imply mobile feasibility. Browser support is a separate later evaluation using a Web Worker, optional cache/storage and CSP review; do not route Android through a WebView inference path by default.

No release publication, account/cloud service, device synchronization, signing-credential discovery, real-data training or background self-learning is included. No fixed training cost or delivery date can be defensibly promised until Phase 0 measurements. B2/B3 remain separately designed and approved product work.
