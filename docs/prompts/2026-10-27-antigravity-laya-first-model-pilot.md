# Antigravity: first real pretrained pilot after adapter acceptance

```text
Continue BillZen at /home/jabir/Coding/My Projects/BillZen.
Read AGENTS.md, current brain context and:
docs/reviews/2026-10-27-laya-sdk-acceptance.md

The narrow thin-SDK correction at15e44d7d60b376faa3ad65b0fde7c8f565ce914e is accepted at source/SDK-boundary level. Preserve it. Do not repeat foundation work or present more mocked/absent-model runs as model progress.

Next scope is a bounded pretrained model pilot only, conditional on an existing suitable environment. First identify the actual external machine/notebook I can access, its OS/CPU/available RAM/storage, required access and preparation budget. Do not assume credentials, purchase/rent a service or run heavy export/loading on the memory-constrained laptop. If no suitable environment is available, deliver a concise concrete blocker and stop heavy work; keep accepted tools intact.

Before actual load/export:
- Use pinned upstream source b9fe351ce81e2d974bca2bf219c1e4030c0a05ea and independently pinned checkpoint1720e3e3357cfe1e281542e223f8273b0890ca34, with full verified tokenizer/config/calibration/encoder metadata. Export a verified local checkpoint or prove equivalent immutable revision/hash enforcement. Record resolved SDK/dependency versions; source labels alone are not provenance.
- The tracked onnx_asset_manifest.json is a template with an all-zero model hash/size1. Generate a real run-specific complete bundle manifest from actual export files, including external tensor sidecars and SDK loader metadata/licenses. Verify actual bytes before inference. Never call structural schema pass model integrity.
- Establish separate preparation and deployment-inference budgets, timeout and real containment. Do not widen500MiB target/750MiB hard inference budget silently. GPU is optional. A wall timeout is not RSS enforcement; no unbounded model load in the app/SQLite process.
- Ensure preparation uses only public model/source and synthetic/licensed cases. No private business files, backups, contacts, credentials, paid APIs or signing-key discovery. After explicit provisioning, verify local offline inference with all files present.

Run the smallest real sequence the safe environment permits:
1. Pretrained Python-Laya reference on a tiny synthetic smoke set, then the frozen diagnostic corpus if the smoke succeeds.
2. Upstream unquantized ONNX export/verification and equivalent corpus, using actual graph/checkpoint paths and verified manifests.
3. Compare tokenization/IDs/probabilities/calibration/accepted-threshold decisions with Python. Record unexplained mismatches as failures; do not replace results with rules or mocks.
4. Only if needed and feasible, optional INT8 export and independent parity/quality/calibration/resource comparison. Do not assume quantization accuracy, RSS reduction or latency improvement.

Record cold load/warm p50/p95, peak RSS, CPU/device/provider, artifact/manifest/dataset hashes, task×language metrics, abstention/coverage/counts/uncertainty and errors. Make the score used for thresholding explicit; SDK confidence and answer_confidence are different. Existing23-case snapshot has already been inspected and cannot become a new untouched test by renaming it. No fine-tuning yet.

Keep weights/graphs/environments outside Git. Update source tools only if real compatibility failures require small verified fixes; preserve true failed/not_run evidence. Commit/push scripts/reports/manifests only under AGENTS.md, verify remote SHA/actual CI, update brain/handoff and local code-only Graphify. Runtime/UI Tasks4/5, Android/browser, rules-only product substitution and release publication remain outside scope.

End with real model measurements or the exact missing environment/access/resource; state go/no-go and smallest next step. Stop for review before app integration. Respond in Malayalam with important technical terms in English.
```
