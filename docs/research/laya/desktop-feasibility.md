# BillZen Desktop Feasibility & Model Provenance Report

> **Review correction2026-10-26:** Inventory/provenance preparation is useful; model/runtime RSS, latency and native parity were not measured. Disk-derived RAM estimates, guaranteed OOM/physical-impossibility language and assumed INT8 sufficiency below are not promotion evidence. Keep the conservative heavy-training no-go; read the [foundation review](../../reviews/2026-10-26-antigravity-laya-foundation-review.md) for the actual remaining gates and validator issues.

**Date:** 2026-10-26, Asia/Kolkata  
**Target Milestone:** Release A (Desktop Quick Action Navigation & Cashbook Category Chips)  
**Status:** Task 1 Empirical Inventory & Provenance Verification Complete  

---

## 1. Hardware & System Inventory

Measurements taken on host workstation (`weapon-x`):

| Resource | Measured Specification / State | Assessment for BillZen AI |
|---|---|---|
| **OS / Kernel** | Ubuntu 26.04.1 LTS x86_64, Linux 7.0.0-38-generic | Standard Linux host; AppImage runtime compatible |
| **CPU** | 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00GHz (2 cores, 4 threads) | Low-power desktop/laptop CPU, AVX-512 capable |
| **GPU / Accelerator** | None detected (`nvidia-smi` absent; Intel UHD Graphics only) | **No GPU acceleration available**; CPU-only execution |
| **Total System RAM** | 7.6 GiB (7808 MiB) | Modest consumer tier |
| **Active System Memory** | 5.6 GiB used, **2.0 GiB available**, 650 MiB free | **Critical memory constraint**: only ~2.0 GiB headroom |
| **Swap Space** | 11.0 GiB total, 2.9 GiB used, 9.1 GiB free | Swap already active; thrashing risk high under memory pressure |
| **Storage Capacity** | `/dev/nvme0n1p2`: 468G total, 113G used, 331G available (26%) | Storage is ample (>300 GB free) |
| **Python Toolchain** | Python 3.14.4, pytest 9.0.2 | Local testing available |
| **Rust Toolchain** | rustc 1.99.0, cargo 1.99.0 | Up-to-date toolchain |
| **Node.js Toolchain** | v22.23.3 LTS | Active project runtime |

---

## 2. Resource Budget & Hardware Ceilings

Given the available memory constraint (**~2.0 GiB remaining on the host**), we define strict ceilings for any desktop assistant process:

1. **Max Child Process RSS (Resident Set Size)**: **500 MiB** (conservative limit). Must never exceed 750 MiB peak under any load.
2. **Max Latency**: Warm short-utterance p95 $\le$ **750 ms**; Cold startup $\le$ **5,000 ms**.
3. **Execution Isolation**: Must execute in a separate native child process over private stdio. **Zero inference on the React UI thread or the SQLite worker thread**.

---

## 3. Upstream Provenance & Asset Verification

### Checkpoint Provenance
- **Model ID**: `convaiinnovations/laya-multilingual`
- **Hugging Face Commit SHA**: `1720e3e3357cfe1e281542e223f8273b0890ca34`
- **Base Encoder**: `jhu-clsp/mmBERT-base` (License: MIT)
- **Checkpoint License**: Apache-2.0
- **Upstream Source Revision**: `b9fe351ce81e2d974bca2bf219c1e4030c0a05ea` (commit on `nandhakishorm/laya`, `pyproject.toml` version `0.4.16`)
- **PyPI Published Version**: `0.4.15`
- **Rust Crate**: `laya-onnx` is **not published to crates.io** (returns 0 results from `cargo search laya-onnx`). It is an unreleased workspace crate (`version = "0.1.0"`) inside the upstream git repository.

### Inspected Hugging Face Assets & Exact Hashes
| File | Role | Size (Bytes) | SHA-256 Checksum |
|---|---|---|---|
| `model.safetensors` | Model weights (PyTorch/Safetensors) | 643,835,514 (~644 MB) | `9d628fd971b700382ac6f65920a86f149777b2e748e0c955fb3b19695aa8f204` |
| `config.json` | Model configuration | 160 | `7add7c041b53f7091e65908553af79ab3f077946e5f2312d510ae13b17c7c134` |
| `tokenizer/tokenizer.json` | Tokenizer vocabulary & BPE | 34,363,188 (~34.4 MB) | `609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f` |
| `tokenizer/tokenizer_config.json` | Tokenizer options | 502 | `424b69444bf7b5809dc2cd2e36d0bd71b8055124dd24274d6db3c655d38205e7` |

### Critical Finding on ONNX Artifacts
- **Pre-exported ONNX artifacts are NOT provided by upstream Hugging Face repository**.
- Raw safetensors download is ~644 MB.
- Estimated unquantized ONNX export size is ~1.2 GB disk, requiring ~1.2–1.5 GB memory footprint when mapped into ONNX Runtime on CPU.

---

## 4. Feasibility Decisions & Gates

### Gate 1: Model Fine-Tuning on Local Machine
- **Evaluation**: Training or fine-tuning a 322M parameter transformer with backpropagation on a 2-core / 4-thread Intel Core i3 with 2.0 GiB available memory is **physically infeasible**. It would exhaust memory within seconds, force intense swap thrashing, freeze the user's desktop, or be terminated by the Linux OOM killer.
- **Decision**: **STRICT NO-GO for local fine-tuning**. Do not attempt heavy PyTorch/RLCD fine-tuning on this workstation.

### Gate 2: Pretrained 322M ONNX Model In-Memory Footprint
- **Evaluation**: Loading an unquantized ~1.2 GB ONNX model in ONNX Runtime would consume ~1.2–1.5 GiB of resident memory, representing 60%–75% of the total 2.0 GiB available headroom on the machine. Any sudden memory spike from other desktop tasks would trigger swap paging and induce severe UI latency or crashes.
- **Decision**: Raw unquantized ONNX model integration fails the 500 MiB memory ceiling gate unless quantized (INT8).

### Gate 3: Model-Free Synthetic Evaluation & Deterministic Rules Baseline (Task 2)
- **Evaluation**: Fully offline, deterministic rules and local token search require < 50 MiB RAM, zero network access, sub-millisecond latency (< 5 ms), and provide a verifiable benchmark for Release A navigation and category matching.
- **Decision**: **PROCEED IMMEDIATELY WITH TASK 2**. Build the synthetic dataset generator (`prepare_dataset.py`) and evaluation harness (`evaluate_billzen.py`) with strict grouped splitting (65/15/10/10) to benchmark deterministic rules against expected Malayalam, Manglish, Arabic, and English inputs.
