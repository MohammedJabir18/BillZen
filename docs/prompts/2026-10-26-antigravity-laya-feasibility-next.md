# Antigravity next task: precise foundation closure, then bounded Laya feasibility

Paste the following only after reviewing the re-review. This scopes the next development/research step; it does not choose a production rules-only replacement or authorize shipping.

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.

Read AGENTS.md, current brain context and:
docs/reviews/2026-10-26-antigravity-laya-c021767-rereview.md
docs/superpowers/plans/2026-10-26-laya-reconciled-desktop.md

I want to continue toward the original Laya goal through Option B as a bounded feasibility pilot, not immediate runtime/UI development. First close the specific V1/V3 tooling/report gaps from the re-review; retain V2 as explicit tested host-policy requirements. Do not repeat the whole foundation or silently replace Laya with a rules-only shipped feature.

Check current Git and preserve user work. Reviewed target is c0217678706ffca84605b15ebd93bca2b43a68d2; current source takes precedence. Implement inline with red/green tests, independent final review and Malayalam updates with English technical terms.

SECTION 1 — NARROW CORRECTIONS

1. Strict validation: reject negative/bool/string/NaN resource values; validate finite positive RAM/timeout/latency and concrete field types; align JSON Schema/runtime, including required minimums. verify_asset_file_integrity must not report success for an invalid empty manifest. Define and test its validation contract; use streaming hashes/size checks for future large assets.
2. Dataset validation: reject invalid navigation labels, null/non-string text/group IDs, malformed/duplicate candidates and unknown tasks with controlled errors. Keep internal fixture metadata separate from a tested supported Laya state/questions/expected export. No private records or online teacher.
3. Refresh dev/holdout reports from machine-readable evaluator outputs. At reviewed snapshot dev is58/59, not59/59. Add actionable precision/counts, decision precision, abstention/coverage, task×language counts and uncertainty intervals. Small/sparse samples must say insufficient evidence. Heuristic scores are not calibrated P(correct).
4. Freeze/version the already-evaluated23-case holdout. Do not tune against its failures while calling it blind. Add genuinely new independently reviewed cases for later promotion, recording authorship/provenance and family isolation. Audit labels against current product scope; Cashbook Reports are not implemented P&L/credit/finalization features.
5. Remove zero-memory and unmeasured timing claims. Distinguish proposed500MiB target/750MiB hard inference ceiling from enforced limits and from preparation/reference process budgets. Do not weaken a ceiling silently.
6. Before any UI exposure, specify/test host filtering of inactive/archived/incompatible candidates, no unknown IDs, tagged clarify/none results, stale user/currency/context rejection and compound/unsupported navigation clarification. No financial writes or UI now.
7. Run Python tests and dataset-byte regeneration checks; CI's Python job remains model-free. Commit/push verified corrections, check remote SHA/actual CI and update brain evidence.

SECTION 2 — BOUNDED MODEL RESEARCH ONLY

Prepare a model-evaluation runner with separate rules, Python-Laya and ONNX providers and one shared case/candidate/report contract. A not-executed provider must be reported not_run, never populated by rules/mock predictions. Unit tests may use explicitly identified fake providers; they do not constitute model evidence.

Resolve exact reviewed upstream source, independent checkpoint/tokenizer/config revision/hashes/licenses and a complete loadable manifest. Verify the actual local checkpoint/export layout from pinned source, not only a four-file metadata list. Python/Rust package names/versions do not prove source parity. Use an isolated environment/cache outside tracked outputs.

Before fetching weights or starting export/reference inference, inventory available resources and estimate preparation size and safe bounds. Record separate preparation/reference versus end-user inference budgets, actual timeout/containment mechanism, and a concrete stop condition. Do not launch an unbounded644MB/1.2GB load/export on the constrained laptop hoping it fits. Do not install into or block the production BillZen/SQLite process.

Only if the available machine can safely accommodate a bounded experiment under the documented budgets, perform the pinned pretrained reference probe and measure real cold/warm p50/p95, peak RSS, CPU/disk, task/language quality and abstention. If quantization is justified, independently measure/recalibrate/export-verify it; INT8 is no automatic pass. Native/ONNX comparison must verify tokenizer, option/ID order, probabilities and threshold decisions, including unsupported calibration behavior.

If safe preparation requires a higher-memory machine that is unavailable, stop that part with an explicit resource no-go and deliver the verified model-free harness/provenance/budget report. State the concrete missing resource; do not buy/rent hardware, search credentials, force swap/OOM, invent timing or declare Laya more accurate without measurements. No fine-tuning is authorized in this pilot; pretrained baseline comes first.

Do not start production sidecar/IPC/UI or ship rules as Laya. No Android/browser inference, paid/cloud service, private-data upload, telemetry, release/signing-key discovery or publication. Every suggestion retains zero stock/cash/debt/final-number effects.

Finish with: exact corrected review IDs; tests/remote SHA/CI; rules results; model providers run/not_run; measured versus proposed resource evidence; gate pass/no-go; and the smallest justified next step. Preserve AGENTS.md Git identity rules, update brain/handoff and run only local code-only Graphify. Stop for review before Tasks4/5 product integration.
```
