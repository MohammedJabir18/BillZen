# Antigravity corrective prompt — repair Laya foundation before runtime/UI

Paste the following into the same Antigravity project chat. This is a proposed owner instruction to repair the reviewed section; no implementation was performed by the reviewer.

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.

Before continuing Tasks4/5, repair the independently reviewed Task1/2 foundation. Read AGENTS.md, current brain index/handoff/decisions/recent sessions, relevant Graphify dependencies and:
docs/reviews/2026-10-26-antigravity-laya-foundation-review.md
docs/superpowers/plans/2026-10-26-laya-reconciled-desktop.md
docs/research/laya/desktop-feasibility.md
docs/research/laya/baseline.md

Inspect current Git first; preserve unrelated changes. Target reviewed commit is409dceb5092ae38f256dacecd7da65b64f564693; rebase this instruction on actual current source rather than blindly overwriting it. Use applicable skills, inline TDD and Malayalam progress updates with important English terms.

Scope now: foundation corrections only. No runtime/UI implementation, weights download, ONNX export, fine-tuning, paid services, real-data use or publication. Do not mark pretrained quality passed using rules-only results. Do not claim the existing59 cases remain an untouched holdout after tuning rules on them.

1. Correct evidence/status first:
- Task1 inventory/provenance preparation is partial; model/native resource feasibility unmeasured.
- Task2 is a diagnostic prototype requiring split/evaluation corrections.
- Task3 is deferred/resource-gated, not skipped because pretrained passed.
- Relabel heuristic scores, measured quantities, estimates and missing evidence accurately. Keep local heavy-training no-go as conservative policy, not a proven physical impossibility. Resolve500MiB versus750MiB budget ambiguity without silently weakening it. INT8 feasibility remains unmeasured.
- Preserve chronological history; add corrections and fix current handoff/docs rather than rewriting Git history.

2. Add failing regression tests for the review's route errors before fixing:
- Pay electricity bill -> payment.
- Paid supplier invoice -> payment.
- Customer paid by bank transfer -> receipt, not internal transfer.
- Salary was paid by bank transfer -> payment, not internal transfer.
- Actual cash-to-bank/bank-to-cash movements still -> transfer.
- Read-only show/list/history queries must not become posting intents.
- Negation/hypothetical checks must use appropriate token/phrase boundaries, including gift/shift counterexamples and EN/ML/AR/Manglish ambiguity.
Fix general matching/priority rules, not only literal strings. Low evidence and conflicting intents must clarify. Suggestions still have zero financial authority.

3. Make dataset isolation real:
- Unique case_id values plus stable group_id/source-family IDs for paraphrases/templates/conversations; group before splitting.
- Reject malformed cases, duplicate IDs, unknown tasks/labels and invalid candidates/provenance at runtime, not only by assertions in tests.
- Test multiple distinct IDs sharing a group: every variant must remain in one partition. Test deterministic hashes and invalid split ratios.
- Keep all59 original examples as development/regression data. Create a fresh independently authored blind holdout and reserve it before rule tuning. Do not inspect its failures repeatedly while still calling it untouched; version/retire any consumed holdout.
- Expand the small diagnostic corpus toward the planned coverage; report counts for task×language and insufficient sparse cells. Arabic cannot be absent from final evaluation while claiming all-language acceptance. More repetitive synthetic rows alone do not prove generalization.
- Keep internal dataset metadata separate from valid upstream Laya state/questions/expected or gold exports; test export validation and stable label remapping.

4. Fix candidate semantics and permutation tests:
- Test actual classifier predictions across candidate permutations, not only set equality.
- rent and salary with reversed candidate order must consistently clarify/none, not pick the first candidate at.90.
- Use stable real-style IDs with labels/type compatibility and selected direction; never depend on hardcoded database IDs or auto-select an archived/incompatible candidate. Test unseen UUIDs/taxonomies and missing candidates. Do not wire this into product UI yet.

5. Make evaluation/reporting honest:
- Evaluate selected frozen splits with explicit dataset/version/hash and rules provider; report rules/pretrained/ONNX separately, using not-run for unavailable providers. No fake model scores.
- Score task×language, confusion, ambiguity, selective precision/coverage and uncertainty intervals. Separate actionable suggestion coverage from clarify/none. Report insufficient sample sizes rather than universal pass.
- Hand-assigned heuristic confidence is not calibrated P(correct). Binary correctness Brier must be named accordingly; full multiclass Brier requires a probability distribution. Calibration, if attempted, uses separate reserved data. Never hardcode universal confidence>.75 auto-fill.
- Record timings/RSS with actual reproducible instrumentation if reported. pytest duration is not end-to-end inference latency, and disk size is not measured RAM.

6. Harden manifest/schema validation before provision:
- Reject empty and drive-qualified/drive-relative/UNC/escaping filenames cross-platform, bool-as-size, empty required strings, malformed resource values, duplicate normalized paths and unsupported roles/schema versions.
- Ensure the schema and runtime validator agree. Test errors return controlled validation results rather than incidental TypeError.
- Test tiny synthetic local asset bytes/hash/size matching separately from structure validation; actual future installation must enforce root/symlink containment. Do not download the644MB weights for these tests.

7. Add lightweight CI coverage:
- Pin a supported Python environment and pytest dependency; run tools/laya/tests in GitHub Actions without model weights, paid calls or private data.
- Verify dataset artifact hashes/generator consistency. Keep CI input validation and fixed small synthetic tests reproducible.

For each correction: observe meaningful red tests, implement the minimal fix, rerun targeted tests, inspect diff, update actual evidence and commit/push coherent sections under AGENTS.md. Verify remote SHA and actual CI, preserving owner identity and avoiding force-push/history rewriting. Keep models/databases/secrets/build outputs out of Git.

Update brain handoff/session and run local code-only Graphify; missing SQL/semantic coverage remains explicit. At the end, list fixed review IDs, exact checks, actual CI and unresolved evidence gates. Stop before Tasks4/5 and request another foundation review. Do not silently turn the Laya feature into a rules-only production assistant; after review, make that architecture/scope choice explicit with me.
```
