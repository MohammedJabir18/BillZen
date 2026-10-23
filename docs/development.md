# Development

## Toolchains

Use Node.js 22.12+ in the 22 series, npm and a stable Rust compiler compatible with the checked-in Cargo lockfile. Install frontend dependencies with `npm ci`. Keep `package-lock.json` and `src-tauri/Cargo.lock` in version control. The exact host compiler versions recorded in older notes are observations, not portable setup prerequisites or promises of latest stable releases.

Linux requires WebKitGTK 4.1 and the development packages shown in the README. PDF checks need `poppler-utils`. Windows requires the C++ build tools and WebView2 runtime; macOS requires Xcode command-line tools. Signed installer/update packaging is covered by Desktop Release Packages for Windows x64, Linux x64 and Apple Silicon Mac. Windows/macOS physical install/restart acceptance remains separate. Android ARM64 configuration and signed APK delivery are implemented and require SDK/NDK tooling; iOS packaging remains future work. See distribution-v0.1.6.md.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite browser application; supported records persist in IndexedDB, not SQLite |
| `npm run tauri dev` | Native application with SQLite |
| `npm run build` | TypeScript check and Vite production assets |
| `npm run tauri build` | Host-native application and configured bundles |
| `npm test` | Frontend unit tests |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust tests |
| `npm run test:catalog` | Browser catalog automation |
| `npm run test:matrix` | Browser A4 PDF scenarios |

The native application uses actual OS application data. Use synthetic records and a disposable OS profile for exploratory testing. Worker probes take an explicit temporary database path and do not need to open the production database.

## Repository hygiene

Commit source, migrations, lockfiles and curated documentation assets. Exclude databases (including WAL/SHM files), `.env` files, credentials, build directories and generated verification reports. `.env.example` may contain placeholders only. Preserve `brain/architecture.md` and `brain/sessions.md` as project memory; generated notes can become stale and must not override code evidence.

Do not silently upgrade the framework during a feature task. Verify a proposed stable dependency update against official release notes and this project's tests before changing lockfiles.


## Application branding

The canonical app mark is `public/brand/billzen-icon.svg`. Run `npm run icons:generate` to refresh native, browser and README icon assets. See [brand identity](brand/README.md) for the complete surface list and platform boundaries.
