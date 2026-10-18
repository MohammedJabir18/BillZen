# BillZen Technology Baseline

This document records the exact verified dependency versions, official release sources, verification dates, and technical rationales for BillZen.

**Verification Date**: 2026-10-18  
**Target Platform**: Ubuntu 26.04.1 LTS (Linux x86_64), WebKitGTK 4.1  
**Architecture Policy**: Rust backend authoritative for financial transactions; React 19 frontend for UI and presentation; SQLite via `rusqlite` static bundled engine.

---

## 1. Verified Dependency Matrix

| Layer / Component | Package / Tool | Exact Version | Official Source URL | Selection Rationale & Compatibility Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js | `v22.23.3 LTS` (Active) | https://nodejs.org/en/about/previous-releases | Node 20 reached End-of-Life (EOL) in April 2026. Node 22 is the current active LTS supporting modern ECMAScript and Vite 8 tooling. Installed in `~/.local/node22` and linked to `~/.local/bin/node`. |
| **Package Manager** | npm | `10.9.9` | https://www.npmjs.com/package/npm | Official package manager bundled with Node 22 LTS. Enforces reproducible builds via `package-lock.json`. |
| **System Webview (Linux)** | WebKitGTK | `webkit2gtk-4.1` | https://webkitgtk.org | Native Linux webview required by Tauri 2. Verified via `pkg-config --list-all` on Ubuntu 26.04.1. |
| **System Print Library** | GTK Unix Print | `gtk+-unix-print-3.0` | https://www.gtk.org | Provides native OS print dialog infrastructure on Linux. |
| **Compiler Toolchain** | Rust | `rustc 1.99.0` (target `1.99.1`) | https://www.rust-lang.org | Latest stable patch series (1.99.1 released 2026-10-13; 1.99.0 installed on disk). Complete Swift/C-ABI and Linux x86_64 support. |
| **Desktop Core** | `tauri` (crate) | `2.12.4` | https://crates.io/crates/tauri | Latest stable Tauri 2 crate patch release with Linux GTK IPC improvements and capability-based security. |
| **Desktop Build Hook** | `tauri-build` (crate) | `2.7.3` | https://crates.io/crates/tauri-build | Official build script companion to `tauri 2.12.4`. |
| **Tauri CLI** | `@tauri-apps/cli` | `2.12.3` | https://www.npmjs.com/package/@tauri-apps/cli | Official developer CLI for scaffolding, running, and packaging Tauri applications. |
| **Tauri Frontend API** | `@tauri-apps/api` | `2.12.4` | https://www.npmjs.com/package/@tauri-apps/api | Official client-side typed IPC interface. |
| **Database Engine** | `rusqlite` (crate) | `0.40.2` (`features = ["bundled", "chrono", "uuid"]`) | https://crates.io/crates/rusqlite | Static bundled SQLite engine eliminates host OS SQLite version discrepancies, ensuring consistent WAL mode behavior. |
| **Serialization** | `serde` / `serde_json` | `1.0.229` / `1.0.149` | https://crates.io/crates/serde | Standard high-performance serialization framework. |
| **Unique Identifiers** | `uuid` (crate) | `1.18.0` (`features = ["v4", "serde"]`) | https://crates.io/crates/uuid | Cryptographically secure UUID v4 generation for idempotency keys and entity IDs. |
| **Date & Time** | `chrono` (crate) | `0.4.44` (`features = ["serde"]`) | https://crates.io/crates/chrono | Timezone-aware date and timestamp handling for Asia/Kolkata and UTC. |
| **Frontend Framework** | `react` / `react-dom` | `19.3.1` | https://react.dev | Current official stable React release. Core headless UI libraries (Radix UI, TanStack Query 5, Zustand 5, Lucide) officially support React 19. |
| **Build Tool** | `vite` | `8.3.4` | https://vite.dev | Current supported `latest` stable branch. |
| **Type Checker** | `typescript` | `5.7.3` | https://www.typescriptlang.org | Strict TypeScript configuration with Node/DOM typing. |
| **CSS & Design Tokens** | `tailwindcss` | `3.4.17` | https://tailwindcss.com | Supported PostCSS v3 release selected for maximum WebKitGTK 4.1 rendering stability without v4 CSS `@theme` migration nuances. |
| **Iconography** | `lucide-react` | `0.475.0` | https://lucide.dev | Standard tree-shakeable SVG icon set. |
| **Headless UI** | `@radix-ui/react-dialog`, `@radix-ui/react-slot` | `1.1.6` / `1.1.2` | https://www.radix-ui.com | Accessible, keyboard-friendly UI primitives. |
| **Query & Cache** | `@tanstack/react-query` | `5.66.0` | https://tanstack.com/query | Client-side cache for SQLite queries over Tauri IPC. |
| **Ephemeral UI State** | `zustand` | `5.0.3` | https://zustand-demo.pmnd.rs | Lightweight state management strictly for modals and draft UI focus. |
| **Test Runner (Frontend)** | `vitest` | `3.0.5` | https://vitest.dev | Fast ESM-native test runner for frontend logic and calculation fixtures. |

---

## 2. Durability & SQLite Storage Architecture
- **Journal Mode**: `WAL` (Write-Ahead Logging).
- **Synchronous Setting**: `FULL`. Every transaction commit flushes WAL frames to the OS using `fsync()`.
- **Foreign Keys**: Enabled on every connection (`PRAGMA foreign_keys = ON;`).
- **Busy Timeout**: `PRAGMA busy_timeout = 5000;`.
- **Database Location**: `$HOME/.local/share/billzen/billzen.db` on Linux.

---

## 3. Security & IPC Boundary Configuration
- **Air-Gapped Offline Policy**: No external network requests at runtime.
- **Content Security Policy (CSP)**:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost tauri:;`
- **Capabilities & Permissions**: Tauri 2 ACL capabilities file `src-tauri/capabilities/default.json` explicitly grants window access only to registered commands.
