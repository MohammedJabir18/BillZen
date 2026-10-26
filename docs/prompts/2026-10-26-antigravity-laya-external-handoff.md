# Antigravity next task — functional model tools and external handoff

Review the accompanying report, then paste this into the same project chat. It preserves the original Laya goal without pretending placeholders constitute model execution.

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.

Read AGENTS.md, current brain context and:
docs/reviews/2026-10-26-laya-model-handoff-review.md
docs/superpowers/plans/2026-10-26-laya-reconciled-desktop.md

Reviewed target is8858613456b9771cea5979d07d33603a74fb3f0d. Inspect actual Git/source and preserve all user work. The43-test/CI progress is accepted as useful tooling progress; do not repeat the broad foundation or add cosmetic scaffolding. Work inline with TDD and Malayalam updates, retaining English technical terms.

NEXT MILESTONE: make model evaluation/export genuinely executable and portable. No production runtime/UI, fine-tuning, cloud account setup, paid resource, private-data upload, signing-key discovery or publication is authorized. Preserve zero assistant financial authority and manual/offline operation.

1. Fix the concrete dataset adapter:
- export_case_to_laya_format currently emits instruction/input/output; replace or clearly rename this with the pinned upstream supported state/questions/expected (or gold) typed contract.
- Preserve stable question/candidate IDs, human labels, option order, context/direction and reserved none/clarify outcomes. Validate inputs/unknown tasks and expected labels against ordered criteria.
- Add meaningful failing tests and a pinned-upstream parser/tokenizer contract check where lightweight configuration allows; ordinary CI must not download/load model weights. Do not invent APIs or claim generic instruction-tuning JSON is Laya-compatible.

2. Implement real research providers, not unconditional NotImplementedError:
- Separate implemented/dependencies/assets-integrity/resource-policy/ready states. Until a provider is implemented, report not_run:provider_not_implemented even if model.onnx exists.
- Use actual pinned Laya Python loading/predict APIs and documented ONNX inputs/outputs, complete checkpoint layout, one cached session per isolated research worker and deterministic option-ID mapping.
- Resource checks must not load torch/model in the parent process before containment. Set bounded timeout/memory behavior, record real failure states and retain other independent provider results on failure. Missing/invalid weights must fail before inference. No rules/mock substitution as model outputs.
- Add ready/unavailable/failure path tests with explicitly fake lightweight model dependencies and tiny fixtures. Actual-weight validation remains not_run until safely executed. Test that is_available cannot claim ready then predict unconditionally raises NotImplementedError.

3. Keep host-policy scope honest:
- Helpers are research prototypes, not an integrated financial safety boundary. Document whether reports include filtering or raw predictions; report both separately when integrated.
- Record/test the pre-product contract for missing/stale request/schema/candidate/source/form/currency context, host-owned input text, unknown IDs and finite probabilities. Do not accept a suggestion merely because missing context bypasses a check.
- A single payment for electricity and water is not automatically conflicting intent. Distinguish conjunctions from two incompatible actions. Do not broaden this into product UI now.

4. Prepare a portable, reproducible external runbook/package:
- Pin upstream source, independent weight/tokenizer/config revisions, Python/runtime/export versions and licenses. Include only public/synthetic cases, scripts and provenance; no databases/backups/contacts/raw business notes/credentials.
- Provide exact commands for reference inference, upstream ONNX export/verification, optional INT8 comparison and report generation. GPU is optional for CPU export/inference; do not require it or promise a universal RAM minimum. Record total versus available RAM separately.
- Define preparation/export budgets independently of the intended500MiB target/750MiB hard inference ceiling, with enforced isolation/timeout and an explicit stop condition. No heavy download/export on the currently memory-constrained laptop. Do not weaken budgets to obtain a pass.
- Return a complete artifact manifest: every graph/external weight file, tokenizer, configs, calibration, byte sizes/hashes, code/weight revisions, licenses, runtime/provider versions and benchmark corpus/hash. Preserve original artifacts until replacement verifies. Keep large outputs outside Git.
- Record unquantized reference results before claiming quantized success. Quantization requires its own accuracy/probability/threshold parity and calibration evaluation; no assumed4x RSS saving or guaranteed fit.

5. Execute only if a suitable existing environment is actually available and allowed:
- With no such environment, deliver the working tools/runbook plus a concrete external-execution blocker. Do not repeatedly regenerate not_run reports as new progress or claim a real benchmark happened.
- If an existing adequately resourced environment is provided, verify its budget before loading weights and run pretrained reference/export there. Do not purchase/rent resources, automate sign-in or upload private records. If account/access is missing, ask only for that genuinely missing input.
- Later local artifact testing must measure actual RSS/cold/warm p50/p95/CPU and quality/parity in an isolated research process before any app IPC/UI integration. Do not implement a production sidecar solely to test an unproven model.

6. Delivery:
- Run relevant Python tests, dataset/report consistency and CI checks; keep routine CI small and model-free. Update reports to distinguish scaffolding, real model runs and not_run/errors. Existing23-case snapshot is consumed/frozen evidence; no tuning against it while calling it blind.
- Commit/push coherent verified sections per AGENTS.md owner identity, verify remote SHA and actual CI. Update brain/session/handoff and local code-only Graphify with honest SQL/semantic limits.
- End with actual provider implementation status, tests/CI, artifact/readiness/resource checklist, model measurements or explicit not_run, and the exact external step requiring owner input. Stop before production Tasks4/5; no rules-only product substitution or release.
```
