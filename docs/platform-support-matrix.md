# BillZen Platform Support Matrix

This document defines the cross-platform engineering specifications, hardware assumptions, IPC security policies, single-instance mechanisms, and printing abstraction strategies for BillZen across all supported platforms.

**Delivery update — October 22, 2026:** Linux x86_64 user-local installation verified. Windows x64 NSIS installer packaging passed hosted CI and downloaded checksums match; physical Windows runtime/printing and Windows ARM64 remain unverified. See [desktop installation](desktop-installation.md). The older architectural status/implementation proposals below are historical, not evidence that every proposed mechanism shipped.

**Status as of October 18, 2026**:
- **Architecture**: Unified **Tauri 2.x + Rust Core + SQLite 3.45+ (WAL + FULL sync)** across all targets.
- **Linux (x86_64)**: **IMPLEMENTED & VERIFIED** (Tauri 2.12.4, Rust 1.99.0, SQLite 3.45+, WebKitGTK 2.42).
- **Windows (x86_64 / arm64)**: **PLANNED** (Desktop sequencing: Tauri 2.x + WebView2 + SQLite).
- **macOS (Apple Silicon / Intel)**: **PLANNED** (Desktop sequencing: Tauri 2.x + WKWebView + SQLite).
- **Android (10+)**: **PLANNED** (Mobile sequencing: Tauri Mobile + Rust + SQLite with full offline billing and catalog).
- **iOS (15+)**: **PLANNED** (Mobile sequencing: Tauri Mobile + Rust + SQLite with full offline billing and catalog).
- **Physical Printer**: **BLOCKED / NOT RUN** (No physical printer hardware attached to Linux test host; automated headless Chrome A4 PDF matrix substituted).

---

## 1. Executive Summary & Platform Tiering

| Platform | Tier & Product Status | Primary Runtime & Toolchain | Storage Engine & Durability | Single-Instance Mechanism | Printing Subsystem & Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Linux (x86_64 / arm64)** | **Implemented & Verified** (Verified 2026-10-18) | Tauri 2.12.4, Rust 1.99.0, Node 22.23.3, WebKitGTK 2.42 | SQLite 3.45+ (`rusqlite 0.40.2`), `WAL` mode, `synchronous = FULL`, `busy_timeout = 5000ms` | Advisory `flock(2)` on `/tmp/billzen.lock` via `fs2::File::try_lock_exclusive` | WebKitGTK `window.print()` + CUPS detection.<br/>• Native dialog: *Unverified* (awaiting physical operator interaction)<br/>• Physical printing: *BLOCKED — hardware unavailable*<br/>• Automated A4 PDF matrix: *PASSED (4/4 scenarios)* |
| **Windows (x86_64 / arm64)** | **Planned** (Desktop Sequencing) | Tauri 2.x, Rust 2021, Microsoft Edge WebView2 Evergreen | SQLite 3.45+ (bundled static), `WAL` mode, `synchronous = FULL`, `busy_timeout = 5000ms` | Win32 Named Mutex `Global\BillZen_App_Instance_Mutex` + `LockFileEx` (`LOCKFILE_EXCLUSIVE_LOCK`) | Microsoft Edge WebView2 `window.print()` + Win32 Spooler API (`winspool.drv`). Thermal ESC/POS via direct COM / USB raw writing. |
| **macOS (Apple Silicon / Intel)** | **Planned** (Desktop Sequencing) | Tauri 2.x, Rust 2021, Safari WKWebView | SQLite 3.45+ (bundled static), `WAL` mode, `synchronous = FULL`, `busy_timeout = 5000ms` | Advisory `flock(2)` on `~/Library/Application Support/BillZen/billzen.lock` + Cocoa `NSApplication` single-instance bundle activation | Safari WKWebView `window.print()` + Cocoa `NSPrintOperation` dialog sheet. |
| **Android (10+)** | **Planned** (Mobile Sequencing) | Tauri Mobile (Android NDK + Rust Core + Android Webview) | SQLite 3.45+ (bundled static via Rust `rusqlite`), `WAL` mode, `synchronous = FULL` | OS Activity Single-Task (`launchMode="singleTask"`) in `AndroidManifest.xml` | Android `PrintManager` (`PrintDocumentAdapter`) / Bluetooth & USB ESC/POS thermal printing. Full standalone billing functionality. |
| **iOS (15+)** | **Planned** (Mobile Sequencing) | Tauri Mobile (iOS Rust Core + WKWebView) | SQLite 3.45+ (bundled static via Rust `rusqlite`), `WAL` mode, `synchronous = FULL` | OS App Bundle Container Lifecycle Enforced | iOS `UIPrintInteractionController` (AirPrint) / CoreBluetooth ESC/POS. Full standalone billing functionality. |

---

## 2. Storage & Persistence Architecture

### 2.1 SQLite Configuration Across Operating Systems
BillZen enforces local-first ACID durability with standard POS transactional integrity:
- **Journal Mode**: `WAL` (Write-Ahead Logging). Permits concurrent reads alongside serialized single-writer updates through the dedicated Rust database worker thread.
- **Synchronous Mode**: `FULL` (2 fsyncs per commit: WAL frame flush + header update). Ensures durability across unexpected OS crashes or power failures on all platforms.
- **Busy Timeout**: `5000ms`. Guarantees retry resilience under transient I/O contention from external processes (antivirus, backup daemons).
- **Foreign Keys**: `ON`. Enforces schema constraints and cascade prevention on finalized transactions.
- **Worker Handshake**: Synchronous startup handshake channel (`std::sync::mpsc`) validates database connectivity, schema migrations, and seeding before UI webview initialization. If initialization fails, the process terminates immediately with an actionable error.

### 2.2 Storage Paths by Platform
- **Linux (Implemented)**: `$XDG_DATA_HOME/billzen/` (fallback `~/.local/share/billzen/billzen.db`).
- **Windows (Planned)**: `%LOCALAPPDATA%\BillZen\data\billzen.db`.
- **macOS (Planned)**: `~/Library/Application Support/BillZen/billzen.db`.
- **Android (Planned)**: Context internal files directory `context.getFilesDir() + "/billzen.db"`.
- **iOS (Planned)**: App Sandbox container `Library/Application Support/billzen.db`.

---

## 3. OS-Backed Single-Instance Mechanisms

POS terminals must strictly prevent multiple instances from opening simultaneously to protect SQLite WAL concurrency and exclusive hardware port access (e.g. barcode scanners and cash drawers).

### 3.1 Linux Implementation (Verified)
- **Mechanism**: Advisory kernel file locking via `fs2::File::try_lock_exclusive()`.
- **Lock Path**: `/tmp/billzen.lock` (with `$XDG_RUNTIME_DIR/billzen.lock` fallback).
- **Semantics**: Uses kernel-level advisory lock (`flock(2)`). Lock is automatically released by the Linux kernel if the process terminates or crashes unexpectedly.
- **Verification Evidence**: Empirically verified in multi-process tests (`tests::test_single_instance_lock_mutual_exclusion_and_release`):
  1. Process 1 acquires lock: succeeds.
  2. Process 2 attempts acquisition: rejected with `Os { code: 11, kind: WouldBlock }`.
  3. Process 1 drops lock: Process 3 acquires lock cleanly.

### 3.2 Windows Implementation (Planned)
- **Mechanism**: Win32 Named Mutex via `windows-sys` (`CreateMutexW(None, TRUE, w!("Global\\BillZen_App_Instance_Mutex"))`).
- **Secondary / Cross-Process Lock**: File locking on `%LOCALAPPDATA%\BillZen\billzen.lock` with `LockFileEx` (`LOCKFILE_EXCLUSIVE_LOCK`).

### 3.3 macOS Implementation (Planned)
- **Mechanism**: Advisory `flock(2)` on `~/Library/Application Support/BillZen/billzen.lock` combined with standard Cocoa `NSApplication` single-instance bundle activation.

### 3.4 Mobile (Android & iOS — Planned)
- Mobile operating systems do not launch concurrent desktop instances. Android enforces `android:launchMode="singleTask"`; iOS enforces single instance lifecycle per container sandbox.

---

## 4. Printing & Document Output Subsystems

BillZen decouples **commercial invoice document rendering** from **physical print dispatching**.

### 4.1 Strict DOM Print Media Isolation (Verified)
Regardless of OS or webview engine, all UI controls, diagnostics, navigation bars, and modals are assigned `.no-print` with global CSS:
```css
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 15mm;
  }
  body * {
    visibility: hidden !important;
  }
  #printable-invoice-root,
  #printable-invoice-root * {
    visibility: visible !important;
  }
  #printable-invoice-root {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
  }
}
```

### 4.2 Platform Print Dispatchers & Verification
1. **Linux (Implemented & Verified)**:
   - Primary: WebKitGTK `window.print()` triggers the native GTK Print Dialog.
   - Spooler Detection: Background command probe inspects `which lp` / `lpstat -p`.
   - **Automated Verification**: End-to-end headless Chrome PDF generator and Poppler inspection suite (`scripts/verify_matrix_playwright.js`) verified:
     - Scenario 1 (Short 2-line sample invoice): Exact A4 dimensions (`594.96 x 841.92 pt`), 1 page, exact oracle grand total `₹573.39`, Malayalam & Arabic glyph presence.
     - Scenario 2 (Multi-page 22-item wholesale invoice): Exactly 3 pages, repeating header, no trailing blank pages.
     - Scenario 3 (Kuwait 3-decimal GCC invoice): 1 page, 3-decimal KWD currency (`KD 3.281`), VAT labels.
     - Scenario 4 (Long-text wrapping stress test): Multi-line company/customer names and product descriptions wrapped cleanly without cell overflow.
   - **Physical Print Status**: `BLOCKED — hardware unavailable` (no physical printer hardware present on test host).
2. **Windows (Planned)**:
   - Primary: Microsoft Edge WebView2 `window.print()` invoking native Windows print preview.
   - Raw ESC/POS Spooling: Win32 `OpenPrinterW`, `StartDocPrinterW`, `WritePrinter`.
3. **macOS (Planned)**:
   - Primary: Safari WKWebView `window.print()` triggering Cocoa sheet print dialog.
4. **Mobile (Android & iOS — Planned)**:
   - Android: `PrintHelper` / `PrintManager.print()`, Bluetooth & USB ESC/POS thermal printing.
   - iOS: `UIPrintInteractionController.shared.present(animated: true)`, CoreBluetooth ESC/POS.

---

## 5. Security & IPC Boundary Matrix

| Security Domain | Linux (Verified) | Windows (Planned) | macOS (Planned) | Android / iOS (Planned) |
| :--- | :--- | :--- | :--- | :--- |
| **Content Security Policy (CSP)** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost; img-src 'self' data:` | Identical | Identical | Platform native webview CSP |
| **Window Capabilities** | Explicit `main` window capability in `src-tauri/capabilities/default.json` | Identical | Identical | Core Tauri capability mapping |
| **Permission Denials** | Secondary / unprivileged webviews strictly denied invoke access (`tests::test_configuration_verification_window_capabilities_allow_main_and_deny_unprivileged`) | Identical | Identical | Sandbox container security |
