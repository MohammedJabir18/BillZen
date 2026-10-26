# BillZen Laya Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline, preserving the owner's execution preference; use independent final review before completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish whether an optional local Laya assistant can improve desktop navigation and Cashbook category selection, then integrate only a validated candidate without giving AI financial write authority.

**Architecture:** A bounded host-owned task protocol feeds one optional Rust ONNX AI process; host validation/calibration converts its answer into a nonbinding UI suggestion. Existing adapters/domain/serialized database worker retain all writes. Python is an isolated research/training/export dependency, not a required BillZen user runtime.

**Tech Stack:** Existing React/TypeScript/Tauri/Rust/SQLite; proposed pinned Laya multilingual, Python training tools and Rust ONNX Runtime. Resolve exact weight, toolchain and native dependency versions in Task 1.

**Spec:** [Evidence and design assessment](../../research/2026-10-25-laya-billzen-assessment.md).

**Status:** Proposed, not approved for implementation. Research/documents only have been completed. Owner chose desktop first, Android later; hardware undecided. All checkboxes below are future work. Preserve existing inline execution and independent final review if subsequently approved.

> **2026-10-26 successor:** Use the [reconciled desktop plan](2026-10-26-laya-reconciled-desktop.md) for new execution and this plan as a detailed reference only where consistent. In particular, newer reviewed Rust source ports `min_confidence`; blanket claims of missing abstention below describe the older snapshot. The [reconciliation](../../research/2026-10-26-laya-gemini-reconciliation.md) defines Release A and keeps expanded features in separately gated backlog.

## Global Constraints

- Model-triggered stock/cash/debt/final-number writes: zero. Suggestions never execute a business command; ordinary user Save/Confirm remains separate.
- Keep the app offline, responsive, accessible, multilingual and data-preserving; EN/ML/AR+RTL and manual workflows remain available without AI.
- One active inference and at most two queued requests; no inference on the UI thread or serialized SQLite worker.
- Initial host limits: 8 KiB UTF-8 text, 12 choices including `none`, 96 characters per label, 32 KiB entire protocol frame; also enforce tokenizer budgets.
- Missing/sparse calibration, malformed output, truncation or stale context means clarification/unavailable, never permissive acceptance.
- No automatic startup model download, real-business-data upload, telemetry training, mandatory cloud account, synchronization or release publication.
- Desktop first; Android and browser are separate gated follow-ups. B1 source is complete; B2/B3 remain separately gated.
- Keep weights/databases/private datasets/build outputs out of Git. Commit/push coherent verified sections using configured owner identity; verify remote SHA and report actual CI.

## Review Focus

- Negation, quoted/hypothetical instructions and unsupported credit/return requests: classify as clarification instead of a financial action (Tasks 2 and 6).
- Live currency/category/archive changes while a request is in flight: discard stale proposal, preserving entered form values (Tasks 4 and 6).
- Long Malayalam/Arabic candidate labels and reordered options: reject truncation and preserve ID-to-probability mapping (Tasks 2–4).
- Optional runtime crash, corrupt model, OOM or timeout during ordinary ledger use: manual workflows continue without data loss (Tasks 5 and 7).
- Sparse calibration or backend probability differences near a threshold: abstain rather than display unsupported confidence (Tasks 3–5).

## File map and deliverable boundaries

Names below are proposed new files; inspect current source before execution. Do not create empty scaffolding now. Existing paths are listed only where integration is expected.

| Files | Responsibility |
|---|---|
| `tools/laya/requirements.lock`, `tools/laya/README.md`, `tools/laya/asset_manifest.schema.json` | Reproducible isolated preparation and asset provenance |
| `tools/laya/prepare_dataset.py`, `tools/laya/tests/test_dataset.py` | Grouped datasets, permission/provenance and split validation |
| `tools/laya/evaluate_billzen.py`, `tools/laya/tests/test_evaluation.py` | Rules/model baseline, sliced metrics and promotion reports |
| `tools/laya/train_billzen.py`, `tools/laya/tests/test_training.py`, `tools/laya/export_release.py` | Explicit external calibration, training/export parity |
| `tests/fixtures/assistant/` | Synthetic grouped golden cases and tiny protocol fixtures; no weights/private data |
| `docs/research/laya/` | Dated manifests, measured benchmark reports and go/no-go decisions |
| `src/types/assistant.ts`, `src/domain/assistant_policy.ts`, `src/domain/assistant_policy.test.ts` | Task/proposal types, acceptance and stale-context policy |
| `crates/billzen-ai-host/` | Standalone Rust inference executable with framed stdio and no database dependency |
| `src-tauri/src/assistant/{mod,manager,protocol,manifest}.rs` | Child lifecycle, strict protocol, verified local assets and timeout handling |
| `src-tauri/src/commands/assistant.rs`, existing command registration/capabilities | Three narrowly scoped IPC commands; no business-write proxy |
| `src/adapters/assistant.ts`, `src/adapters/assistant.test.ts` | Native assistant access and browser unavailable fallback |
| `src/components/AssistantSuggestionCard.tsx`, `src/components/AssistantPanel.tsx` | Optional explicit-action UI and nonbinding proposals |
| Existing `src/App.tsx`, navigation/Cashbook form, Settings and i18n resources | Minimal integration at verified current component paths; no financial algorithm rewrite |
| `scripts/verify_assistant_ui.js`, `scripts/verify_native_assistant.js` | Synthetic end-to-end, fault and ordinary-flow checks |

### Task 1: Reproducible feasibility evidence (Phase 0)

**Files:** preparation/manifest files and `docs/research/laya/desktop-feasibility.md`.

**Consumes:** assessment's code SHA, owner desktop-first preference and available machine inventory. **Produces:** a pinned manifest, environment lock and recorded reference hardware/performance budget, or an explicit no-go report.

- [ ] Inventory OS/CPU/RAM/free storage and available accelerators without purchasing/renting or probing credentials; record the reference machine and acceptable peak-RSS ceiling before model testing.
- [ ] Resolve immutable Hugging Face weight revision and all asset hashes; record source SHA, license/NOTICE/tokenizer provenance and actual artifact availability. Validate the manifest against its schema; missing revision/hash must fail.
- [ ] Prepare an isolated Python environment from inspected upstream dependencies and lock versions; use safe weight loading. Keep packages/weights out of BillZen Git and product installation.
- [ ] Run the pinned pretrained multilingual reference on a small synthetic smoke corpus; record cold/warm timings, p50/p95, RSS and errors. No training yet.
- [ ] Verify Rust toolchain, edition-2024 crate, `ort` pre-release/native-library and CPU provider compatibility in an isolated prototype. Record resolved versions and distribution obligations.
- [ ] Write a go/no-go decision against available hardware. A no-go completes this evidence section and stops downstream product work; it is not a failed test to bypass.
- [ ] Inspect diff/provenance, commit/push the reproducibility/report section and verify remote SHA/CI. Do not publish model or app assets.

### Task 2: Grouped dataset and honest baseline (Phase 1)

**Files:** dataset/evaluation tools and tests, synthetic fixtures, `docs/research/laya/baseline.md`.

**Consumes:** Task 1 manifest. **Produces:** versioned `navigate.v1` / `cashbook_category.v1` cases, split hashes and comparable baseline reports.

- [ ] Write `test_dataset.py` assertions: a case family cannot cross train/dev/calibration/test; each option ID is unique; shuffled gold follows its ID; private-data provenance is rejected; `none/clarify`, EN/ML/AR/Manglish and unseen merchant candidates are represented. Run the tests and observe failure before implementation.
- [ ] Implement `prepare_dataset.py` to validate cases and split whole groups 65/15/10/10 before flattening. Store seed, schema/version and split hashes; enforce an untouched final test partition.
- [ ] Build human-reviewed synthetic cases covering negation, quoted commands, unsupported B2/B3, transfers, ambiguous names, archived options, Arabic digits, long labels and option permutations. Begin with the assessment's evaluation budget and expand for missing slice coverage.
- [ ] Write failing evaluation tests for sliced counts, confusion matrices, macro-F1, selective precision/coverage, ECE/Brier and uncertainty intervals. Implement the report generator and compare rules/fuzzy baseline with the pinned pretrained model using identical cases.
- [ ] Run `python -m pytest tools/laya/tests/test_dataset.py tools/laya/tests/test_evaluation.py`; require all assertions pass and review false positives manually. Benchmark output records dataset/model revisions and actual hardware.
- [ ] Decide whether pretrained already meets utility/quality gates or whether Task 3 is warranted. Commit/push the coherent dataset/baseline section, verify remote SHA/CI; never label a proposed metric achieved without a report.

### Task 3: Conditional adaptation and calibration (Phase 2)

**Files:** training/export tools and tests; `docs/research/laya/adaptation.md`; metadata only in Git.

**Consumes:** grouped Task 2 partitions and hardware decision. **Produces:** either a selected unchanged pretrained candidate or a tuned candidate, external calibration artifact and verified export manifest.

- [ ] If the baseline passes, record why tuning is skipped and proceed to export/parity. Otherwise collect/adjudicate the initial labeled training corpus and use a learning curve before scaling it.
- [ ] Write failing `test_training.py` tests: the wrapper disables internal flattened random calibration; training never sees calibration/test groups; shuffled expected indices map back to stable IDs; unsupported calibration transforms reject deployment.
- [ ] Implement wrapper calls against the exact pinned trainer API. Compare head-only/full tuning where feasible, soft-CE/RLCD and three seeds for finalists. Record effective batch/updates, dev early-stop selection and class-collapse diagnostics; do not use final test for repeated tuning.
- [ ] Fit calibration on the external reserved groups, export selected assets and test Python versus ONNX probabilities/ID ordering/truncation/threshold behavior on a parity corpus. Include deliberately sparse buckets and threshold-adjacent cases; Rust's missing per-language/abstention features require explicit host support or rejection.
- [ ] Run `python -m pytest tools/laya/tests`; require all tests pass. Generate held-out and runtime reports against the assessment's proposed gates, with accepted counts and uncertainty intervals. Record any unmet gate honestly.
- [ ] Test INT8 only as a separately compared candidate if unquantized resource cost warrants it; re-calibrate and repeat parity/quality measurements. Select one validated bundle, or stop with no-go. Commit/push code/reports/manifests, excluding weights and private data; verify remote SHA/CI.

### Task 4: Typed host policy and stale-context rejection (Phase 3a)

**Files:** TS assistant types/policy/tests and protocol fixtures.

**Interfaces:** `AssistantTask` carries request/task/schema/text/locale/context and candidate digests plus `{id,label}[]`. `AssistantProposal` is a tagged union of suggestion/clarify/unavailable carrying the same request/digests and pinned manifest/calibration IDs. `validateAssistantProposal(task: AssistantTask, raw: unknown, currentContextDigest: string): AssistantProposal` returns an unavailable/clarify result for every invalid/stale input; it never calls an adapter. Keep exact TS/Rust field names in a shared JSON protocol fixture.

- [ ] Write failing `assistant_policy.test.ts` cases for unknown IDs, reordered ID mapping, missing candidates, NaN/Infinity/out-of-range probabilities, schema/model/calibration mismatch, oversized frames/text/labels/choice sets, truncation and live currency/category/archive digest changes.
- [ ] Implement strict task/result validation and deployment-supported calibration/abstention policy using Task 3 artifacts. Sparse/unrecognized buckets clarify. Acceptance returns data only; do not import financial write adapters.
- [ ] Run `npx vitest run src/domain/assistant_policy.test.ts`; require all cases pass. Audit dependencies for a pure policy boundary and add a fixture proving late superseded results cannot replace current suggestions.
- [ ] Commit/push the policy section and verify remote SHA/CI before UI work.

### Task 5: Optional desktop inference process (Phase 3b)

**Files:** AI-host crate, native assistant modules/commands, scoped capabilities and adapter tests.

**Interfaces:** stdio request/result use Task 4's exact envelopes. IPC is limited to `get_assistant_status()`, `suggest_assistant_decision(task)` and `cancel_assistant_request(requestId)`; expose no arbitrary question schema, executable path or business write command from WebView. Native host constructs/validates approved task schemas. Browser adapter returns unavailable at this phase.

- [ ] Write failing Rust protocol/manager tests for 32-KiB framing, bad JSON/IDs, checksum mismatch, absent model, child exit, timeout, cancellation and one-active/two-queued bounds. Include a concurrent synthetic ledger read/write that completes while fake inference is blocked.
- [ ] Implement a stdio-only child with one lazily loaded verified session and no database dependency. Native manager owns asset paths/manifest validation, explicit provision, queue/restart/timeouts and stale-result suppression; the UI cannot supply paths. No inference on SQLite worker.
- [ ] Add scoped IPC and adapter tests for unavailable browser/manual fallback. Verify native schema limits match TS fixtures and child does not open a listening port or enable runtime automatic downloads.
- [ ] Run `cargo test --manifest-path crates/billzen-ai-host/Cargo.toml`, `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/adapters/assistant.test.ts src/domain/assistant_policy.test.ts`; require relevant tests pass. Model-free fake-child tests belong in ordinary CI; actual-weight parity runs produce a separately identified report.
- [ ] Benchmark the real exported bundle on the reference desktop; record cold/warm p50/p95/RSS/queue and kill/restart results. Fail promotion if the approved memory/utility budgets or parity gates are unmet. Commit/push runtime section and verify remote SHA/actual CI.

### Task 6: Accessible nonbinding suggestions (Phase 4)

**Files:** assistant UI, minimal Settings/navigation/Cashbook integration, translated copy, UI verification script.

**Consumes:** validated proposal and optional runtime status. **Produces:** explicit-action navigation suggestions and category suggestions in an existing selected-direction form. Report filtering, candidate reranking and duplicate notices are follow-up scopes after these are validated, not hidden additions to this task.

- [ ] Write failing UI checks for explicit Ask/Suggest, loading/cancel/clarify/unavailable states, keyboard and screen-reader status, EN/ML/AR+RTL, reduced motion, themes and narrow viewport. Check negated/unsupported intent cannot submit anything.
- [ ] Implement optional assistant setting and cards showing a translated suggested action/category. Accepting fills/opens an ordinary form; saving requires its separate existing confirmation. Re-read digest/context before acceptance; currency/archive changes discard suggestions without altering unsaved values.
- [ ] Add end-to-end assertions: no balances, stock, debt, numbering or draft data changes from any suggestion; normal Save still follows existing validation/negative-balance/idempotency rules. Verify model-disabled workflows and draft recovery remain usable.
- [ ] Run `npm test`, `npm run build`, the new `node scripts/verify_assistant_ui.js` and relevant existing Cashbook/draft/customer/transfer browser checks serially where ports overlap. Require all relevant checks pass; record real limitations.
- [ ] Commit/push UI section and verify remote SHA/actual CI.

### Task 7: Exact-package acceptance and independent review (Phase 5)

**Files:** native verification script, measured acceptance report, brain handoff/session evidence and packaging configuration only if required.

- [ ] Extend synthetic native probes with absent/corrupt model, cancellation, forced child crash/timeout, offline startup, asset replacement rollback and ledger responsiveness during inference. Do not read real business records for fixtures.
- [ ] Test the exact packaged desktop candidate and its native runtime libraries; measure the reference hardware budgets and every quality gate from the assessment. Verify manual workflows and backup1.2 restore independently of model assets. Start with available Linux; explicitly track physical Windows/macOS as unverified until tested.
- [ ] Request independent final review of source, boundary, model/data provenance, probability parity, UI states and evidence. Fix actionable findings with regression evidence before marking implementation complete.
- [ ] Update memory/architecture for actual implementation, run local code-only Graphify, commit/push the verified section and verify remote SHA/actual CI. Report source, packaged/tested, installed and released states separately. Publication requires a separate instruction.

## Follow-up plans after desktop evidence

- **P1 utility:** evaluate report-filter routing and shortlist reranking as separate tasks with allowlisted queries, deterministic date/amount parsing and explicit selections. No generated SQL, debt inference or auto-linking.
- **P2 assistance:** duplicate notices, stock reasons and curated help routing require separate labeled evaluations; no fraud/credit claims.
- **Android:** separate design/implementation plan after actual desktop evidence. Gate ABI/native ONNX library compatibility, applicable page-size requirements, model download/storage, RAM, battery/thermal/background and physical-device accessibility/offline tests. Defer if the model does not fit; retain manual operation.
- **Browser:** separate Web Worker/WebGPU/WASM/cache/CSP plan if justified. No assumption that desktop ONNX or Android WebView shares browser feasibility.
- **Future financial products/OCR/voice:** retain B2/B3/import/OCR/ASR design gates. These are not supplied by Laya and not implicitly approved by this plan.
