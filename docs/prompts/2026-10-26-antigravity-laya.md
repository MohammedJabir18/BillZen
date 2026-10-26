# Antigravity execution prompt: BillZen optional desktop Laya assistant

Copy the text inside the code block into Antigravity after reviewing the linked design/plan. This is a starter instruction from the owner when pasted there, not evidence that this chat implemented the feature. Technical prompt is English for precise execution; user-facing updates must be Malayalam with important technical words in English.

```text
Work in /home/jabir/Coding/My Projects/BillZen.

I want you to implement Release A of the optional offline Laya assistant using the reviewed project documents below. Desktop first; Android later. Training hardware is not predetermined. Implement inline, with an independent final review. This prompt authorizes the scoped development work, local synthetic-data evaluation and necessary isolated model preparation; it does not authorize app/model publication, paid services, private-data upload, signing-credential discovery or the later feature backlog.

1. RESTORE CONTEXT BEFORE EDITING

Read AGENTS.md, brain/README.md, brain/session-handoff.md, brain/decisions.md, recent brain/sessions.md entries, the current-status notice in brain/architecture.md, and relevant Graphify dependencies. Load brain/conversation-history.md only if needed. Follow applicable project-local and /home/jabir/.agents/skills guidance.

Read these documents in order:
- docs/research/2026-10-26-laya-gemini-reconciliation.md
- docs/superpowers/plans/2026-10-26-laya-reconciled-desktop.md
- docs/research/2026-10-25-laya-billzen-assessment.md
- docs/superpowers/plans/2026-10-25-laya-billzen-integration.md
- docs/architecture.md, docs/roadmap.md
- docs/invoice-drafts-implementation.md and the linked B1 specs as needed.

The 2026-10-26 documents override conflicting Laya recommendations in the 2026-10-25 documents. Current source/tests and latest owner instructions override old chronological memory. Do not blindly implement the pasted Gemini plan: its errors are audited in the reconciliation document.

Inspect git status/log and the actual component/schema/command paths. Preserve all existing user work. B1 invoice drafts are already implemented in source; migration10, browser IndexedDBv6 and backup1.2 already exist. Do not replay B1 or overwrite a migration. Published desktop0.1.6 and Android0.1.5/code1010 do not imply current source is released/installed. Recheck live Git/release evidence before making status claims.

Begin with two short Malayalam bullets: where we left off and the immediate next step. Then execute the current eligible task rather than only restating this prompt. Keep a checked progress ledger; do not mark future work complete.

2. RELEASE A SCOPE

Deliver only:
A. An explicit-action Quick Action assistant that interprets EN/ML/AR/Manglish and proposes an existing supported route/form: receipt, payment, transfer, draft, stock or reports, with clarify for ambiguity/unsupported intent. It must never post a command.
B. Cashbook category Suggestion Chips after the user has selected receipt/payment direction, restricted to compatible active candidates plus none. Accepting a chip changes a reviewed field only; a separate ordinary Save/Confirm posts the voucher.
C. Optional assistant Settings/status, model provision/off/unavailable/loading/cancel states, strict native runtime/host policy and usable manual fallback.

Release B/C/D are backlog, not part of this execution: multi-field amount/date/party/account extraction and reranking, report-filter assistant, duplicate/batch review, product-category/help routing, Android/browser runtime and feedback training. Do not add credit/reliability scoring, tax/e-invoicing decisions, OCR/voice, synchronization, supplier accounting or B2/B3 posting.

3. INVARIANTS

Laya is a typed decision engine, not unrestricted text/entity generation or a financial authority. Every suggestion alone has zero stock/cash/debt/final-number effects. Preserve existing integer minor-unit/quantity math, currency/version binding, idempotency, audit/reversal/transfer semantics, negative-balance confirmation, draft recovery and backup parity. Never auto-create/link parties, auto-reverse, generate SQL or bypass an existing business validator.

Do not silently overwrite user-edited fields/direction/accounts. Bind proposals to request ID, company/currency/source version, current form state, task schema and candidate digest; discard stale results after edits or archive/currency changes. Suggestions are optional and explainable through their task/candidates, without invented model-generated reasoning.

Do not use a universal confidence > 0.75 auto-fill rule. Use measured task/language/choice-count calibration and explicit user acceptance; no score permits automatic financial posting.

4. SOURCE AND MODEL PROVENANCE

Reviewed upstream Laya source is b9fe351ce81e2d974bca2bf219c1e4030c0a05ea (Python metadata0.4.16), following the older7a77439 snapshot. Revalidate source/API compatibility and pin any deliberately selected revision; do not silently follow moving main. Rust package metadata remains laya-onnx0.1.0, so confirm the resolved crate/source actually has the reviewed APIs.

Start with one pinned convaiinnovations/laya-multilingual checkpoint. Resolve its independent immutable weight revision, tokenizer/config hashes, license/NOTICE and export provenance. Typed-decisions is not a multilingual substitute. The inspected Rust model guide says ONNX artifacts are not uploaded; export/verify locally if needed. Record actual availability rather than assuming a download example succeeds.

Rust min_confidence is now ported, but missing bucket/default coverage can gate at0.0; unevaluated is not passed. Histogram/per-language calibration gaps remain. BillZen host policy must abstain for missing/sparse calibration. Verify probability and threshold behavior on the actual deployed backend, not only Python or upstream advisory CI.

5. EXECUTE FEASIBILITY AND DATASET WORK FIRST

Inventory CPU/OS/RAM/storage/accelerator and define a conservative memory/run budget before heavyweight operations. No hardware purchase/rental or credential probing. Use an isolated environment and model cache outside tracked business/project artifacts. Record download sizes, free space and cold/warm performance. Model/library preparation may use the network; normal application use must work fully offline afterward.

Implement a model-free grouped synthetic dataset/evaluation harness even if model hardware is unavailable. Baseline deterministic rules/local search versus pretrained Laya on identical reviewed EN/ML/AR/Manglish cases. Include transfers versus expenses, negation/quotes/hypotheticals, unsupported future intents, ambiguity, wrong/missing candidates, long labels, Unicode and option permutations.

Use supported state/questions/expected JSONL or gold teacher distributions. Preserve original case IDs and group-split train/dev/calibration/test65/15/10/10 before flattening, paraphrasing or option shuffling. Keep final test untouched. Built-in random flattened calibration splitting is insufficient. Use synthetic/public licensed data and human adjudication; teacher agreement is not truth. No real database/backup/contact/narration upload or automatic cloud/paid teacher calls.

Measure pretrained first. Tune only if needed and retrieval/schema/rules defects do not explain the shortfall. Start with a small measured pilot; compare frozen-encoder/head-only and full tuning where feasible, soft-CE/RLCD and multiple seeds for finalists. Estimate resource/time before a substantial run. Do not invent LoRA/QLoRA support or train simply to tick a checkbox. Separate grouped external calibration from selection/final test, and record effective optimizer updates.

Report per-task/language confusion, macro-F1, selective precision/coverage, ECE/Brier and uncertainty intervals. Initial targets: routing macro-F1>=0.90 per required language slice; visible-suggestion selective precision>=0.95 with accepted counts/coverage and uncertainty. These are promotion targets, never performance claims before measurement. Warm short-note p95 target<=750ms on named hardware; record cold load/RSS/CPU/disk and the chosen memory ceiling. Keep the feature only if it improves real selection effort without excessive corrections.

If weights/hardware/accuracy/parity/resource gates fail, document the exact no-go and completed model-free work. Do not fabricate results, substitute mock predictions as production or force low-quality suggestions. Continue unaffected work; ask only for genuinely missing external input, not repeated general permission.

6. RUNTIME/PROTOCOL

Use the file/interface contracts in the revised plan and reuse existing adapters/components. Prefer one lazily loaded Rust ONNX AI child over private bounded stdio, managed by Tauri. Never run inference on React's main thread or the serialized SQLite worker. Read a bounded candidate snapshot then release the DB operation before inference. Child has no DB path/write commands, shell, arbitrary tools or listening HTTP port.

One active and at most two queued requests; explicit Suggest/Ask rather than inference every300ms. Drop superseded work and discard late results. Hard timeout/crash isolation requires stopping/restarting the optional child; cancelling a future alone does not cancel a blocking model call.

Host-owned task enums initially navigate/cashbook_category only. Enforce8KiB UTF-8 input,12 candidates including none,96 characters per label,32KiB frame, plus actual tokenizer/head/option-span budgets. Reject truncation/collapsed options, malformed JSON, unknown/duplicate IDs, invalid probabilities, model/schema/calibration mismatch and stale digests. Twelve choices is a maximum, not guaranteed token fit. Confidence, max probability and noul P(true) are different quantities.

Do not add an embedding model merely because LayaShortlist exists: its embedder is caller-supplied. Small active category sets/local deterministic retrieval suffice for the core; account for any future embedder independently.

Only scoped assistant status/suggest/cancel IPC. Browser returns unavailable in Release A and keeps ordinary workflows. No mandatory Python runtime, HTTP server, CSP widening or runtime auto-download. Models install explicitly with verified manifest/hash, offline local-folder option and safe replacement rollback. Distinguish build-time library fetches from offline app inference.

7. UX AND DATA

Preserve premium existing UI, EN/ML/AR+RTL, keyboard/focus, screen-reader loading/results, themes, responsive/short windows and reduced motion. Explain unavailable/clarify states and keep normal entry working while model loads or fails. No raw-text logging/telemetry, no AI feedback migration in core, no silent self-learning. Checksummed backups are not encrypted. Keep weights/transient assistant state outside Git and portable workspace backup1.2.

8. VERIFICATION/DELIVERY

Use TDD for actual implementation and follow each task's red/green/verification steps. Ordinary CI uses tiny synthetic fixtures/fake-child tests; real-weight accuracy/parity/performance gets separately identified reports. Test option/candidate mapping, sparse gate buckets, late user edits, model corruption/absence/crash/timeout, queue limits and ledger responsiveness. Prove zero financial effects from suggestions and preserve ordinary manual Save/recovery/backup.

Run relevant Vitest/Cargo/build and synthetic browser/native checks; serialize browser scripts sharing ports. Test the exact packaged desktop candidate and native libraries, not only the dev server. Report physical Windows/macOS/Android limitations honestly. Fix failures before marking sections complete.

After each coherent verified section: inspect diff, stage only intended files, inspect git author/committer against AGENTS.md owner identity, commit/push current intended branch using existing auth, verify remote SHA, inspect actual CI. Never force-push/reset user changes, bypass safety failures or publish releases. Request an independent final reviewer before declaring Release A complete; if unavailable, report that limitation rather than inventing a review.

Maintain brain session/handoff/progress evidence, marking measured versus proposed. Refresh Graphify with local code-only extraction:
graphify . --obsidian --obsidian-dir ./brain --update --code-only
Never retry semantic upload; record missing SQL coverage. End each milestone with exact completed scope, changed files, actual checks/CI, unresolved gates and next step. Clearly distinguish source implementation, test candidate, installed app and published release.

Start now with context restoration, Task1 feasibility/provenance and Task2's model-free synthetic dataset/evaluation foundation. Continue toward Release A only as the documented gates pass. Do not jump straight to UI auto-fill or bulk fine-tuning.
```
