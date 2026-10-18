# Verification status

Review date: 2026-10-18. This file distinguishes local observations from product completion claims.

## Fresh verification

Fresh local runs during this documentation/upload session:

| Check | Result |
| --- | --- |
| `npm test` | 14 tests passed across 2 files |
| `npm run build` | TypeScript and Vite build passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 32 tests passed |
| Catalog Playwright | All 6 scripted steps passed |
| A4 PDF matrix | All 4 scenarios passed; page counts 1 / 3 / 1 / 1 |
| Catalog cross-process probe | Separate write and read/verify processes passed with an isolated temporary database |
| Documentation review | Relative links and source claims reviewed; minor corrections applied |

No GitHub Actions success is implied by local results. Physical printers and other native OS targets were not tested. Graphify code-only refresh passed; full document extraction requires an unconfigured LLM API key and SQL AST extraction requires an optional missing parser.

## Known issues before billing implementation

1. **Stock reconciliation:** an untracked product can retain nonzero opening stock without an opening movement. Enabling tracking later can expose stock with no matching ledger entry. Define and enforce transition rules; reproduce with a regression test.
2. **Catalog versus invoice price bounds:** catalog accepts values up to the JavaScript safe-integer limit, while invoice financial calculations cap a unit price at `MAX_MONEY_MINOR` (100,000,000,000). Align the shared contract before items enter billing.
3. **Quantity bounds:** enforce safe, domain-consistent integer ranges on every opening quantity and threshold through both native commands and UI parsing.
4. **Category uniqueness:** the unique name column is case-sensitive; a separate NOCASE index does not make it case-insensitively unique.
5. **Native UI coverage:** the cross-process probe does not replace webview/IPC end-to-end tests. Browser mock tests cannot establish native UI persistence.
6. **Probe portability:** the native npm probe is POSIX-only and uses a fixed temporary path. The publication workflow now installs Chrome and Poppler to match PDF script requirements; remote results still need verification.
7. **Product scope:** invoice draft/finalize transactions, stock decrements, payment allocation workflows, expense UI, backup/restore, encryption and synchronization remain incomplete.

Additional review targets: unsaved form navigation, localized input parsing, long catalog performance, native unauthorized-window command denial, responsive layouts and platform-specific printing.

## Publication scope

Documentation screenshots are synthetic browser demonstrations captured by the existing catalog script. They do not certify native runtime connectivity. No production database or customer documents should be uploaded.
