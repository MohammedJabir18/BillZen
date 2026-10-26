# BillZen Desktop Feasibility & Model Provenance Report

**Date:** 2026-10-26, Asia/Kolkata  
**Target Milestone:** Release A (Desktop Quick Action Navigation & Cashbook Category Chips)  
**Status:** Task 1 Inventory & Asset Provenance Scaffolding (Partial; Runtime In-Memory Feasibility Unmeasured)  

---

## 1. Hardware & System Inventory

Measurements recorded on reference desktop workstation (`weapon-x`):

| Resource | Measured Specification / State | Assessment for BillZen AI |
|---|---|---|
| **OS / Kernel** | Ubuntu 26.04.1 LTS x86_64, Linux 7.0.0-38-generic | Standard Linux desktop; AppImage runtime compatible |
| **CPU** | 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00GHz (2 cores, 4 threads) | Low-power consumer dual-core desktop CPU |
| **GPU / Accelerator** | None detected (`nvidia-smi` absent; Intel UHD Graphics only) | **No GPU acceleration available**; CPU-only execution |
| **Total System RAM** | 7.6 GiB (7808 MiB) | Modest consumer desktop tier |
| **Active System Memory** | 5.6 GiB used, **2.0 GiB available**, 650 MiB free | **Critical memory constraint**: only ~2.0 GiB available headroom |
| **Swap Space** | 11.0 GiB total, 2.9 GiB used, 9.1 GiB free | Swap is active on host; high risk of paging under memory pressure |
| **Storage Capacity** | `/dev/nvme0n1p2`: 468G total, 113G used, 331G available (26%) | Storage is ample (>300 GB free) |
| **Python Toolchain** | Python 3.14.4, pytest 9.0.2 | Local testing toolchain |
| **Rust Toolchain** | rustc 1.99.0, cargo 1.99.0 | Up-to-date toolchain |
| **Node.js Toolchain** | v22.23.3 LTS | Active project runtime |

---

## 2. Resource Budget & Memory Ceilings

To protect the host workstation from swap thrashing or desktop UI freezing under the 2.0 GiB available memory constraint:

1. **Target Child Process RSS**: **$\le$ 500 MiB** resident memory under normal operation.
2. **Absolute Hard Memory Ceiling**: **750 MiB RSS**. If the child assistant exceeds 750 MiB, host watchdog terminates it immediately.
3. **Latency Targets**: Warm short-utterance p95 $\le$ **750 ms**; Cold startup timeout $\le$ **5,000 ms** (these remain unmeasured targets, not observed model benchmarks).
4. **Process Isolation**: Dedicated native child process over private stdio. **Zero inference on the React UI thread or the SQLite worker thread**.

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

### Inspected Hugging Face Assets & Hashes
| File | Role | Size (Bytes) | SHA-256 Checksum |
|---|---|---|---|
| `model.safetensors` | Model weights (PyTorch/Safetensors) | 643,835,514 (~644 MB) | `9d628fd971b700382ac6f65920a86f149777b2e748e0c955fb3b19695aa8f204` |
| `config.json` | Model configuration | 160 | `7add7c041b53f7091e65908553af79ab3f077946e5f2312d510ae13b17c7c134` |
| `tokenizer/tokenizer.json` | Tokenizer vocabulary & BPE | 34,363,188 (~34.4 MB) | `609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f` |
| `tokenizer/tokenizer_config.json` | Tokenizer options | 502 | `424b69444bf7b5809dc2cd2e36d0bd71b8055124dd24274d6db3c655d38205e7` |

### Key Availability & Portability Finding
- **Pre-exported ONNX artifacts are NOT provided by upstream Hugging Face repository**.
- Export to ONNX must be performed locally using the upstream Python export tool before any native ONNX runtime can be initialized.
- Estimated unquantized ONNX export size on disk is ~1.2 GB.

---

## 4. Feasibility Gates & Status

### Gate 1: Local Model Fine-Tuning Policy
- **Assessment**: Running full backpropagation fine-tuning on a 322M parameter transformer on a 2-core i3 CPU with only 2.0 GiB available memory violates safe resource budgets and risks severe swap thrashing.
- **Decision**: **Conservative NO-GO policy for local fine-tuning**. We do not attempt local training on this workstation.

### Gate 2: Pretrained Model Runtime Footprint & Parity
- **Status**: **UNMEASURED**.
- The raw model weights (644 MB safetensors) have not been downloaded or loaded into memory during this scaffolding stage.
- Real in-memory resident set size (RSS), warm latency, and whether INT8 quantization satisfies the 500 MiB RSS budget remain unmeasured empirical questions requiring future isolated testing if model inference is pursued.

### Gate 3: Tooling & Offline Baseline Scaffolding
- **Status**: **PASSED**.
- The manifest schema, hardened cross-platform validator, synthetic dataset partitions, and deterministic rules baseline are fully functional, verified with automated tests, and run completely offline without external network or heavy dependencies.
