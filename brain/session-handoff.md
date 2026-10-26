# BillZen — resume here

Snapshot: 2026-10-26, Asia/Kolkata. B1 is complete in source at9158c40; current work is Laya/Gemini plan reconciliation and Antigravity handoff. Source commits f5a9317/49279a0/9158c40 are separate from published desktop0.1.6/Android0.1.5. Re-check live Git/CI before acting.

## Startup / authority

1. Read ../AGENTS.md, README.md in this brain directory, decisions.md and this handoff.
2. Read the recent entries of sessions.md, architecture.md's current-status notice, and relevant curated Graphify dependencies.
3. Inspect git status/log and source/specs before edits. Never overwrite owner work. Old agent prompts and chronological architecture notes are historical snapshots, not current instructions.
4. Read conversation-history.md on demand for the reasoning behind a request. Source/tests and actual release evidence settle implementation claims; latest explicit owner instruction settles intent.

## What is implemented

- Company setup, timezone/currency, offline Cashbook receipts/payments, numbered vouchers, transaction filters, reversals and explicit negative-balance confirmation.
- Today-first simple/analytical dashboard, period selectors, Reports search/party/account/type/category/classification/method filters, CSV and A4 statement/voucher output.
- Catalog/customers/categories, archive/restore and barcode lookup. Explicit Customer ↔ Cashbook party linking, all-linked-party history and Receive money shortcut; history links to party-filtered Reports. This is not invoice receivables.
- Atomic Cash↔Bank transfer header/two legs, retry/conflict protection, paired reversals and shared-number print/CSV presentation. Transfers excluded from business receipt/payment totals, included in account balances.
- Opening stock, Add/Reduce stock with reason, immutable history/opposite correction. No automatic sales or purchase cash posting.
- Current-source complete workspace backup1.2 includes saved invoice drafts and retry/deletion journal, with validated atomic restore and legacy1.0/1.1 imports. Native SQLite durability/worker/recovery and browser IndexedDB persistence remain. Published desktop0.1.6 uses backup1.1.
- Current-source Sales/Invoice drafts: multiple saved drafts, exact totals, customer/product/barcode/custom lines, conflict/lost-response handling, native/browser unsaved recovery and translated accessible DRAFT preview. No stock/cash/debt/final numbering changes. Not released or installed.
- EN/ML/AR+RTL; India/GCC currency exponents. Settings-only language and System/Light/Dark; onboarding/guide; responsive Reports and short-window scrolling; shared cancellable capsule/card/chart/dialog motion and reduced-motion support.
- Desktop signed updater and independent signed Android update manifest. Original branded platform icons and current README/media/Archify diagrams.

## Releases and installation — do not conflate

| Target | Current published state | Distribution / caveat |
| --- | --- | --- |
| Linux x64 | Desktop0.1.6 | AppImage supports updater; deb/bare binary manual update |
| Windows x64 | Desktop0.1.6 | NSIS .exe; updater configured; no Authenticode claim |
| Mac Apple Silicon | Desktop0.1.6 | DMG for first install; .app.tar.gz updater; ad-hoc, not notarized |
| Android arm64 | Android0.1.5 / code1010 | Original-certificate APK and independent pinned signed feed; no0.1.6 APK shipped |
| Intel Mac / iOS | No current installer | Do not promise distribution |

Desktop release: https://github.com/MohammedJabir18/BillZen/releases/tag/v0.1.6

Android file: https://github.com/MohammedJabir18/BillZen/releases/download/v0.1.5/billzen-beta-v0.1.5-arm64-v8a.apk

Desktop published source/tag is immutable `ad9845a0da90cbaf10f52136fbfb23e595c1edff`. Subsequent docs and customer test-fixture changes do not imply newer released application bytes. Defaults0.1.6/code1011 in source are not an Android release.

Installed Linux launcher uses `/home/jabir/.local/opt/billzen/BillZen.AppImage` via `APPIMAGE_EXTRACT_AND_RUN=1`. Hosted/installed SHA256: `a176de83e1fb55235c2147f3c748bc0cf0a45b827e10b5fd72bd867af5a7ff49`. Usual `src-tauri/target/release/billzen` is a bare source-build executable, not the updater-enabled shareable AppImage. Old running instances need reopening.

Public desktop0.1.5 did not include an updater: install0.1.6 once. Thereafter Settings → App updates → Check → Download → Install. Startup checks discover at most daily; they do not silently install. A higher correctly signed release/feed must be published. Keep unchanged signed Android feed in desktop-only latest releases.

## Latest observed verification

- README commit4ee5898: CI40040923344 **completed/success**, rechecked2026-10-24: https://github.com/MohammedJabir18/BillZen/actions/runs/40040923344
- Test-only calendar-safe customer history fix e73abb1: local Cargo118 and CI40007751868 passed. Old date-fixture failures are resolved, not a current blocker.
- Desktop package workflow40002290661 and draft assembly40003661548 passed. Exact released Linux AppImage passed68 native assertions; actual signed private-baseline upgrade/restart preserved synthetic records/settings. Original updater-less public0.1.5 was not that baseline.
- Windows/Mac hosted package/icon/architecture/signature checks passed; physical install/restart remains unverified. Browser screenshots are not native/device acceptance.
- README:11 fictional-data screenshots,2 original GIF/static sets, local media/link/provenance validation and1440/390 GFM preview passed. Archify viewers/specs/receipts and dark/light preview checked; PNG previews are SVG-region screenshots, not successful canonical menu exports.
- B1 final Graphify local code-only refresh succeeded:2171nodes/4833links. SQL parser unavailable; this is not full semantic/SQL coverage. Generated graph output ignored.
- Evidence: ../docs/verification-status.md, ../docs/distribution-v0.1.6.md, ../docs/readme-design.md, sessions.md.

## B1 completed in source; next gates

Read ../docs/invoice-drafts-guide.md and ../docs/invoice-drafts-implementation.md for current behavior/verification. Native lifecycle uses migration10 draft_create_operations and scoped serialized commands. Browser IndexedDBv6 has matching saved drafts/journal and separate local editor recovery. Backup1.2 preserves saved drafts/journal across native↔browser; legacy1.0/1.1 checksum-first imports remain. Original migration1–9 SQL is unchanged.

Sales/Drafts editor supports active catalog/customer selections, existing archived-reference warnings, exact quantities/money/tax, multiple drafts, preview, Back/focus and EN/ML/AR/RTL. Native recovery uses an atomic app-local file; browser Web Locks give one editor ownership before recovery read/actions. Expected currency is bound to intents/recovery and rechecked live; stale versions/currency cannot silently overwrite/reinterpret saved data. Unknown outcomes keep exact pending requests.

The independent final review found3 Important issues (cross-tab recovery loss, stale-currency reinterpretation, missing barcode Enter/focus); failing regression tests preceded fixes. No Critical/Minor reported. Full Rust128/frontend97/build, synthetic native→browser→native draft backup, expanded editor matrix and existing motion23/responsive/transfer UI passed. Exact local Linux production candidate passed78 native IPC assertions including draft/recovery/cold restart and unchanged real-data fingerprints. Header17 and full layout816states/0failed passed. Final source CI evidence is appended to sessions/verification status.

Task1 f5a9317 CI40107048721 and Task2 49279a0 CI40107658193 completed/success. Final editor9158c404b88113f4f02eacf0eac43832b08c97a5 CI40109783757 was rechecked completed/success during Laya research: https://github.com/MohammedJabir18/BillZen/actions/runs/40109783757 . No public updater feed, version, installed app, APK or signing credential changed. A local production Linux test binary is not an updater release.

Next approved product gates after B1: before B2 finalization, settle regional invoice profile/required fields, legal numbering/year/reset rules, availability policy and cost snapshots. B3 settlement/return/credit/allocation semantics remain separately gated. Supplier bills and device synchronization remain later phases. Do not begin financial posting or release publication based only on this handoff.

## Current requested work: Laya Feasibility Pilot (Foundation Gaps Closed)

Owner authorized scoped next step per docs/prompts/2026-10-26-antigravity-laya-feasibility-next.md and re-review docs/reviews/2026-10-26-antigravity-laya-c021767-rereview.md: close V1/V3 gaps, enforce V2 host contracts, and deliver bounded multi-provider feasibility runner.

- **V1 (Manifest & Asset Validation Hardening)**: Enhanced `tools/laya/validator.py` and `asset_manifest.schema.json`. Strict finite positive integer ranges for `max_rss_mb` (64–1024), `min_ram_mb` (>= 512), `max_warm_latency_ms` (1–2000), `max_load_timeout_ms` (1–15000); booleans, floats, strings, NaN, Inf strictly rejected. `verify_asset_file_integrity` now streams 64 KiB chunks and fails-closed on invalid/empty manifests (13/13 tests pass).
- **V1 (Dataset Schema & Laya Format Export)**: Enhanced `validate_dataset_case` in `prepare_dataset.py`: rejects non-string/boolean `group_id`, null text, invalid navigation expected targets, duplicate candidates. Added `export_case_to_laya_format` pure converter function (11/11 tests pass).
- **V2 (Host-Side Filtering Safety Contract)**: Added `tools/laya/host_policy.py`: filters out inactive/archived candidates, drops mismatched directions, strictly prevents unknown IDs from reaching host actions, rejects stale currency/context, and detects compound navigation intents ("Pay rent and record customer receipt") forcing clarification (4/4 tests pass).
- **V3 (Metrics & Machine-Readable Evaluator Outputs)**: Added `wilson_score_interval` (95% CI) to `tools/laya/evaluate_billzen.py`. Generated machine-readable benchmark reports (`tools/laya/reports/benchmark_dev.json`, `benchmark_holdout.json`). Corrected `docs/research/laya/baseline.md` to exact source numbers (Dev: 58/59, raw accuracy 0.9831 [0.9100, 0.9970]; Holdout: 17/23, raw accuracy 0.7391 [0.5353, 0.8745], decision precision 0.9444 [0.7424, 0.9901], actionable precision 1.0 [0.8064, 1.0]). Noted single dev error is Arabic `nav_ar_02` (clarify returned due to conservative ambiguity filter). Removed "zero memory" and unmeasured latency claims; noted heuristic confidence scores are uncalibrated indicators, not calibrated probabilities. Task×language cells with $n < 10$ flagged for insufficient evidence. Frozen holdout v1.0.0.
- **Section 2 (Multi-Provider Model Runner & Resource Feasibility Evidence)**: Implemented `tools/laya/runner.py` with shared `EvaluationProvider` interface (`RulesProvider`, `PythonLayaProvider`, `OnnxLayaProvider`). Reports `not_run` with explicit reason for unavailable model providers without mock pollution. Established separate preparation budget (>= 4.0 GiB available RAM) vs end-user inference ceiling (500 MiB target RSS, 750 MiB watchdog kill). Triggered concrete stop condition: documented **Resource NO-GO for local weights download/export on this workstation** (11th Gen i3, 0 GPU, only 1.4 GiB available RAM with 4.2 GiB active swap; missing RAM and GPU). (4/4 tests pass; total 43/43 pytest pass).
- **Next step / Review Gate**: Stopped cleanly before Tasks 4/5 (no production runtime/UI, no weights download, no fine-tuning). Ready for owner review and decision on path forward:
  1. Lightweight Rules Assistant (proven 94.4% decision precision, 100% actionable precision on holdout, runs cleanly within desktop process).
  2. Bounded Model Research on External/Adequately-Resourced Machine (where >= 8GB RAM and GPU are available for unquantized export and INT8 calibration).


## Memory maintenance / safety

Write detailed topic content first, then its pointer in brain/README.md. Keep the index short; append dated evidence to sessions.md. Update this handoff when active work changes. Never let historical unimplemented architecture paragraphs override current evidence.

Refresh Graphify locally: `graphify . --obsidian --obsidian-dir ./brain --update --code-only`. Semantic mode could upload repository content and was previously rejected by automatic approval review; do not retry it without separately authorized safe configuration. Missing SQL extraction stays an explicit limitation.

No passwords/private keys or business datasets are stored here. Preserve signing keys outside Git; do not recover credentials from old attachments based on this handoff. Private upgrade-test baselines are not distributable installers.
