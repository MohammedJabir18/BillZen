# Antigravity: finish one thin SDK adapter

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.
Read AGENTS.md/current brain context and:
docs/reviews/2026-10-27-laya-8beff7e-review.md

I authorize only the narrow A1–A3 correction. Preserve existing work and accepted dataset/CLI fixes. Do not repeat foundation work, export weights, train, start production runtime/UI or purchase/use paid infrastructure.

1. Replace the homemade direct ONNX path with a thin pinned SDK wrapper. Remove the direct-session fallback entirely; do not manufacture marker positions or tokenize narration without questions/options. Missing SDK/assets must be not_run/failed, never an alternate approximation.

2. Read actual b9fe351ce81e2d974bca2bf219c1e4030c0a05ea Agent/ONNXAgent signatures. ONNXAgent accepts model_id_or_path and onnx_path, not model_path_or_dir. Supply verified checkpoint/config/tokenizer and graph paths separately. Prefer an explicit --checkpoint-dir and --onnx-path CLI contract, retaining documented backwards compatibility only if unambiguous. Validate readiness without loading a heavy framework in an unbounded parent.

3. First write meaningful red tests for the exact SDK constructor and system_one(state,questions) interface. Test result mapping, errors and probability/answer_confidence semantics. A signature-faithful stub must reject unknown keywords. A candidate permutation test must inspect/derive its answer from the actual passed criteria labels, not receive a manually changed target_slot. These are clearly labeled SDK-boundary tests, not model accuracy evidence.

4. Where safe, use pinned upstream parser/config/tokenizer/sequence fixtures without full weights to verify the adapter boundary. If the genuine upstream dependency check cannot run safely, report it pending; no self-written simulation may be described as byte-for-byte upstream validation. Dataset mapping fix is accepted; do not regress it.

5. Correct runbook Path calls. Separate base-checkpoint and derived-ONNX manifests; verify a complete SDK-loadable layout and all actual graph sidecars/config/tokenizer/calibration metadata. Before export, provision the exact checkpoint revision and hashes, not moving Hub main. Use actual local-checkpoint exporter syntax and output structure. Do not install heavyweight dependencies or fetch weights on this constrained laptop.

6. Add/test explicit FP32 and INT8 graph selection and report provenance (source/weight/export/graph/manifest/dataset hashes). Record resolved environment versions when a clean external environment can be checked. Do not claim a timeout enforces RAM; mark/enforce isolation separately.

7. Smoke-test all non-heavy runbook commands against a temporary tiny fixture, including manifest validation/hash checks, provider CLI not_run and output metadata. Routine CI stays weight-free. Preserve existing Python/Rust/frontend checks; commit/push verified sections per owner identity rules and verify remote SHA/actual CI.

Update brain/session/handoff and local code-only Graphify. End with A1–A3 evidence, exact checks and any genuinely unrun SDK/model checks. Stop before external execution and ask for compatibility review. Actual model quality/RSS/parity remains not_run until safely measured later. Respond in Malayalam with important technical terms in English.
```
