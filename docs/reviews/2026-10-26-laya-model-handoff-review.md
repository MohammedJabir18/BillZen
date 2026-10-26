# Laya model handoff review — 8858613

Reviewed2026-10-26, Asia/Kolkata. Target `8858613456b9771cea5979d07d33603a74fb3f0d`. Owner requested source-backed analysis of Antigravity's latest output and next steps. No product/tooling fixes, weights download or model execution performed by this reviewer.

## Decision

**Keep the useful tooling improvements. Stop repeating broad foundation work; complete a functional model-evaluation/export handoff before using another machine.** The current laptop resource no-go is a reasonable conservative policy. It is not a measured universal hardware minimum. The repository still contains model provider placeholders, not an executable Laya benchmark. Production Tasks4/5 remain gated; a rules-only product would require an explicit owner scope choice and product acceptance.

Recommended next milestone: correct the typed dataset contract, implement genuinely executable reference/ONNX provider paths in research tools, test readiness/error semantics without heavy weights, and prepare a pinned CPU-capable external export/measurement runbook. Execute heavy work only in an available environment with an enforceable resource budget. No training or paid infrastructure is necessary for this milestone.

## Verified progress

- Clean working tree at start; local/remote main match8858613.
- Fresh `python3 -m pytest tools/laya/tests/ -q`: **43 passed in0.05s**.
- Regenerated dataset into temporary directory: **zero byte mismatches** with tracked artifacts.
- Exact [CI40361602327](https://github.com/MohammedJabir18/BillZen/actions/runs/40361602327) independently checked **completed/success**, including AI Tooling/Rust/Frontend jobs.
- Stricter finite positive resource checks, chunked asset hashing, concrete dataset field validation, metrics counts/intervals and snapshot naming are implemented. Existing financial/B1 application code remains unchanged by this tooling commit.
- Fresh rules results reproduce corrected reports: development58/59(.9831), macro-F1.9866; holdout17/23(.7391), macro-F1.64, accepted-decision precision17/18(.9444), actionable precision16/16 on16/23 suggestions. Small-sample uncertainty remains; no universal reliability claim follows.
- Multi-provider report correctly separates rules completed from Python/ONNX not_run; no fake model metrics were substituted. At observation the reference availability check saw1536MiB available RAM against its conservative4096MiB policy and ONNX assets absent. This is a time-dependent resource snapshot, not an inference benchmark.
- Relevant Graphify inspection2450nodes/5273links,113 matching nodes. SQL/semantic coverage remains partial.

## Three issues that matter for the next milestone

### 1. The named Laya exporter produces the wrong dataset schema

`tools/laya/prepare_dataset.py:106` exports `{instruction,input,output}`. The pinned upstream [fine-tuning contract](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/docs/finetune.md) uses `{state,questions,expected}` or gold probability distributions, with each question carrying type/instructions/criteria. Re-fetched and read that source during review.

Current output is a generic instruction-tuning record and cannot be called a validated Laya dataset export. Preserve stable candidate IDs and human labels, selected direction/context and `none/clarify` semantics in typed questions. Explicitly validate input, output and ordered label mapping; do not change golden labels to fit the exporter. Add a contract test against pinned upstream parsing when the lightweight tokenizer/config dependency permits it, while keeping ordinary CI weight-free. This is one concrete adapter correction, not a reason to rebuild all datasets.

### 2. Actual model execution remains unimplemented

Both `PythonLayaProvider.predict` at `runner.py:127` and `OnnxLayaProvider.predict` at `runner.py:162` raise NotImplementedError after readiness checks. With a temporary marker file and an explicitly fake onnxruntime module (control-flow-only probe, no model), `is_available()` returned true, then `predict()` immediately raised NotImplementedError. Additional RAM or copying a real model alone will not fix this code path.

Distinguish implemented/dependencies-present/assets-verified/resource-allowed/ready states. Until implemented, report `not_run: provider_not_implemented` even on a large machine. Execution failures must be recorded explicitly without replacing metrics with rules outputs or aborting all independent providers. Test the ready path, unavailable path and failure path, not only absence on the reference laptop. A readiness check must not import a heavy framework into the parent unbounded process; isolate actual model loading/execution under the research budget.

Implement the research provider using pinned upstream Laya APIs/complete checkpoint layout and ONNX signatures; do not invent tensor schemas or reimplement the SDK casually. Real parity/quality evidence requires actual weights later. Fake-provider tests remain clearly labeled harness tests.

### 3. Host helpers are prototypes and not a production safety boundary

`host_policy.py` is not called by `runner.py`/`evaluate_billzen.py`; its four tests do not mean benchmark metrics include host filtering. Context rejection is conditional on currency appearing in output; absent context and changed request/source/candidate versions are not bound. A result without currency/context was marked actionable in a fresh probe. Generic conjunction detection rejects `Pay electricity and water bill` as compound intent even though it can describe a single payment.

These are future host integration requirements, not an exploit in an already shipped assistant. Keep helpers labeled experimental; before product exposure require request/schema/candidate/source/form/currency digests, fail-closed missing context, host-owned text, allowlisted IDs, finite probabilities and staleness checks, and distinguish several words from several conflicting actions. No need to expand this into full UI implementation now.

## Hardware and artifact advice

- A GPU is **not a universal requirement for ONNX export or CPU inference**. The pinned [Rust export tool](https://github.com/NandhaKishorM/laya/blob/b9fe351ce81e2d974bca2bf219c1e4030c0a05ea/laya-rust/tools/export_onnx.py) exports with PyTorch and verifies with `CPUExecutionProvider`; no CUDA-only requirement is expressed. Re-read source during this review. Do not advise buying/renting a GPU just to proceed.
- Total8GiB RAM and available/free memory are different.4–8GiB available is a proposed preparation budget, not an empirically measured minimum for this exact export. Record actual peak memory, timeouts and headroom in the preparation environment. The current1.4–1.5GiB available/swap-heavy desktop is appropriately withheld from heavy work.
- INT8 is an experiment after reference export/parity, not guaranteed to fit500MiB or improve latency. Preparation/export can occur elsewhere, followed by bounded local artifact-only testing. GPU can help training later but training is not the next task.
- A complete bundle needs every graph/external-weight file, tokenizer/config/calibration, versions/provenance/hashes/licenses and reference outputs. A bare model.onnx is insufficient. Verify integrity before loading and preserve optional/manual app operation.

## What the owner should do next

Use the [external-handoff prompt](../prompts/2026-10-26-antigravity-laya-external-handoff.md) in the same Antigravity project. It authorizes only model-tooling/handoff work when pasted. It does not authorize this reviewing chat to run models or deploy anything.

If no other environment is available, prepare the portable research package and leave model execution honestly blocked; continue ordinary BillZen product work separately if desired. Do not generate repeated `not_run` reports and call that new model evidence. If a suitable existing environment is available, perform pinned pretrained CPU/reference export first, then quantization/parity and local resource tests. No data upload, paid service or runtime/UI is implied.
