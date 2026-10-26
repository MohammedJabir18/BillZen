# Laya 8beff7e review — use a thin upstream adapter

Reviewed2026-10-27, Asia/Kolkata. Target `8beff7e6c8455f9b81654291f35d2db0c4684aa0`. This is a new Antigravity correction, not the older attachment suggested by its filename. Scope is source review/non-destructive probes only; no model download, actual inference, product fix or release.

## Decision

**Dataset structural correction is accepted; CLI/ignore/runbook improvements are real. Model execution is still not ready for external handoff.** The remaining task should be smaller: delete the homemade direct ONNX fallback, use the exact pinned SDK constructor and add an honest SDK-boundary test. Do not ask the owner to procure another machine or run model export before this adapter executes the actual contract.

## Fresh verification

- Clean working tree at start; exact local/remote8beff7e matched.
- `python3 -m pytest tools/laya/tests/ -q`: **52 passed in0.17s**.
- `python3 tools/laya/evaluate_billzen.py --help`: actual provider/dataset/model/output arguments are recognized.
- Dataset regenerated into an isolated temporary directory: **zero byte differences**.
- CI[40383560061](https://github.com/MohammedJabir18/BillZen/actions/runs/40383560061) at observation: AI Tooling succeeded; Rust/Frontend still in_progress. Do not claim full CI success from the output's partial result.
- Current Graphify2497nodes/5370links; partial SQL/semantic coverage. Existing BillZen/B1 financial source remains unchanged by these research-tool commits. There is no actual Laya quality/resource benchmark.

## Fixed versus open

| Prior area | Disposition |
|---|---|
| Dataset questions/criteria/expected mappings | Structural fix verified; simulated parser test is not actual model execution |
| Generic AutoModel/ord-token path | Removed/replaced, but handcrafted fallback remains semantically incorrect |
| CLI/ignore/hash references/dependency floor | Improved; CLI help works and actual base manifest values match |
| Upstream ONNX SDK call | Wrong constructor keyword; cannot run as written |
| Marker/options semantics | Not fixed by adding five field names; fake marker locations and text-only input remain |
| External runbook | Not execution-ready: invalid Path calls and base-vs-derived manifest/layout mismatch |

## A1 — Wrong SDK constructor and an unnecessary fallback

`tools/laya/runner.py:258` calls `ONNXAgent(model_path_or_dir=...)`. The pinned [ONNXAgent constructor](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya/onnx_agent.py) is:

```python
ONNXAgent(model_id_or_path: str, onnx_path: str = "laya.onnx", ...)
```

A signature-only fake matching these named parameters reproduced `TypeError: unexpected keyword argument 'model_path_or_dir'`. No heavy package or model was loaded. Pass verified local checkpoint metadata and actual graph paths separately; the default `laya.onnx` is not the current fixed `model.onnx`. Check full model/config/tokenizer integrity before SDK loading. Readiness should include all actual dependencies/assets and avoid heavy imports before containment.

Python `Agent(model_id_or_path=...)` now matches the source better. That improvement does not validate the broken ONNX call or direct fallback. Prefer one thin wrapper around the pinned SDK for each provider; do not maintain a second imitation of Laya inside BillZen.

## A2 — Five input names do not establish typed option encoding

`runner.py:297` tokenizes text alone. `marker_pos=[[0,1,...]]` is invented instead of locating option MASK markers in the actual typed question/state sequence. Question instructions, options and their labels never enter these token IDs. In a probe with a two-token fake tokenizer and three candidates, a marker points past the end of the sequence: positions[0,1,2] versus length2.

A capturing session received **identical complete feeds** for candidates `[rent,utilities,salary]` and `[utilities,rent,salary]`. Keeping the mock output fixed at slot1 changed the answer from utilities to rent. The production code still assigns new labels to unchanged model evidence.

The new candidate permutation test changes the mock's `target_slot` from0 to1 by hand. That supplies the desired answer to the mock instead of testing whether the provider encoded the candidate change. Replace this test, do not simply add more name-presence assertions. An SDK-boundary fake should derive/inspect the supplied `state` and `questions`, not be told the expected output slot. Genuine tokenizer/sequence/marker parity requires pinned upstream outputs, not a second homemade algorithm.

The smallest safe correction is **remove the direct-session fallback**. Missing upstream dependency or invalid bundle must be not_run/failed with an explicit reason, not fall back to manually manufactured markers/calibration. Keep probability/entropy/answer_confidence meanings distinct; proposed selective precision must gate on the intended quantity explicitly.

## A3 — Remaining runnable handoff gaps

- Runbook calls `load_and_validate_manifest('...')` and `verify_asset_file_integrity(...,root_dir='...')`, but these functions expect `Path`. Fresh probe of the first call raised `AttributeError: 'str' object has no attribute 'is_file'` before model work. Test every non-heavy runbook command in a clean temporary fixture, not only help output.
- Base `asset_manifest.json` describes original PyTorch safetensors/config files, while the runbook copies ONNX files and then verifies that base manifest. Separate original checkpoint manifest from derived ONNX bundle manifest. Exported graph/config/tokenizer/external-weight/calibration/encoder layouts must match actual SDK loader needs (`rl_agent_config.json` and tokenizer/encoder metadata as appropriate), not a four-file guessed copy list.
- Named `--model multilingual` proves CLI syntax, not immutable weight pinning. For reproducible execution, provision/verify the documented checkpoint revision and export a verified local checkpoint with the positional path, or demonstrate equivalent revision/hash enforcement before load. Record resolved dependency versions after a clean environment check; unversioned pip installs are not an exact lock.
- Evaluation has one `--model-dir`/fixed graph path; explicitly choose checkpoint metadata and FP32/INT8 graph paths so reports cannot accidentally compare the same graph twice. Add exact source/weights/export/graph/manifest/corpus IDs to generated reports; timestamps/provider names alone do not establish parity provenance.
- timeout600 now bounds wall time, but is not an enforced RAM ceiling or local isolated worker. Mark memory containment unimplemented until a real bounded research process is demonstrated. No full-weight test on this low-headroom machine is required to fix these contracts.

## Next action

Use [the thin-SDK prompt](../prompts/2026-10-27-antigravity-laya-thin-sdk.md). Finish A1–A3 in one coherent tooling section, recheck upstream-derived signatures and fixture-runbook commands, then request one final compatibility review. No broad foundation rewrite, hardware purchase, training or product UI.

After that passes, external pretrained reference/export/optional quantization becomes meaningful. If no safe external environment exists, pause Laya execution with a clear resource blocker; do not silently call a rules-only feature the Laya implementation.
