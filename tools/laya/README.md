# BillZen Laya Evaluation & Dataset Tools

This directory contains offline tooling, schema definitions, synthetic dataset generators, and evaluation harnesses for exploring optional typed assistant capabilities (Release A: Quick Action navigation and Cashbook category suggestions) in BillZen.

## Safety & Architectural Invariants

1. **Strict Offline Operation**: Normal application usage operates 100% offline without external services, credentials, or API keys.
2. **Zero Financial Authority**: Assistant suggestions are non-binding UI hints. They never post vouchers, decrement stock, modify ledgers, or alter calculations.
3. **Synthetic Data Only**: All datasets here are strictly synthetic and licensed. Never commit real business data, customer details, or private transaction notes.
4. **No Weights in Git**: Weights (`.safetensors`, `.onnx`) and virtual environments are excluded via `.gitignore`.
5. **Memory & CPU Guardrails**: On reference laptop hardware (Intel Core i3, ~2.0 GiB free RAM, integrated graphics), large transformer fine-tuning is strictly gated as NO-GO to prevent OOM/system freezing.

## Directory Layout

- `asset_manifest.schema.json`: JSON Schema verifying model revisions, SHA-256 hashes, licenses, and resource budgets.
- `asset_manifest.json`: Pinned asset manifest for `convaiinnovations/laya-multilingual` at revision `1720e3e3357cfe1e281542e223f8273b0890ca34`.
- `validator.py`: Pure standard-library manifest and dataset validator rejecting path traversals, missing hashes, and malformed inputs.
- `prepare_dataset.py`: Synthetic dataset generator producing grouped, isolated partitions (`train`, `dev`, `calibration`, `test`).
- `evaluate_billzen.py`: Model-free evaluation harness comparing deterministic rules and local retrieval against expected outcomes.
- `tests/`: Automated unit tests covering manifest validation, dataset invariants, group isolation, and metric calculation.

## Running Tests

```bash
python3 -m pytest tools/laya/tests/
```
