# Antigravity Laya foundation review

Reviewed2026-10-26, Asia/Kolkata. Target `409dceb5092ae38f256dacecd7da65b64f564693`. Scope: source inspection and non-destructive tooling checks, not model installation/training or implementation. Owner asked whether Antigravity's output justifies the next development step.

## Decision

**Do not promote to Tasks4/5 yet. Repair foundation/evidence first.** The work is useful scaffolding: synthetic fixtures, rules baseline, recorded asset provenance, validators and17 passing tests. It does not establish a deployable Laya runtime or pretrained model quality. No assistant UI/native inference code was added to `src`/`src-tauri` by this commit; B1 and existing financial engine remain unchanged.

Current status should read: Task1 inventory/provenance preparation partial, runtime feasibility unmeasured; Task2 diagnostic harness partial, evaluation/split robustness insufficient; Task3 model evaluation/adaptation deferred by resource gate, not skipped because pretrained passed. Running a small rules-only assistant is a possible separate scope choice, not proof Laya has been integrated.

## Fresh verification

- Clean working tree at review start; local/remote main both409dceb verified.
- `python3 -m pytest tools/laya/tests/ -q`:17 passed in0.10s.
- Re-ran `run_benchmark(RAW_CASES)`:59/59, macro-F1=1.0, ECE=.0661, correctness-score Brier=.005 reproduced. This is an all-fixture rules score, not unseen accuracy.
- Ran additional synthetic counterexamples, category-order, repeated-group and malformed-manifest probes below. No project code edited, no weights loaded and no real business records read.
- CI40349170180 was in_progress at observation; frontend unit/build steps passed, full Rust/browser jobs still pending/in progress. [Exact run](https://github.com/MohammedJabir18/BillZen/actions/runs/40349170180). The checked workflow does not run the new Python tooling suite, so even its eventual success would not validate those tools.

## Findings, in promotion priority order

### R1 — Pretrained model gate was replaced by rules accuracy (high)

`docs/research/laya/baseline.md:73` invokes "skip tuning when pretrained already passes" after measuring only `DeterministicRuleClassifier`. `tools/laya/evaluate_billzen.py:262` unconditionally constructs that rules classifier. `requirements.lock` contains pytest only. No pretrained inference, Python/ONNX parity, native provider smoke test or measured model RSS/latency is demonstrated.

Withholding heavy training on a constrained machine is sensible. The valid reason is resource policy/insufficient model evidence. It does not imply the pretrained candidate passed or justify advancing an unmeasured native Laya engine. Correct reports/handoff and preserve the model no-go until safely measured elsewhere or via a separately validated preparation route. INT8 is a candidate experiment, not assurance of fitting500MiB.

### R2 — Evaluation uses the same59 cases used to tune rules; splits do not protect families (high)

`tools/laya/tests/test_evaluation.py:96` runs the full `RAW_CASES`, including train/dev/calibration/test. The Antigravity output also records modifying keywords after inspecting these cases' failures. These59 examples are now development fixtures; their existing six-case "test" cannot be described as untouched.

`split_grouped_dataset` at `prepare_dataset.py:576` shuffles rows, not groups. Repeating a single case20 times placed its ID in all four partitions. Existing data's unique IDs make the isolation assertion vacuous for paraphrase/template families. A true split needs stable `group_id`/origin, all related variants together, duplicate-ID validation and family-level tests.

The final test currently has only6 cases: category EN2/ML2, navigation EN1/Manglish1. It contains no Arabic cases and no navigation Malayalam case. Calibration has no Arabic cases either. Per-language figures from all59 cannot certify held-out task/language performance. Add independently authored blind holdout, coverage counts/uncertainty intervals and report insufficient evidence rather than passing sparse buckets.

### R3 — High-confidence route errors on ordinary new utterances (high)

Fresh probe results using `predict_navigate`:

| Input | Observed answer/heuristic confidence | Expected handling |
|---|---|---|
| `Pay electricity bill` | invoice_draft/.90 | payment form |
| `Paid supplier invoice` | invoice_draft/.90 | payment form |
| `Customer paid by bank transfer` | account_transfer/.95 | receipt form, with bank as method/account context |
| `Salary was paid by bank transfer` | account_transfer/.95 | payment form |
| `Received gift from customer` | clarify/.95 | receipt route or semantically justified clarification, not substring `if` |
| `Shift stock to shelf` | clarify/.95 | clarify may be valid for unsupported warehouse movement, but not because `if` appears inside `shift` |
| `Show salary payments` | cashbook_payment/.92 | reports/read-only intent or clarification |

`TRANSFER_WORDS` includes generic transfer/withdraw/deposit terms, so payment method is confused with internal account movement. Broad substring matching catches `if` inside unrelated words. Draft priority catches any "bill/invoice" before payment. Hardcoded .90/.95 scores are not calibrated probabilities. Add red regressions, ambiguity handling and semantic/token boundaries rather than patches matching only these literal strings. Wrong suggestions have no financial write effects yet, but are unsuitable for user-facing promotion.

### R4 — Candidate-order test does not call the classifier; ties change answer (high)

`test_dataset.py:67` shuffles candidates and only checks set membership. It never checks predictions. Actual `predict_category('rent and salary', ['rent','salary','none'])` returns rent/.90; reversing those candidates returns salary/.90. The stable sort at `evaluate_billzen.py:182` chooses first on ties. Ambiguous input should abstain/clarify consistently.

The rules matcher also maps semantic IDs such as rent directly to hardcoded keywords. A real candidate UUID such as `category-uuid-123` returns none even when its label would be rent; current signature accepts no label or direction. This is an integration gap requiring real `{id,label,type}` candidates and selected direction, not a claim that already implemented app behavior is broken. Test output IDs, archived/incompatible candidates, unseen taxonomies, user-edited context and permutation ties before UI wiring.

### R5 — Manifest validator accepts invalid portable paths/types (medium, before provision)

Fresh probes against `validate_asset_manifest` returned `(True, [])` for each:

- filename `C:/outside/model.onnx`;
- empty filename;
- `size_bytes=True` (Python bool is an int subclass);
- empty role;
- empty top-level license.

The handwritten validator is not applying the tracked JSON Schema and has weaker constraints. It checks hash syntax, not asset bytes (no asset provision performed yet). Before using it as a production boundary, enforce strict types/nonempty fields, unique normalized paths and cross-platform relative path containment. Reject drive-relative/UNC/backslash traversal as appropriate, and test symlink/root containment when actual installation exists. Verify actual tiny fixture bytes against hashes; do not confuse structural metadata validation with artifact verification.

### R6 — Metrics and resource evidence are overinterpreted (medium)

Confidence values in the rules engine are hand-assigned constants/keyword counts. ECE against the already-inspected59 cases is arithmetic over heuristic scores, not independent calibration. The implemented Brier is binary top-label correctness score, not multiclass Brier over a full class distribution; label/report the distinction. Separate actionable suggestion coverage from `clarify`/`none`, which currently count as accepted decisions if their scores exceed.70. Report confidence intervals and task×language cells, not language-only aggregates.

`desktop-feasibility.md:60` estimates RSS from ONNX disk size without a measured load; disk size does not establish resident memory. "Physically infeasible" and guaranteed OOM within seconds are stronger than evidence permits. Keep a conservative local heavy-training no-go, clearly labeled policy, and mark model timing/RSS/native export unmeasured. Resolve500MiB strict versus750MiB peak text into one documented budget; no claim INT8 necessarily satisfies it. Python test duration is not a separately instrumented end-to-end latency/RSS benchmark.

### R7 — New tooling lacks CI coverage (medium)

`.github/workflows/ci.yml` runs existing Rust/frontend/browser checks but has no Python install/tooling job. Add a pinned lightweight Python/pytest job for manifest/dataset/evaluation tests and artifact consistency. No model weights/network inference belong in routine CI. Distinguish existing product regression success from assistant evidence.

## Next action

Use the [foundation correction prompt](../prompts/2026-10-26-antigravity-laya-foundation-corrections.md). Repair source tests, reporting and CI as one or more coherent verified sections; rerun review before Tasks4/5. Preserve59 old cases as regression fixtures and create a fresh independent holdout. Do not download/train a large model merely to repair an evidence gap.

After foundation passes, choose explicitly between (A) a lightweight rules assistant, clearly named rules mode and evaluated as such, or (B) continuing the optional Laya model path only after actual resource/parity/quality evidence. Do not silently substitute A for the requested Laya integration. This review recommends the corrective section now; it does not implement either runtime.
