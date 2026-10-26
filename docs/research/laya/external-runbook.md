# Reproducible Laya Export and Evaluation Runbook (CPU-Capable)

**Target Upstream Revision**: `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`  
**Base Model**: `convaiinnovations/laya-multilingual` (Apache 2.0)  
**Host Context**: Research tooling & portable execution handoff for BillZen assistive assistant.  
**Execution Environment Note**: This runbook is intended for an adequately resourced external workstation or VM (>= 4.0–8.0 GiB available RAM). Due to conservative memory constraints on the primary development laptop (~1.4–1.5 GiB available RAM), heavy model export and unquantized evaluation are withheld locally to prevent OS thrashing or OOM panics.

---

## 1. Upstream Provenance and Checksums

### Pinned Upstream Repositories
- **Laya Engine Source**: `https://github.com/NandhaKishorM/laya`
- **Pinned Git Commit**: `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea`
- **Hugging Face Model Hub**: `https://huggingface.co/convaiinnovations/laya-multilingual`
- **License**: Apache-2.0

### Verified Base Asset Manifest
The verified base model files and their cryptographic SHA-256 hashes (matching `tools/laya/manifest.json`):

| File | Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- |
| `config.json` | 651 | `7add7c04118a803980df9a2ea9c98687aeb46f7f329910a30b5e396bc781c7cb` |
| `tokenizer.json` | 17,178,574 | `609d8f4c4c23ba7802ebc87fc66d9298e3b5df5110ebf63fe830e07172b0cf55` |
| `tokenizer_config.json` | 1,296 | `424b694436af8bbba440d908985172ecdbfb2e1b12b3227ee0e94bb775a6c0e5` |
| `model.safetensors` | 644,196,732 | `9d628fd90fa1f97486e9e49c716ea058c4f1c19b4fcb51cb56c8ce7584dc800c` |

*Note: All weight files, ONNX graphs, and external binaries must remain outside Git tracking. Verify with `.gitignore` before downloading.*

---

## 2. Resource Budgets & Isolation Constraints

To maintain system stability and prevent optimistic assumptions:
- **Available RAM vs Total RAM**: Total system RAM must be distinguished from currently *available* free RAM.
- **Preparation & Export Budget**: Requires **>= 4.0 GiB available RAM** (8.0 GiB recommended) and >= 5.0 GiB free disk space. A strict 10-minute timeout is enforced on export.
- **Target Desktop Inference Budget**: 
  - Target ceiling: **500 MiB RSS**
  - Hard containment ceiling: **750 MiB RSS**
  - Latency: p50 <= 150 ms, p95 <= 350 ms on CPU.
- **GPU Requirement**: **None (CPU only)**. PyTorch export and ONNX Runtime inference run purely on `CPUExecutionProvider`. GPU acceleration (CUDA) is completely optional.

---

## 3. Step-by-Step Execution Guide

### Step 3.1: Environment Setup on External Workstation
Create a dedicated isolated virtual environment with pinned package versions:

```bash
# Ensure adequate available memory
python3 -c "import psutil; avail_mb = psutil.virtual_memory().available / (1024*1024); print(f'Available RAM: {avail_mb:.1f} MiB'); assert avail_mb >= 4096, 'Insufficient available RAM (< 4096 MiB)'"

# Create clean virtual environment
python3 -m venv .venv_laya_export
source .venv_laya_export/bin/activate

# Install exact pinned dependencies
pip install --upgrade pip
pip install \
    torch==2.3.0 \
    transformers==4.40.2 \
    onnx==1.16.0 \
    onnxruntime==1.17.3 \
    safetensors==0.4.3
```

### Step 3.2: Upstream Source Checkout
Clone and pin the upstream Laya repository:

```bash
git clone https://github.com/NandhaKishorM/laya.git
cd laya
git checkout b9fe351ce81e2d974bca2bf219c1e4030c0a05ea
```

### Step 3.3: CPU ONNX Graph Export
Execute the upstream export script using `CPUExecutionProvider`:

```bash
mkdir -p exported_laya

# Run upstream export script with CPU execution
python3 laya-rust/tools/export_onnx.py \
    --model convaiinnovations/laya-multilingual \
    --output ./exported_laya/model.onnx

# Verify structural graph integrity
python3 -c "
import onnx
model = onnx.load('./exported_laya/model.onnx')
onnx.checker.check_model(model)
print('ONNX model structure successfully validated.')
"
```

### Step 3.4: Dynamic INT8 Quantization (Optional Comparison Arm)
Generate the dynamic INT8 quantized artifact to assess memory and latency trade-offs:

```bash
python3 -c "
import onnxruntime
from onnxruntime.quantization import quantize_dynamic, QuantType

quantize_dynamic(
    model_input='./exported_laya/model.onnx',
    model_output='./exported_laya/model_int8.onnx',
    weight_type=QuantType.QInt8
)
print('Dynamic INT8 quantization completed.')
"
```

### Step 3.5: Reference Inference & Parity Validation
Before accepting quantized models or claiming desktop feasibility, benchmark both unquantized and INT8 models against BillZen evaluation suites:

```bash
# In BillZen repository root:
# Copy artifacts into tools/laya/assets/ (ignored by git)
mkdir -p tools/laya/assets
cp /path/to/exported_laya/model.onnx tools/laya/assets/model.onnx
cp /path/to/exported_laya/config.json tools/laya/assets/config.json
cp /path/to/exported_laya/tokenizer.json tools/laya/assets/tokenizer.json
cp /path/to/exported_laya/tokenizer_config.json tools/laya/assets/tokenizer_config.json

# Update manifest with actual file sizes and SHA256 hashes
python3 -c "
import hashlib, json, os

manifest_path = 'tools/laya/manifest.json'
with open(manifest_path, 'r') as f:
    manifest = json.load(f)

for asset in manifest['assets']:
    p = os.path.join('tools/laya/assets', asset['filename'])
    if os.path.exists(p):
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        sz = os.path.getsize(p)
        print(f'{asset[\"filename\"]}: {sz} bytes, sha256={h}')

"

# Run comparative evaluation (FP32 vs Rules vs INT8)
python3 tools/laya/evaluate_billzen.py \
    --dataset tools/laya/datasets/dev.jsonl \
    --output-dir tools/laya/reports/dev_model_eval/

python3 tools/laya/evaluate_billzen.py \
    --dataset tools/laya/datasets/holdout.jsonl \
    --output-dir tools/laya/reports/holdout_model_eval/
```

---

## 4. Parity and Quality Gates

A quantized or exported model may ONLY be certified for desktop integration if it satisfies all of the following:

1. **Prediction Parity**:
   - Categorization top-1 agreement >= 95% with unquantized reference.
   - Zero hallucinations of candidate IDs not present in the allowed candidate set.
2. **Resource Ceilings**:
   - Peak RSS during batch inference <= **500 MiB** (hard stop at **750 MiB**).
   - Peak memory must be measured via `psutil` in an isolated child worker.
3. **Latency Guarantees**:
   - Single-case inference p50 <= 150 ms, p95 <= 350 ms on 4 CPU threads.
4. **Host Policy Verification**:
   - Raw model outputs must be validated through `validate_assistant_result_against_host()` to guarantee currency consistency, fail-closed abstention on missing context, and clarification on compound intents.

---

## 5. Artifact Delivery Checklist

Upon completion on the external workstation, deliver the following package to the BillZen project maintainer:

- [ ] `model.onnx` (FP32 baseline, SHA-256 recorded)
- [ ] `model_int8.onnx` (Dynamic INT8 quantized, SHA-256 recorded)
- [ ] `config.json`
- [ ] `tokenizer.json` and `tokenizer_config.json`
- [ ] `eval_summary_dev.json` and `eval_summary_holdout.json` (Real metrics from `evaluate_billzen.py`)
- [ ] `environment_info.txt` (OS, CPU model, Python version, package versions, measured peak RSS)
- [ ] Completed integrity verification log demonstrating byte sizes and checksums.

*Important: Do NOT commit model weights or binary graphs to git repository.*
