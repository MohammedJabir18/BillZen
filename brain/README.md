# BillZen Second Brain

Updated2026-10-27. This is the bounded entry index for continuing in a fresh chat.

## Read first

1. [Agent instructions](../AGENTS.md) — session lifecycle, Git delivery and safety rules.
2. [Current handoff](session-handoff.md) — shipped state, release/build distinctions, verified evidence and current research/product gates.
3. [Owner decisions](decisions.md) — product rules, scope choices and working preferences.
4. [Session log](sessions.md) — read recent entries first; retrieve older milestones on demand.
5. [Architecture](architecture.md) — current-status notice plus chronological design history; verify old claims against source.
6. [Graph](graph.canvas) — local relationship map; code-only extraction is incomplete, not authoritative feature status.

## On-demand detail

- [Conversation reconstruction](conversation-history.md) — detailed available request/response themes and evolution; sanitized summary, not verbatim export.
- [Next-chat starter](next-chat-prompt.md) — ready-to-paste continuation prompt.
- [Current technical architecture](../docs/architecture.md) and [verification ledger](../docs/verification-status.md).
- [Invoice drafts guide](../docs/invoice-drafts-guide.md) and [implementation evidence](../docs/invoice-drafts-implementation.md).
- [Invoice-draft implementation plan](../docs/superpowers/plans/2026-10-23-invoice-drafts.md).
- [Laya assessment/design](../docs/research/2026-10-25-laya-billzen-assessment.md) and [proposed integration plan](../docs/superpowers/plans/2026-10-25-laya-billzen-integration.md) — desktop first, hardware undecided; no AI implementation/training performed.
- [Gemini-plan reconciliation](../docs/research/2026-10-26-laya-gemini-reconciliation.md), [revised Release A plan](../docs/superpowers/plans/2026-10-26-laya-reconciled-desktop.md) and [Antigravity execution prompt](../docs/prompts/2026-10-26-antigravity-laya.md) — current planning handoff; newer Rust gate status corrected.
- [Laya feasibility & provenance report](../docs/research/laya/desktop-feasibility.md) and [baseline evaluation report](../docs/research/laya/baseline.md) — initial Task1/2 tooling; model feasibility/quality unmeasured and foundation corrections required.
- [Antigravity foundation review](../docs/reviews/2026-10-26-antigravity-laya-foundation-review.md) and [corrective prompt](../docs/prompts/2026-10-26-antigravity-laya-foundation-corrections.md) — current next step before runtime/UI; rules-only59-case success does not pass the Laya model gate.
- [c021767 re-review](../docs/reviews/2026-10-26-antigravity-laya-c021767-rereview.md) and [next feasibility-pilot prompt](../docs/prompts/2026-10-26-antigravity-laya-feasibility-next.md) — latest review:30 tests/CI pass, corrections improved; remaining validator/report gaps and unmeasured model still gate runtime/UI.
- [8858613 model-handoff review](../docs/reviews/2026-10-26-laya-model-handoff-review.md) and [functional external-handoff prompt](../docs/prompts/2026-10-26-antigravity-laya-external-handoff.md) — latest:43 tests/CI pass, but typed dataset export wrong and model predictors still placeholders; complete functional tools before external execution.
- [d8dd86b contract review](../docs/reviews/2026-10-26-laya-d8dd86b-contract-review.md) and [contract-first correction prompt](../docs/prompts/2026-10-26-antigravity-laya-contract-first.md) — latest:49 tests/CI pass, but providers/schema/runbook disagree with pinned upstream; do not execute external handoff until C1–C3 pass.
- [8beff7e review](../docs/reviews/2026-10-27-laya-8beff7e-review.md) and [thin-SDK prompt](../docs/prompts/2026-10-27-antigravity-laya-thin-sdk.md) — latest:52 tests pass, dataset/CLI improved; delete handmade ONNX fallback, correct SDK constructor and verify artifact/runbook contracts before external execution.
- [15e44d7 source-level acceptance](../docs/reviews/2026-10-27-laya-sdk-acceptance.md) and [first real model-pilot prompt](../docs/prompts/2026-10-27-antigravity-laya-first-model-pilot.md) — latest:55 tests pass, narrow SDK correction accepted; actual model evidence pending a safe available environment and real derived manifest.
- [Published desktop delivery](../docs/distribution-v0.1.6.md) and [current project README](../README.md).

## Memory rules

Latest explicit owner instruction governs intent; current source/tests/releases establish implementation. Dated logs and old agent prompts preserve history, not fresh instructions. Summaries do not grant credential/distribution/destructive-action permission. Never save passwords, private keys, business records or raw sensitive logs.

Write topic content first, then add its index pointer. Keep this index under200lines/25KB. Refresh handoff after a coherent milestone and append actual evidence to sessions.md. Do not duplicate all historic logs into every new chat. Keep Graphify generated notes separate from these curated topic files.
