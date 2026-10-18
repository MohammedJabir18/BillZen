# Testing

Run `npm test`, `npm run build` and `cargo test --manifest-path src-tauri/Cargo.toml` first.

## Browser automation

Install Playwright Chromium and native dependencies with `npx playwright install --with-deps chromium`. Run the production build before `npm run test:catalog`. That script starts Vite preview on port 4175 and uses the browser demonstration adapter. It checks catalog interactions, not native SQLite persistence.

`npm run test:matrix` starts its own preview server and generates four A4 PDF fixtures under `test_artifacts/pdf/`. It currently requests the Chrome channel explicitly. Google Chrome and Poppler tools must therefore be installed. `pdfinfo`, `pdftotext` and `pdftoppm` are used to inspect output. Catalog screenshots/reports are written under `test_artifacts/catalog/`; both artifact directories are ignored by Git.

## Cross-process persistence probe

The following POSIX commands create an owned temporary directory, write synthetic data in one process and verify it in a second process:

```sh
probe_dir=$(mktemp -d)
cargo run --bin catalog_probe --manifest-path src-tauri/Cargo.toml -- "$probe_dir/catalog.db" write
cargo run --bin catalog_probe --manifest-path src-tauri/Cargo.toml -- "$probe_dir/catalog.db" read_and_verify
# Keep the directory for inspection if either command fails.
# Remove only this owned temporary directory after successful verification:
rm -r -- "$probe_dir"
```

Prefer `npm run test:native-probe`: its Node runner now uses `os.tmpdir()`, an isolated temporary directory and two child processes. It cleans up its owned directory in a finally block. The manual commands above are a POSIX alternative. Runtime execution of the portable runner has only been verified on Linux. This probe exercises the actual Rust worker and SQLite across process restarts. It does not drive a Tauri webview, IPC calls or native print dialogs.

## Evidence boundaries

| Check | Establishes | Does not establish |
| --- | --- | --- |
| Vitest | Tested frontend arithmetic/document behavior | Complete financial or legal correctness |
| Cargo | Tested Rust/database/configuration behavior | Runtime IPC permissions on every platform |
| Catalog Playwright | Browser UI interactions with mock data | Native persistence |
| Catalog probe | Worker persistence across separate processes | Desktop UI end-to-end behavior |
| PDF matrix | Chromium A4 output for four fixtures | WebKitGTK rendering parity, paper output or thermal support |
| Current Linux CI | Jobs on one Linux runner configuration | Windows, macOS, Android or iOS certification |

A physical printer is unavailable. Record physical printing as not run. Native print dialog behavior must also remain a separate check. CI explicitly installs Chromium, Chrome and Poppler and retains generated browser artifacts for 14 days. Check the actual remote run before claiming CI passes.
