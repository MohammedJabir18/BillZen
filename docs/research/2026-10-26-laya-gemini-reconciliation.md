# BillZen × Laya: reconciled feature design and Gemini-plan audit

Date: 2026-10-26, Asia/Kolkata. **Research/design only; no product implementation or model execution.** Owner wants a merged, evidence-based development plan and a prompt to execute in Antigravity. Preserve desktop-first, Android-later, unknown training hardware and inline implementation with independent final review.

## Evidence and authority

- Local BillZen HEAD at review: `67de7b1e752c988fdcb8a1af3010154034fc4245`, clean working tree. Product source is the B1-complete `9158c40`; later commit is documentation. Prior research CI [40163170427](https://github.com/MohammedJabir18/BillZen/actions/runs/40163170427) rechecked completed/success.
- Read the owner-supplied Gemini-generated pasted plan in full. Attachment SHA256: `fbb838e848686b32f3bb4f520e3a5ef4b127bf58f765e091984c7cc5b5d225d2`. Treat its code paths, performance statements and feature claims as proposals, not runtime evidence. No claim about the identity/quality of the model that produced it is needed to assess the plan.
- Re-read project memory, prior assessment/implementation plan, current migrations, backup serializer, customer history types/adapters, financial parser and CSP. Relevant Graphify inspection found159 matching nodes among2171 nodes/4833 edges; code-only graph lacks SQL/semantic coverage.
- Fresh upstream review pins [Laya `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`](https://github.com/NandhaKishorM/laya/tree/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea), observed2026-10-26. `pyproject.toml` is0.4.16. Previous assessment correctly described0.4.15 at7a77439; the new evidence below updates, rather than retroactively rewrites, that snapshot.
- Code revision still does not pin model weights, exported artifacts or crates.io contents. Resolve those before execution. No weights, private records or credentials were read/downloaded for this audit; only upstream source/docs were fetched into temporary storage.

## 1. Merge decision

Keep the previous financial boundaries and feasibility-first sequence. Bring forward Gemini's useful interaction ideas: a Quick Action entry, suggestion chips, shortlist-based matching, possible-duplicate review and optional later correction feedback. Divide these into independently useful releases, with the core two-feature assistant first. Do not equate a rich feature list with a single safe implementation slice.

The objective is faster and clearer business entry in EN/ML/AR/Manglish while remaining fully usable offline and without a model. All posting, money arithmetic, numbering, stock, debt and audit integrity stay in existing deterministic code. User acceptance may populate an ordinary form; a separate Save/Confirm posts it.

## 2. Claim-by-claim reconciliation

| Gemini proposal/claim | Decision and evidence-based correction |
|---|---|
| BillZen has nine migrations | Stale. `src-tauri/src/db/migrations/v10_invoice_draft_operations.sql` already exists; B1 drafts/editor, browser IndexedDBv6 and backup1.2 are implemented in source. Do not overwrite/reuse migration10. |
| Encrypted workspace backup exists | Incorrect for current source. `src/domain/backup_crypto.ts` implements canonical JSON/SHA256 integrity, not encryption. Checksums neither hide records nor authenticate against a deliberate rewriter. Do not upload backup1.2 assuming confidentiality. |
| `noul` is a built-in Yes/No/Unsure ternary class | Incorrect. [Example08](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/examples/08_noul_question.py) returns `P(true)`; host thresholds/abstention produce an unsure experience. For noul, confidence can be high for a confident false; it is not the probability the statement is true. |
| Use multilingual or typed-decisions interchangeably | Use multilingual as the first candidate. Typed-decisions is English and specialized to four other workflows; typed JSON is not evidence it understands ML/AR billing. [Model card](https://huggingface.co/convaiinnovations/laya-multilingual). |
| Training JSONL uses `target` | The inspected trainer accepts `state`, `questions`, `expected` or `gold` probability distributions. Use the pinned supported format and validate it, not an invented generic field. [Fine-tuning source](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/docs/finetune.md). |
| LoRA is available in the standard trainer | Not established by inspected trainer/guide. Compare frozen-encoder/head-only and full tuning with soft-CE/RLCD. A future LoRA port requires its own proof; do not invent flags. |
| Teacher agreement ensures label quality | Agreement with a teacher measures imitation, not accounting correctness. Use public/synthetic data with human-adjudicated labels, independent final test and provenance. No automatic paid/cloud teacher or private-data upload. |
| `LayaShortlist` automatically supplies embeddings | The [Rust SDK](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya-rust/README.md#routing-language-detection-email-and-shortlist) requires a caller-supplied embedder. Start with local exact/barcode/normalized/fuzzy retrieval; measure recall@k separately from reranking. A second embedding model has its own memory/license/quality cost. |
| Multi-question inference solves all fields in one pass | It is a real runtime capability, not a correctness guarantee. Direction/category/account/party have dependencies; shortlist/snapshot building can require earlier decisions. Stage suggestions and benchmark multi-question batching only after individual tasks work. No unvalidated one-pass auto-fill. |
| Auto-fill above0.75 | Reject universal0.75. Use task/language/choice-count evidence, calibrated scores and uncertainty bounds. Initial UI presents chips; explicit acceptance and separate financial confirmation remain at every score. |
| Run every300ms while typing | Defer. First release uses explicit Suggest/Ask, bounded queue and stale-result discard. Background inference adds heat/latency and can replace user edits; only revisit after actual responsiveness tests. |
| Infer party creation from a note | A name mention does not establish entity identity or creation intent. Return a shortlist/none/clarify. Creating/linking a party is an explicit ordinary form action. |
| Credit/reliability scores from customer cash history | Exclude. Current `CustomerCashHistory` has entries/received/paid/net cash movement, not invoice obligations, due dates or delinquency outcomes. Cash movement cannot establish creditworthiness. B3 data would be necessary but still not sufficient for a validated credit model. |
| Infer tax slab/e-invoicing readiness from product name | Exclude compliance determination. Jurisdiction, product classification, registration, dates and verified rules matter. Product-category suggestions are a separate later low-risk feature; tax remains explicit verified rules/user review. |
| Laya guards ledger integrity | Keep deterministic invariants authoritative. Semantic duplicate/direction warnings may supplement review but cannot establish correctness, block a valid entry or bypass idempotency/negative-balance checks. [Guardrail limitations](https://nandhakishorm.github.io/laya/guardrail-limitations/). |
| Score arbitrary amounts as suspicious | A1–5 score without labeled context/outcomes is not anomaly detection evidence. Start with explainable deterministic similar-record candidates; evaluate semantic reranking as a nonblocking aid. Never call it fraud detection. |
| Batch-audit all vouchers and find missing reversals | Defer bounded read-only review. A reversal is not necessarily expected, and batch throughput/long-window aggregation does not establish ledger semantics. User-reviewed flags must identify evidence; no automatic correction/reversal. |
| Rust/ONNX guarantees milliseconds, low RAM, Android readiness | Unmeasured. The pinned [model guide](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya-rust/MODELS.md) still says ONNX artifacts are not uploaded; multilingual export disk estimate~1.2GB. RAM/latency, exact Windows/macOS/Linux packaging and Android ABI/thermal behavior need separate evidence. |
| Browser adapter should default to HTTP service | Reject for core. Current CSP scopes connect-src to self/IPC; mandatory server conflicts with offline install simplicity. Browser initially returns unavailable. Later worker/WebGPU/WASM or a separately reviewed developer-only service may be assessed. |
| Save every override in `v10_ai_feedback.sql` and retrain | No migration in core. Migration10 is already occupied. Raw notes/user overrides are sensitive, and a correction is not automatically a verified label. Later opt-in local feedback needs retention/delete/export/backup design and a new additive migration if justified. No silent learning/upload. |

### A correction to our previous assessment

Rust **now ports `min_confidence` and batch/long prediction**, unlike the0.4.15 snapshot. The [current SDK confidence section](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya-rust/README.md#abstention-min_confidence) gates on `answer_confidence=max(p)` and exposes passed/abstained/unevaluated. However, a missing bucket without a default uses threshold0.0, which gates nothing. BillZen must fail closed for missing calibration and never treat unevaluated as passed.

Histogram calibration and per-language temperatures remain documented gaps. Routing still targets Python0.4.14 behavior. Cargo package metadata remains `laya-onnx`0.1.0 despite source changes; do not assume an identically named published crate contains this exact source's features. Pin and prove the dependency selected for deployment. Upstream Rust parity CI is advisory; a green repository page is not evidence that every port/checkpoint cell passed. None of these source improvements replace BillZen runtime parity tests.

## 3. Revised release structure

| Release | Features | Required gate |
|---|---|---|
| A: core desktop assistant | Quick Action routing to supported forms; Cashbook category chips after direction selection; optional assistant status/off switch | Measured pretrained/tuned model, native parity, host checks, manual fallback, no financial writes |
| B: controlled entry assistance | Explicit product/customer/party/account candidate selection; proposed amount/date only through strict host parser and review; report-filter suggestions | A accepted; independent shortlist recall and parser tests; no auto-link/create or SQL generation |
| C: review assistance | Explainable possible-duplicate/direction notices; later product-category/help-topic routing | Labeled false-positive evaluation; nonblocking review; no automatic reversal or tax decisions |
| D: portability and optional learning | Android/browser feasibility; separately approved opt-in correction data | Hardware/privacy/retention/backup/runtime plans and physical-device evidence |

Release A is the initial Antigravity implementation scope. B/C/D are planned backlog, not automatically authorized by the starter prompt. Do not add credit scoring, compliance classification, cashflow forecasting, OCR/voice generation, sync or invoice finalization through this work.

### Precise interaction policy

- Quick Action routes only to existing navigation/form intents. Transfer and receipt/payment are distinct. Negated/hypothetical/unsupported text returns clarification. It cannot call a posting command.
- Category suggestions use the existing selected direction and compatible active candidates. The model never flips an edited direction/account/party silently. `none` remains a valid result.
- Later multi-field proposals track each field's evidence/source and acceptance separately. Explicitly chosen fields are not replaced; arrival after editing invalidates or refreshes the proposal.
- Amount/date/entity extraction is not furnished by choice output. For Release B, normalize only specified digit formats and feed a single unambiguous numeric span into existing `parseToMinorUnits`; INR/KWD exponents remain bound to live currency. Multiple numbers, mixed currencies, ambiguous dates or unsupported number words require manual review. Do not change the global financial parser to accept arbitrary narration.
- Full histories do not go into a model by default. Duplicate candidate retrieval must compare same company/currency/amount/direction and bounded dates plus account/party where available, using existing reversal/transfer semantics. "Last five entries" is an arbitrary and incomplete candidate policy. Render matching records/reasons; no unsupported anomaly score.
- No auto-reminder transmission or external messages. A future reminder feature has separate consent/product requirements; it cannot be inferred from a cashbook note.

## 4. Runtime and data design carried forward

Preserve the [prior detailed assessment](2026-10-25-laya-billzen-assessment.md)'s dedicated Rust AI-process boundary: private bounded stdio, one lazy-loaded model, no DB path/write APIs/raw SQL, no HTTP listener, one active/two queued, stale-context digests, verified optional assets and no inference in React/SQLite worker. Read candidate snapshots then release the DB operation. Cancellation means discarding results; a hard deadline requires child termination, not merely dropping an async future.

Use a single multilingual checkpoint initially with its default token budget. Enforce text/frame/choice/label limits plus actual token spans. Twelve candidates is a host maximum, not a guarantee every long Malayalam/Arabic set fits; decline if options collapse/truncate. Local retrieval is independent from Laya; no hard dependency on an embedding model.

Model absence/loading/crash/corruption, disconnected network, unsupported runtime and low-quality results must all leave ordinary app flows working. Settings toggles optional AI; download/provision is explicit, versioned and hash-verified, with an offline-folder path. Build-time native-library downloads and asset preparation must be recorded separately from offline end-user inference.

Keep models/transient requests out of workspace backup1.2 and Git. Do not add an AI feedback database table to core. No raw narration logging. Even hashes of short predictable notes can be sensitive; do not call hashed data anonymous.

## 5. Training and evaluation refinements

1. Hardware inventory and resource ceiling precede weights/export/tuning. Resolve weight revision/tokenizer hashes and licenses independently of source SHA. No paid rental or substantial training run starts based on invented hardware assumptions.
2. Build a reviewed synthetic diagnostic corpus, initially500–1000 cases across EN/ML/AR/Manglish, supported tasks, hard negatives and unseen merchants. This budget is a start; expand until each priority task/language slice has sufficient independent observations. Do not advertise small-sample precision as a guarantee.
3. Compare rules/exact/fuzzy baseline with pretrained Laya. Tune only if the shortfall is semantic rather than an invalid schema, retrieval miss or parser bug. Skip training when pretrained is adequate.
4. If needed, start with2000–5000 human-reviewed synthetic/lawfully usable decision items; evaluate learning curves, head-only/full and soft-CE/RLCD. Teacher drafts can save labeling effort but require adjudication. No first-class LoRA support was found in the inspected path.
5. Group-split original cases before paraphrases/questions/permutations (65/15/10/10 train/dev/calibration/test). The upstream random flattened calibration splitter is not a safe substitute. Disable internal calibration allocation and fit on separate grouped calibration items. Preserve `expected` label IDs through shuffles.
6. Report per-task/per-language confusion, macro-F1, precision/coverage, ECE/Brier, uncertainty intervals and hard negatives. Proposed initial routing macro-F1>=0.90 and visible selective precision>=0.95 are targets, not observed. Check coverage/correction burden and compare the baseline; accept no feature merely because its score passes.
7. Calibrate on supported deployed transforms; probability, entropy and noul direction are distinct. Missing/sparse calibration abstains. Test actual Python/ONNX/host tokenizer, probability and threshold parity, including option permutation and near-threshold flips. Rust gate availability does not remove these checks.
8. Measure warm p95 (initial target<=750ms for a short note on named hardware), cold load, RSS/CPU/disk and queue behavior. The memory ceiling is hardware-specific and recorded before promotion. Test INT8 separately only if needed; re-evaluate/recalibrate afterward.

## 6. Alternatives considered

- **Immediate multi-field auto-fill and batch scoring:** broad apparent value but conflates extraction, retrieval, classification, financial semantics and unsupported credit/compliance claims. Reject as the first release.
- **Optional native typed assistant:** best fit with offline/Tauri architecture and bounded decisions; selected subject to benchmark/parity. Sidecar packaging adds work but isolates model faults from the financial process.
- **Mandatory local/cloud HTTP inference:** easier prototype access but adds startup/service/security/network dependencies and CSP changes. Not selected for the product; a future explicit developer-only experiment must not become a mandatory browser backend.

## 7. Handoff

The [revised execution plan](../superpowers/plans/2026-10-26-laya-reconciled-desktop.md) governs new work. The [Antigravity starter prompt](../prompts/2026-10-26-antigravity-laya.md) is self-contained about authority and initial scope; pasting it starts feasibility/dataset development toward Release A. It does not authorize B/C/D, external publication or private-data training. Existing seven-task plan remains useful detailed reference where not superseded.

No inference/training/hardware benchmark, application runtime installation, business-data migration or release was performed in this research session. The owner should review the supplied plan before choosing to paste the execution prompt into Antigravity.
