# Thin SDK compatibility review — 15e44d7

Reviewed2026-10-27, Asia/Kolkata. Target `15e44d7d60b376faa3ad65b0fde7c8f565ce914e`, including73e6e2c. Owner requested assessment of Antigravity's A1–A3 correction/smoke-test output. Review only; no actual model inference/export/training, product implementation or publication performed.

## Disposition

**Accept the narrow research-adapter correction at the source/SDK-boundary level. Proceed to a conditional external pretrained pilot with artifact preflight, not another broad foundation rewrite.** This is not acceptance of real model compatibility, quality, quantization, performance or production Tasks4/5. Those need actual pinned artifacts and measurements.

The important previous blockers are addressed: direct ONNX approximation removed, exact SDK keyword/path contract used, candidate criteria passed through SDK, and Path/CLI handling smoke-tested. No further reason exists to repeatedly rebuild the same thin wrapper solely to increase mock-test counts. Real failures found during a clean model pilot must be reported/fixed honestly.

## Fresh evidence

- Working tree clean at review start; local/origin main match the targetSHA.
- `python3 -m pytest tools/laya/tests/ -q`: **55 passed in0.13s**.
- Isolated regeneration of all dataset artifacts: zero byte differences.
- Independently exercised CLI with missing checkpoint and distinct FP32/INT8 graph paths: both produced correctly separate not_run reports, preserving the actual requested graph path. No model or heavy runtime loaded.
- Actual `OnnxLayaProvider` now calls `ONNXAgent(model_id_or_path=str(checkpoint_dir), onnx_path=str(onnx_path))` and delegates `system_one(state, questions)`. The manual session/tokenizer/marker path is gone. Python delegates to Agent. This matches the previously inspected pinned b9fe351 signatures.
- SDK-boundary tests now inspect the received criteria keys under permutation; no manual target-slot update. These verify adapter data flow, not a neural model's option-order invariance or accuracy.
- Path/string compatibility, tiny fixture byte/hash verification, distinct CLI paths and not_run handling exist. New runbook smoke test uses temporary fake graph/config/tokenizer files and expects not_run; this is appropriate CLI/integrity coverage but is not FP32/INT8 inference.
- Exact [CI40428603070](https://github.com/MohammedJabir18/BillZen/actions/runs/40428603070) at observation: AI Tooling/Rust success; Frontend in_progress. Recheck before claiming all jobs passed. Historical40428135682 is not evidence for a later SHA.
- Current Graphify2494nodes/5375links,102 relevant nodes; SQL/semantic coverage remains partial. Core financial/B1 source is unchanged by the reviewed tooling commits; existing released/installed app remains separate.

## Operational preflight for the first real run

These are first-pilot preparation requirements, not a request to redo all earlier foundation code:

1. **A real existing environment:** Inventory OS/CPU, total and available RAM, storage and active workloads. Current laptop heavy-load no-go remains.4–8GiB available is a conservative preparation policy, not measured universal minimum. GPU is optional for CPU export/inference; do not purchase/rent hardware or assume account access.
2. **Immutable complete checkpoint:** Provision the pinned weight revision1720e3e3357cfe1e281542e223f8273b0890ca34 and verified tokenizer/config/calibration/encoder metadata. SourceSHA and a named model alias do not pin weights. Prefer the upstream positional local-checkpoint export after verifying bytes. Fail if the actual SDK loader would fetch missing files unexpectedly. After explicit preparation, demonstrate offline local inference.
3. **Real derived bundle manifest:** `tools/laya/onnx_asset_manifest.json` currently has model.onnx size1 and an all-zero hash. It is a template, not verified model provenance. Populate a generated run-specific manifest from actual exported files, including external ONNX tensors, actual SDK metadata/layout, calibration, graph/toolchain IDs and licenses. Structural schema validation alone is not artifact integrity. Verify every required file before loading/copying.
4. **Bounded research process:** Record a preparation/reference budget separately from end-user500MiB target/750MiB hard inference ceiling. State the real timeout/memory-containment mechanism; timeout600 only bounds wall time. Do not load a full model in this reviewing/project process or claim an unimplemented watchdog works. If no safe execution environment/bound exists, stop with a concrete blocker.
5. **Actual provider/graph provenance:** Verify installed SDK source revision and resolved package versions; benchmark reports' hardcoded revision labels are not proof the selected files came from that revision. Record actual file/graph/manifest/dataset hashes and device/provider. Explicit FP32 and INT8 paths must resolve to different verified artifacts.
6. **Model sequence:** Start with pinned pretrained Python reference, unquantized ONNX export and parity. Only then optionally compare INT8. Record choice IDs, probabilities/calibration and threshold decisions, not argmax alone. Upstream confidence and answer_confidence have different meanings; state which score gates accepted decisions. Do not assume model generalization improves or INT8 fits the target memory.
7. **Measured outcomes:** Capture cold load/warm p50/p95, peak RSS, CPU/provider/device, disk and errors plus task×language quality/coverage/uncertainty. The23-case consumed/frozen snapshot is a diagnostic comparison, not an untouched new promotion set. Additional genuinely independent cases are needed before production reliability claims.

## Owner's next step

Use the [first-model-pilot prompt](../prompts/2026-10-27-antigravity-laya-first-model-pilot.md). Choose an already available adequately resourced computer/notebook for preparation. If none is available, pause heavy Laya execution and retain the accepted model-free tools; do not keep generating not_run reports as new progress or silently replace Laya with a rules product.

The next evidence worth reviewing is a real pretrained/export report (or a specific external access/resource blocker), not another mock-only completion message. No production assistant, automatic financial posting, private data transfer, paid service, training or release is implied.
