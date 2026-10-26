# Reproducible Laya Export and Evaluation Runbook (CPU-Capable)

> **8beff7e review gate:** Dataset/CLI/hash corrections are improvements, but [remaining SDK/artifact contract issues](../../reviews/2026-10-27-laya-8beff7e-review.md) still block external execution. Correct the ONNXAgent constructor/remove the homemade fallback, smoke-test Path APIs and separate original-checkpoint from derived-bundle manifests first. No real-model compatibility has been demonstrated.

**Target Upstream Revision**: `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`  
**Base Model**: `convaiinnovations/laya-multilingual` (Apache 2.0)  
**Host Context**: Research tooling & portable execution handoff for BillZen assistive assistant.  
**Execution Environment Note**: This runbook is intended for an adequately resourced external workstation or VM (>= 4.0–8.0 GiB available RAM). Due to conservative memory constraints on the primary development laptop (~1.4–1.5 GiB available RAM with active swap), heavy model export and unquantized evaluation are withheld locally to prevent OS thrashing or OOM panics.

---

## 1. Upstream Provenance and Checksums

### Pinned Upstream Repositories
- **Laya Engine Source**: `https://github.com/NandhaKishorM/laya`
- **Pinned Git Commit**: `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`
- **Hugging Face Model Hub**: `https://huggingface.co/convaiinnovations/laya-multilingual`
- **License**: Apache-2.0

### Verified Base Asset Manifest
The verified base model files and their cryptographic SHA-256 hashes matching the authoritative repository manifest (`tools/laya/asset_manifest.json`):

| File | Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- |
| `config.json` | 160 | `7add7c041b53f7091e65908553af79ab3f077946e5f2312d510ae13b17c7c134` |
| `tokenizer/tokenizer.json` | 34,363,188 | `609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f` |
| `tokenizer/tokenizer_config.json` | 502 | `424b69444bf7b5809dc2cd2e36d0bd71b8055124dd24274d6db3c655d38205e7` |
| `model.safetensors` | 643,835,514 | `9d628fd971b700382ac6f65920a86f149777b2e748e0c955fb3b19695aa8f204` |

*Note: All weight files, ONNX graphs, external sidecars (`*.onnx.data`), and binaries must remain outside Git tracking. Verified in `.gitignore`.*

---

## 2. Resource Budgets & Isolation Constraints

To maintain system stability and prevent optimistic assumptions:
- **Available RAM vs Total RAM**: Total system RAM must be distinguished from currently *available* free RAM.
- **Preparation & Export Budget**: Requires **>= 4.0 GiB available RAM** (8.0 GiB recommended) and >= 5.0 GiB free disk space. A strict 10-minute timeout is enforced on export via `timeout 600`.
- **Target Desktop Inference Budget** (matching `asset_manifest.json`): 
  - Target ceiling: **500 MiB RSS**
  - Hard containment ceiling: **750 MiB RSS**
  - Latency: warm short-utterance p95 <= **750 ms** on CPU; cold load <= **5000 ms**.
- **GPU Requirement**: **None (CPU only)**. PyTorch export and ONNX Runtime inference run purely on `CPUExecutionProvider`. GPU acceleration (CUDA) is completely optional.

---

## 3. Step-by-Step Execution Guide

### Step 3.1: Environment Setup on External Workstation
Create a dedicated isolated virtual environment with dependencies matching upstream `laya-rust/MODELS.md` (which requires `torch >= 2.9` for dynamo ONNX export):

```bash
# 1. Create clean virtual environment
python3 -m venv .venv_laya_export
source .venv_laya_export/bin/activate

# 2. Install psutil first to verify memory headroom
pip install --upgrade pip
pip install psutil

# 3. Verify adequate available memory (>= 4096 MiB)
python3 -c "import psutil; avail_mb = psutil.virtual_memory().available / (1024*1024); print(f'Available RAM: {avail_mb:.1f} MiB'); assert avail_mb >= 4096, 'Insufficient available RAM (< 4096 MiB)'"

# 4. Install exact pinned dependencies specified in laya-rust/MODELS.md
pip install \
    "torch>=2.9" \
    transformers \
    onnx \
    onnxscript \
    onnxruntime \
    safetensors \
    huggingface_hub \
    numpy
```

### Step 3.2: Upstream Source Checkout & Package Installation
Clone and pin the upstream Laya repository, and install it in editable mode:

```bash
git clone https://github.com/NandhaKishorM/laya.git
cd laya
git checkout b9fe351ce81e2d974bca2bf219c1e4030c0a05ea

# Install laya package so agent, router, and export scripts resolve imports
pip install -e .
```

### Step 3.3: CPU ONNX Graph Export
Execute the upstream export script using the documented CLI syntax (`--model multilingual --out <dir> --verify`):

```bash
mkdir -p ./exported_laya

# Run upstream export script with bounded 10-minute timeout
timeout 600 python3 laya-rust/tools/export_onnx.py \
    --model multilingual \
    --out ./exported_laya/ \
    --verify

# The exporter writes to ./exported_laya/multilingual/
# Verify structural graph integrity and input signatures
python3 -c "
import onnx
model = onnx.load('./exported_laya/multilingual/model.onnx')
onnx.checker.check_model(model)
input_names = [inp.name for inp in model.graph.input]
print(f'ONNX model graph inputs: {input_names}')
expected = ['input_ids', 'attention_mask', 'marker_pos', 'marker_mask', 'qtype']
assert all(k in input_names for k in expected), f'Missing expected inputs: {expected}'
print('ONNX model structure and fused inputs successfully validated.')
"
```

### Step 3.4: Dynamic INT8 Quantization (Optional Comparison Arm)
Generate the dynamic INT8 quantized artifact to assess memory and latency trade-offs:

```bash
timeout 300 python3 -c "
import onnxruntime
from onnxruntime.quantization import quantize_dynamic, QuantType

quantize_dynamic(
    model_input='./exported_laya/multilingual/model.onnx',
    model_output='./exported_laya/multilingual/model_int8.onnx',
    weight_type=QuantType.QInt8
)
print('Dynamic INT8 quantization completed.')
"
```

### Step 3.5: Reference Inference & Parity Validation with BillZen Evaluation CLI
Before accepting quantized models or claiming desktop feasibility, benchmark both unquantized and INT8 models against BillZen evaluation suites using the CLI in `tools/laya/evaluate_billzen.py`:

```bash
# In BillZen repository root:
# Copy artifacts into tools/laya/assets/ (ignored by git)
mkdir -p tools/laya/assets
cp ./exported_laya/multilingual/model.onnx tools/laya/assets/model.onnx
# Copy sidecar weights file if generated by exporter:
[ -f ./exported_laya/multilingual/model.onnx.data ] && cp ./exported_laya/multilingual/model.onnx.data tools/laya/assets/model.onnx.data
cp ./exported_laya/multilingual/config.json tools/laya/assets/config.json
cp -r ./exported_laya/multilingual/tokenizer tools/laya/assets/tokenizer

# Verify asset file integrity using BillZen validator
python3 -c "
from tools.laya.validator import load_and_validate_manifest, verify_asset_file_integrity
manifest = load_and_validate_manifest('tools/laya/asset_manifest.json')
ok, errors = verify_asset_file_integrity(manifest, root_dir='tools/laya/assets')
print(f'Asset integrity check: ok={ok}, errors={errors}')
"

# Run comparative evaluation via provider-selecting CLI
# 1. Evaluate FP32 ONNX model on development partition:
python3 tools/laya/evaluate_billzen.py \
    --dataset tools/laya/datasets/dev.jsonl \
    --provider onnx_laya \
    --model-dir tools/laya/assets \
    --output-dir tools/laya/reports/dev_onnx_eval/

# 2. Evaluate FP32 ONNX model on held-out snapshot:
python3 tools/laya/evaluate_billzen.py \
    --dataset tools/laya/datasets/holdout.jsonl \
    --provider onnx_laya \
    --model-dir tools/laya/assets \
    --output-dir tools/laya/reports/holdout_onnx_eval/
```

---

## 4. Parity and Quality Gates

A quantized or exported model may ONLY be certified for desktop integration if it satisfies all of the following:

1. **Prediction Parity**:
   - Floating-point ONNX export must demonstrate zero unexplained accepted-decision flips compared to reference PyTorch evaluation on dev and holdout.
   - Dynamic INT8 quantization must undergo independent calibration and evaluation; no assumed 4x memory savings or guaranteed accuracy pass.
   - Zero hallucinations of candidate IDs not present in the allowed candidate set.
2. **Resource Ceilings**:
   - Peak RSS during batch inference <= **500 MiB** (hard watchdog kill at **750 MiB**).
   - Peak memory must be measured via `psutil` in an isolated child worker.
3. **Latency Guarantees**:
   - Single-case warm inference p95 <= **750 ms** on CPU; cold load startup <= **5000 ms**.
4. **Host Policy Verification**:
   - Raw model outputs must be validated through `validate_assistant_result_against_host()` to guarantee currency consistency, fail-closed abstention on missing context, and clarification on compound intents.

---

## 5. Artifact Delivery Checklist

Upon completion on the external workstation, deliver the following package to the BillZen project maintainer:

- [ ] `model.onnx` (FP32 baseline, SHA-256 recorded)
- [ ] `model.onnx.data` (if external tensor data was emitted)
- [ ] `model_int8.onnx` (Dynamic INT8 quantized, SHA-256 recorded)
- [ ] `config.json`
- [ ] `tokenizer/tokenizer.json` and `tokenizer/tokenizer_config.json`
- [ ] `benchmark_onnx_laya_dev.json` and `benchmark_onnx_laya_holdout.json` (Real metrics from `evaluate_billzen.py`)
- [ ] `environment_info.txt` (OS, CPU model, Python version, package versions, measured peak RSS)
- [ ] Completed integrity verification log demonstrating byte sizes and checksums.

*Important: Do NOT commit model weights or binary graphs to git repository.*
