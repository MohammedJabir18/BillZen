# Laya contract review: d8dd86b

Reviewed2026-10-26, Asia/Kolkata. Target `d8dd86bcf7b1cabc278e2d8b6d79cc6043d05c1e`, including16833de/114c863. Owner asked to assess Antigravity's latest delivery and next step. This review performs no model download/execution or product/tooling source fix.

## Verdict

**Do not execute the external runbook or promote runtime/UI yet.** The unit-test/CI progress is real, but the new providers implement a generic classifier rather than Laya's typed-question pipeline. There are three concrete contract blockers below. More RAM, quantization or another machine cannot correct those API/input mismatches.

Next task: a small pinned-upstream adapter/contract correction, with independent acceptance against source-derived schema/tokenizer/graph fixtures. Use upstream `Agent`/`ONNXAgent` or a proven equivalent adapter; remove invented classification/token fallbacks. Do not repeat the complete foundation, pursue hardware purchases or treat a passing toy mock as a model benchmark.

## Fresh evidence

- Working tree initially clean; local/origin main both exactd8dd86b.
- `python3 -m pytest tools/laya/tests/ -q`: **49 passed in0.22s**.
- Dataset generation into temporary directory: **zero byte mismatches**.
- [CI40368840831](https://github.com/MohammedJabir18/BillZen/actions/runs/40368840831) independently confirmed **completed/success** for AI Tooling, Rust and Frontend, superseding attachment's earlier in-progress snapshot.
- No financial/B1 application implementation changed; assistant runtime/UI still absent. No actual Laya/ONNX benchmark or quantized-model acceptance exists.
- Re-fetched pinned upstream b9fe351 `docs/finetune.md`, `laya/train.py`, `laya/agent.py`, `laya/onnx_agent.py`, `laya-rust/tools/export_onnx.py` and `laya-rust/MODELS.md` through GitHub connector. Evidence below uses that exact source, not memory/latest assumptions.
- Current Graphify2474nodes/5322links,102 relevant nodes; SQL/semantic coverage remains partial.

## C1 — Model execution is not the pinned Laya pipeline (blocking)

### Python path

`tools/laya/runner.py:163` loads `AutoModelForSequenceClassification`, tokenizes only text with fixed128-token truncation and maps output index to a subsequently supplied candidate list. It never presents typed question instructions/options to the model. The pinned Laya [`Agent`](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya/agent.py) builds a custom encoder/head and constructs typed question/option sequences before scoring. Generic sequence-classifier loading does not establish checkpoint compatibility or dynamic candidate reasoning. Candidate labels, selected direction and schema must participate in actual model input, not only output remapping.

### ONNX path

At `runner.py:243`, the provider uses `[min(ord(ch),255) for ch in text[:128]]`, not the checkpoint tokenizer. A capturing fake-session probe produced identical input `[[255,255,255,255]]` for Malayalam `വാടക` and `സേവന`. This destroys script/meaning rather than providing multilingual tokenization. No tokenizer/config/calibration is actually used in this path.

The pinned fused exporter defines **five** inputs: `input_ids`, `attention_mask`, `marker_pos`, `marker_mask`, `qtype`. Current code only feeds the first two. A weight-free strict session with that exact signature rejected the provider with:

```text
Missing required exported graph inputs: marker_mask,marker_pos,qtype
```

Using a permissive capturing session, the same text/input feed returned rent for candidates `[utilities,rent,salary]` and utilities after swapping to `[rent,utilities,salary]`. Options were not encoded; the same fixed output index was simply renamed. These probes are control-flow/contract tests, not model accuracy results.

The existing test's mock exposes only one input and returns three fabricated class logits, so it certifies the invented contract. Use the actual pinned [`ONNXAgent`](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya/onnx_agent.py) path or reproduce all sequence/collation/calibration/ID semantics with parity evidence. Missing NumPy/tokenizer/runtime means unavailable, not arbitrary token/list fallback. Keep loading/inference bounded in an isolated research process before production work.

## C2 — Export has the right outer key names, wrong nested types (blocking)

`prepare_dataset.py:106` now returns state/questions/expected, but `questions` is a list, `expected` a scalar string, `instruction` singular and criteria a list of{id,label} objects. The pinned [trainer `items_from_rows`](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya/train.py) explicitly iterates `row.get('questions',{}).items()` and reads `expected[qid]` only if expected is a dict. Current output is not that contract; its list fails at items() and a scalar expected is not a per-question label map.

Match the documented complete shape, for example:

```json
{
  "state": {"text": "Paid shop rent", "direction": "payment"},
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Select a compatible active category, or none.",
      "criteria": {"uuid-rent": "Shop rent", "none": "No matching category"}
    }
  },
  "expected": {"category": "uuid-rent"}
}
```

This is an illustrative synthetic row, not a model result. Validate actual exported rows through pinned upstream parsing/dry-run where safe with configs/tokenizer only, no full weights. If such a check cannot run, record pending evidence; an internally written test asserting the wrong list/string shape is not an upstream contract test.

## C3 — Runbook is not executable or trustworthy as written (blocking)

`docs/research/laya/external-runbook.md` contains several independent mismatches:

- It claims hashes match `tools/laya/manifest.json`, which does not exist. Actual file is `asset_manifest.json`. Every displayed size/hash differs from that tracked manifest. Example model: runbook644196732bytes/`9d628fd90fa1...`; tracked643835514bytes/`9d628fd971b7...`. Treat runbook values as unverified, not provenance. Generate listings from the pinned authoritative manifest and validate artifacts; do not copy invented values.
- Pins torch2.3.0, while the pinned [model/export guide](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya-rust/MODELS.md) requires torch>=2.9 for its dynamo exporter and includes onnxscript, huggingface_hub, numpy and installation of the pinned Laya package. The runbook omits these and checks psutil before installing it. Derive one tested compatible environment from source rather than arbitrarily selecting old versions.
- Invokes `--model convaiinnovations/laya-multilingual --output ...`. Pinned exporter accepts named choices such as `--model multilingual`, and `--out` is an output root. It also accepts a local checkpoint positional path for revision-pinned exports. Check exact output layout; `--output` is not a valid argument.
- Claims a10-minute timeout is enforced, but the shown export command has no containment/timeout. Proposed deadlines are not enforcement. Implement/test an explicit bounded command/worker or label it not implemented.
- Runs `evaluate_billzen.py --dataset ... --output-dir ...` as FP32/INT8 comparison. That file has no argparse processing for these flags: `main()` generates fixed **rules-only** dev/holdout reports. Those commands cannot establish model metrics. Add/test a real provider-selecting CLI and verify report provider/model IDs.
- Copies only bare graph/config/tokenizer files, omitting complete original config/calibration/encoder metadata and possible external ONNX weights. Inventory actual exported bundle, including `model.onnx.data` if present, and hash every required asset.
- Says tools/laya/assets is ignored; `.gitignore` does not ignore that directory and pattern `*.onnx_data` does not cover `*.onnx.data`. Keep actual weights/bundles outside tracked checkout or add/test appropriate scoped ignore rules before preparation.
- Replaces prior p95<=750ms proposal with350ms and accepts95% top-1 parity without justification. Preserve/review gate provenance. Float export needs probability/tokenizer/ID/threshold parity with no unexplained accepted-decision flips; quantized task quality is a separately measured trade-off, not a universal95% agreement certificate.

Do not run the quantization or external package instructions until these items pass contract/CLI/provenance checks. No model download is needed to detect these failures.

## What to do next

Use the [contract-first prompt](../prompts/2026-10-26-antigravity-laya-contract-first.md). It narrows the task to wrapping pinned upstream APIs, actual schema parsing, accurate commands and fixture-based acceptance. The goal is one correct model bridge, not a larger homemade framework.

After that correction, a genuinely available external CPU/RAM environment can perform reference/export/optional quantization and deliver verified artifacts plus real measurements. GPU remains optional. Current laptop heavy-work no-go remains conservative; absence of model evidence is not evidence rules-only production is accepted. Task4/5, training and publication remain separate gates.
