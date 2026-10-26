# Antigravity next task: pinned upstream contract, not generic classifier

Paste after reading the review. This is a narrowly scoped correction before external model execution.

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.

Read AGENTS.md/current brain context and:
docs/reviews/2026-10-26-laya-d8dd86b-contract-review.md

I authorize fixing only the concrete C1–C3 contract/handoff blockers before any external pilot. Reviewed target is d8dd86bcf7b1cabc278e2d8b6d79cc6043d05c1e. Preserve actual current changes. Use inline TDD and Malayalam updates with important English terms. Do not repeat unrelated foundation work or claim completion from mocks asserting an invented API.

1. SOURCE FIRST
Read pinned upstream b9fe351ce81e2d974bca2bf219c1e4030c0a05ea:
docs/finetune.md, laya/train.py items_from_rows, laya/agent.py,
laya/onnx_agent.py, laya-rust/tools/export_onnx.py and laya-rust/MODELS.md.
Record the actual question/schema/tokenizer/graph/input/output/CLI contracts before editing. Use upstream Agent/ONNXAgent or a minimal verified adapter. Do not replace Laya with AutoModelForSequenceClassification.

2. FAILING CONTRACT TESTS BEFORE FIXES
- Exported questions must be a qid->question mapping, instructions plural, ordered criteria ID->description mapping and expected qid->label mapping. Exercise the upstream parser/dry-run on synthetic rows where safely possible without full weights, or explicitly mark that check unavailable. Do not certify upstream compatibility only with your own schema test.
- Feed questions and candidate descriptions into the actual typed model pipeline; changing candidate order must encode/remap correctly. Do not map a fixed generic class index onto arbitrary options afterward.
- The pinned fused graph requires input_ids, attention_mask, marker_pos, marker_mask, qtype; test all exact inputs/dtypes/shapes against source-derived fixtures. Use the pinned tokenizer/sequence builder. Remove ord()/ASCII token fallback entirely. Different Malayalam/Arabic text must not collapse to repeated255 by construction.
- Fake sessions must match the real graph contract and be labeled fake. Test SDK/state/answers interfaces, incomplete assets, missing dependencies and failure containment. No implicit probability/model-success claim from mocks.

3. MINIMAL ADAPTER IMPLEMENTATION
Wrap pinned Laya Python and ONNX APIs with typed state/questions and parse answers back to validated stable IDs/probabilities. Preserve calibration/truncation/none/clarify behavior; no arbitrary128-token truncation or raw-logit fallback. Cache one verified session inside a bounded research worker. Missing dependencies/assets or unsupported runtime reports unavailable, not alternative fake tokenization. Keep ordinary CI weight-free; real model parity remains not_run until executed.

4. REPAIR AND VERIFY RUNBOOK
- Generate hashes/sizes/file listings from actual tools/laya/asset_manifest.json and immutable revisions. Remove incorrect hashes/nonexistent manifest.json references. Verify complete bundle files, including tokenizer/encoder/config/calibration and ONNX external data. Never invent checksums.
- Select dependency versions compatible with the pinned exporter (documented torch>=2.9 plus required export dependencies and pinned Laya package). Verify executable help/import/version contracts in an isolated safe environment. No guessed old dependency pins.
- Use exact validated exporter arguments/output layout. For immutable local checkpoint export, verify positional path and --out/--verify from source. GPU is optional for CPU export/inference; RAM headroom and deadlines must be measured/enforced independently.
- Implement/test a real provider-selecting evaluation CLI with dataset/model/output arguments and explicit report provider/revision metadata. Existing evaluate_billzen.main writes rules-only fixed reports; it must never be advertised as model comparison.
- Add real timeout/resource enforcement or label the missing gate, not "enforced" in prose. Do not silently replace prior p95/parity requirements; explain any proposed threshold change. Float export needs probability/ID/tokenizer/accepted-threshold parity; INT8 gets independent quality/calibration/resource evaluation.
- Keep bundles outside Git; test ignore coverage including .onnx.data and actual assets directory. No actual weights download is needed to verify these contracts.

5. ACCEPTANCE AND STOP
Run meaningful tests and dataset/report consistency checks, verify commands' --help/parser behavior and authoritative manifest cross-check. If upstream dependencies/config/tokenizer can safely support a no-weights parser check, record it; otherwise explicitly pending. No full-weight export, inference, fine-tuning, app runtime/UI, paid service, private-data upload or publication in this correction.

Commit/push coherent verified corrections per AGENTS.md, verify remote SHA/actual CI, update brain/handoff and local code-only Graphify. End with C1–C3 status and exact upstream-derived evidence, not only test counts. Stop for review before external execution. The next actual model run will use a safe available environment only after this bridge is demonstrably compatible.
```
