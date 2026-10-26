# BillZen Reconciled Laya Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline implementation. Preserve independent final review before declaring completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver optional desktop Quick Action routing and Cashbook category suggestions only after evidence shows they improve entry without changing financial authority.

**Architecture:** Host-owned typed schemas, local retrieval and calibration policy feed a separate Rust ONNX process over bounded stdio. Suggestions are explicitly accepted in ordinary forms; existing adapters/SQLite worker retain all business writes. Browser initially reports unavailable and remains usable manually.

**Tech Stack:** Existing React/TypeScript/Tauri/Rust; isolated Python Laya training/evaluation; pinned multilingual weights and Rust ONNX Runtime dependency after verification.

**Spec:** [2026-10-26 reconciled design/audit](../../research/2026-10-26-laya-gemini-reconciliation.md), including its corrections to [previous assessment](../../research/2026-10-25-laya-billzen-assessment.md). Reuse the [previous plan](2026-10-25-laya-billzen-integration.md)'s detailed tests where not superseded.

**Status:** Proposed handoff for Antigravity; all implementation steps remain unchecked. This chat delivers research/planning only. The starter prompt is written so the owner can deliberately authorize Release A execution by pasting it there.

## Global Constraints

- Desktop first, Android later; training hardware undecided until inventory. One multilingual checkpoint first.
- Model-triggered stock/cash/debt/final-number writes: zero. Accepting a suggestion never saves a transaction.
- Preserve offline/manual operation, EN/ML/AR+RTL, integer minor units/quantity scaling, currency binding, retry/version/recovery and backup1.2.
- No inference on the UI thread or SQLite worker. One active and at most two queued AI requests.
- Limits:8KiB UTF-8 text,12 choices including `none`,96 characters per label,32KiB protocol frame; token/option-span checks may require smaller inputs. Never silently truncate labels or narration.
- No universal0.75 threshold, auto-fill while typing, automatic party creation/linking, credit scoring, tax/compliance decisions, AI posting or generated SQL.
- `min_confidence` is ported in reviewed upstream0.4.16 source; missing buckets default permissively upstream, so host missing calibration must abstain. Per-language temperatures/histogram parity still need proof or rejection.
- No AI feedback migration in Release A. Migration10 already belongs to drafts; do not edit historical migration checksums. Existing checksummed backups are not encrypted.
- No weights/private records/generated outputs in Git, automatic startup model download, cloud/paid teacher dependency, raw-text telemetry, release publication, signing-key discovery or synchronization.
- Commits/pushes follow AGENTS.md owner identity/verification rules. Passing local tests and remote CI are reported separately.

## Review Focus

- Negation, quotes, historical/hypothetical text or B2/B3 requests must clarify rather than open a misleading financial intent (Tasks2/5).
- A changed currency/category/archive state or user-edited field invalidates a late proposal without overwriting the form (Tasks4/5).
- Long ML/AR labels, option permutations and missing correct candidate must abstain or show `none`, never map by stale array index (Tasks2/4).
- Missing calibration, zero-default buckets, confident-false noul and unevaluated SDK gates must not produce misleading accepted suggestions (Tasks3/4).
- Child OOM/timeout/corruption/offline startup during ledger work must leave manual Save/recovery operational without a shared model/DB lock (Tasks4/6).

## Files and ownership

Use the prior plan's file map for `tools/laya/`, `tests/fixtures/assistant/`, `crates/billzen-ai-host/`, `src/types/assistant.ts`, `src/domain/assistant_policy.*`, native assistant modules/commands, adapter and UI cards. Resolve existing component paths before editing: `src/components/AppNavigation.tsx`, `CashbookDialog.tsx`, `SettingsView.tsx`, `src/App.tsx`, `src/i18n/`. Do not create a duplicate AI framework or copy Go/.NET ports into BillZen. New reports live in `docs/research/laya/`.

### Task 1: Pin source/assets and establish desktop feasibility

**Files:** `tools/laya/README.md`, `requirements.lock`, `asset_manifest.schema.json`; `docs/research/laya/desktop-feasibility.md`.

**Consumes:** reviewed upstreamSHA `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`. **Produces:** exact source/weight/export/runtime manifest, named reference hardware and resource ceiling; go/no-go for dataset/model experiments.

- [ ] Restore brain/Git/Graphify context and preserve all unrelated changes. Confirm B1 implementation status instead of replaying it.
- [ ] Inventory CPU/OS/RAM/storage/accelerator; set and record a conservative memory/run budget before heavyweight operations. Do not purchase/rent hardware or search for credentials.
- [ ] Resolve immutable weight/tokenizer/config revisions/hashes/licenses. Verify whether the selected crate contains the reviewed source APIs; choose an exact verified revision/version, not moving main. Record Python0.4.16 source versus deployed Rust metadata independently.
- [ ] Validate manifest negatives (missing hash/revision, path traversal, unsupported assets) before preparation. Prepare an isolated environment and export outside tracked outputs; record actual model/library download and disk sizes.
- [ ] Run synthetic reference inference and a minimal native ONNX smoke probe, recording cold/warm p50/p95/RSS/errors/native compatibility. Stop model integration on an unmet hardware/artifact gate; complete useful model-free dataset work instead of faking results.
- [ ] Check docs/manifests, commit/push the evidence section, verify remote SHA and actual CI. No application release or automatic end-user download.

### Task 2: Grouped labels and rules-versus-model evaluation

**Files:** `tools/laya/prepare_dataset.py`, `evaluate_billzen.py`, tests; synthetic fixtures; `docs/research/laya/baseline.md`.

**Consumes:** Task1 manifest. **Produces:** `navigate.v1`, `cashbook_category.v1`, split/provenance hashes and a measurable model utility decision.

- [ ] Write failing dataset tests for supported `expected`/`gold` shapes, case-group isolation, option permutation/gold remapping, unique IDs, `none/clarify` and invalid private provenance. Implement the validator and65/15/10/10 group split before flattening.
- [ ] Create/adjudicate synthetic EN/ML/AR/Manglish cases covering all five Review Focus classes; use the spec's diagnostic sample budget and expand for sparse task/language slices. Existing arithmetic fixtures may inform safe synthetic structure but are not a semantic NLP gold set.
- [ ] Write failing evaluation tests for per-slice counts/confusion, macro-F1, selective precision/coverage, ECE/Brier and uncertainty intervals. Implement shared reports and compare deterministic rules with pretrained Laya on identical examples.
- [ ] Run `python3 -m pytest tools/laya/tests/test_dataset.py tools/laya/tests/test_evaluation.py` in the prepared environment; require all pass. Report real pretrained measurements if Task1 permits, otherwise explicitly unavailable.
- [ ] Inspect false positives/ambiguity and decide pretrained adequate versus conditional Task3 adaptation. Commit/push dataset/report section and verify remote SHA/CI.

### Task 3: Conditional tuning, calibration and export parity

**Files:** training/export wrapper/tests, `docs/research/laya/adaptation.md`, tiny golden protocol/parity fixtures and metadata.

**Consumes:** grouped partitions and native environment. **Produces:** a selected measured bundle plus supported calibration policy, or documented no-go. Skip tuning when pretrained already passes.

- [ ] Write failing wrapper tests: disable upstream flattened calibration split; never expose final test groups to training/selection; preserve label IDs under shuffle; sparse buckets/unavailable transforms reject promotion.
- [ ] If tuning is necessary, scope a small pilot first, using human-reviewed synthetic/lawfully usable labels. Estimate full-run resource/time from the pilot before substantial training. Compare head-only/full and soft-CE/RLCD where hardware permits, record effective optimizer updates and three seeds for finalists. No invented LoRA flags or cloud teacher calls.
- [ ] Fit calibration on the external grouped calibration set. Explicitly account for current Rust gate states and missing bucket0.0 behavior; do not use entropy as P(correct) or confuse noul confidence with P(true).
- [ ] Export from pinned weights using inspected Rust exporter. Test tokenizer/config, option order, probability/argmax and threshold decisions across Python/ONNX/host. No unexplained threshold flips pass; unsupported per-language/histogram transforms are not silently dropped.
- [ ] Run `python3 -m pytest tools/laya/tests`; generate actual held-out metrics with uncertainty and warm/cold resource report. Initial macro-F1>=0.90 per routing language slice and selective precision>=0.95 are proposed targets, not guarantees. INT8 requires its own re-evaluation/calibration.
- [ ] Commit/push only tools/fixtures/reports/manifests, verify SHA/CI; retain weights outside Git. Stop product promotion if quality/parity/resource gates fail.

### Task 4: Strict policy and isolated runtime

**Files:** prior plan's assistant types/policy/native process/adapter files, scoped command registration and tests.

**Interfaces:** keep `AssistantTask`, `AssistantProposal` and `validateAssistantProposal(task, raw, currentContextDigest)` from prior plan. Task enum initially only `navigate`/`cashbook_category`. Digests bind request, company/currency, relevant source/version, schema/candidates and current user form state. `get_assistant_status`, `suggest_assistant_decision`, `cancel_assistant_request` are the only assistant IPC commands; no proxy posting command.

- [ ] Write failing policy tests for every schema limit, unknown/duplicate IDs, NaN/Infinity, missing/sparse calibration, noul direction, SDK unevaluated state, stale user edits/context, option permutation and truncation/collapse.
- [ ] Implement pure policy and protocol fixtures; no financial write-adapter imports. Host builds allowlisted schemas rather than trusting arbitrary WebView question definitions.
- [ ] Write failing Rust fake-child tests for absent/corrupt bundle, path escape, oversized/incomplete frames, child timeout/crash, cancellation/restart and queue bounds. A concurrent synthetic ledger operation must complete while inference is held pending.
- [ ] Implement one lazy session in separate Rust child over private stdio; no database dependency, HTTP listener or runtime auto-download. Native parent owns verified paths/provision/lifecycle and discards superseded results. Browser adapter returns unavailable.
- [ ] Run targeted Vitest and host/native Cargo tests from the prior plan; require all relevant checks pass. Run actual-weight probability/performance probes separately, clearly distinguishing mocks from model evidence. Commit/push and verify SHA/CI.

### Task 5: Release A accessible suggestions

**Files:** assistant panels/cards, minimal Settings/navigation/Cashbook/i18n integration, `scripts/verify_assistant_ui.js`.

**Consumes:** validated proposals only. **Produces:** explicit Quick Action routing and compatible Cashbook category chips; no multi-field auto-fill or new accounting feature.

- [ ] Write failing UI tests for explicit Ask, model missing/off/loading/clarify/cancel, keyboard/live status, EN/ML/AR+RTL, theme/reduced-motion and short/mobile widths. Negated/unsupported requests must never submit financial data.
- [ ] Add optional local-assistant setting and two feature surfaces. Accept navigates/sets an explicitly reviewed category only; user edits invalidate late results, and separate Save still uses existing validators. No inference every300ms and no hidden override.
- [ ] Assert zero suggestion-triggered money/stock/debt/numbering/draft writes; preserve negative-balance confirmation, retries, draft recovery and manual operation while runtime is unavailable.
- [ ] Run `npm test`, `npm run build`, new UI checks and relevant existing Cashbook/draft/transfer/customer regression scripts. Serialize scripts sharing ports and report actual outcomes; fix failures before claiming completion.
- [ ] Commit/push verified Release A UI and verify remote SHA/CI.

### Task 6: Exact desktop acceptance and independent final review

**Files:** native assistant probe, `docs/research/laya/release-a-acceptance.md`, brain evidence and packaging changes only where necessary.

- [ ] Verify exact packaged candidate with corrupt/missing assets, offline start, model crash/timeout, replacement rollback, ledger responsiveness, recovery and backup1.2 unaffected by optional model files. Record cold/warm latency, peak memory and hardware ceiling compliance.
- [ ] Request one independent final review covering financial authority, resource isolation, calibration/model/data provenance, false-positive evidence and UI states. If a reviewer is unavailable, say so; do not claim review occurred. Fix actionable findings with regression evidence.
- [ ] Update brain architecture/handoff/session for actual delivered state and run local code-only Graphify. Commit/push, verify remote SHA and actual CI. Distinguish source/candidate/installed/published and physical-device evidence; no publication is part of this task.

## Backlog plans — not part of the starter execution

**Release B:** typed local candidate retrieval/reranking with recall@k, deterministic reviewed amount/date parsing, read-only report filters. APIs such as `retrieveAssistantCandidates` and `proposeReportFilters` require their own concrete design/test contracts before implementation; do not add them as untested stubs in Release A.

**Release C:** deterministic bounded duplicate candidates + optional semantic ranking, explainable direction notices, product-category/help routing. Nonblocking, no correction/reversal or risk/compliance claims. Evaluate matching and false alerts against a deterministic baseline.

**Release D:** separate Android/browser feasibility and optional local feedback design. No automatic v10 migration, no raw-note logging, no silent training. Add retention/delete/export/privacy/backup semantics and a fresh additive migration only if later justified/approved.
