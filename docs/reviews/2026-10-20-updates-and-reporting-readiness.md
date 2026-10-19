# Android update audit and reporting/dashboard discovery

Date: 2026-10-20. Evidence baseline: local and origin/main `019f1ce5de40c14399944899e705a735154a2011`. This is a review and a disposable mockup, not a completed reporting feature or a full approved implementation design.

## Outcome

The signed ARM64 bootstrap exists and matches its declared metadata. Normal signed-feed update acceptance remains incomplete. Fix the failed CI and updater test bypass, then correct financial aggregation parity before using the cashbook as the source for new dashboards/reports.

The owner explicitly chose **today's receipts/payments** as the default landing view and accepted an interactive browser mockup. Requested production capabilities: simple overview, optional analytics, daily/monthly/yearly/custom reports, transaction filters and understandable terminology across desktop/mobile/web.

## Verified independently

- Local worktree was clean at review start; local HEAD and origin/main both matched `019f1ce`.
- `dist-android/billzen-beta-v0.1.1-arm64-v8a.apk` exists. Android tools verify signing certificate SHA-256 `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`, package `com.billzen.desktop`, version 0.1.1/code1005, minimum SDK24. Its SHA-256 is `495f086218303099edece69c2435106e36bf9072b2821085ea6f9f7897ab5d99`.
- Node crypto verified `dist-android/android-update.json` against the declared pinned Ed25519 public key; its ARM64 hash and byte size match the actual APK.
- Existing release-script tests pass on a fresh local run. The full 89 Rust/43 frontend suites and 27-assertion Android suite were not rerun in this review.
- The saved Android report records a real OS installation from 1005 to1006 on Android14 x86_64, with seeded data checks. It is useful **installer integration evidence**, with the limitations below.
- Public GitHub Actions run `39315441133` completed with **failure**. Rust job succeeded. Frontend build, unit/release tests and catalog checks succeeded; `Run Playwright Responsive Verification` failed. Later onboarding/matrix/update/theme/PDF steps were skipped. Node action deprecation warnings do not establish the cause.
- Public GitHub releases API returned an empty list at review time. No public updater feed/release is live merely because a manifest exists on disk.

## Findings to resolve

### 1. Production update preparation accepts a test-only unsigned approval fallback

`src-tauri/src/commands/updates.rs:74` accepts an existing `install-approved` JSON file when there is no authenticated release in `UpdateService`, then replaces its timestamp with a fresh approval. This path was introduced to support externally staged test APKs. Android's private directory and certificate checks still constrain it, so this is not evidence of an arbitrary remote install; it nevertheless bypasses the specified manifest/replay/compatibility authorization boundary and must not be the production recovery mechanism.

Remove the fallback from distribution builds. If persistent download recovery is needed, persist the exact signed envelope and reverify its signature, package/channel/ABI/SDK/version/replay floor, artifact size and hash before creating a new short-lived approval. Keep test staging helpers outside the production runtime.

### 2. The 27-assertion test bypasses discovery/download and forces cancellation recovery

`scripts/verify_android_update_flow.js:307` writes APK/approval files directly into private cache using privileged emulator commands. There are no normal `check_android_update` or `download_android_update` calls in this script. Around lines701 and721 it suppresses preparation errors and explicitly invokes `resume_after_update` after cancellation. A later successful product read does not therefore prove that the app resumed itself.

Retain narrow installer tampering tests, but add a separate end-to-end path through authenticated metadata, bounded download and the real Settings UI. Prove automatic cancellation/recreation recovery without a test invoking the recovery command on the app's behalf. Test production-equivalent no-debug builds as well as instrumented test APKs. Do not describe this current harness as full signed-feed auto-update acceptance.

### 3. Browser financial summaries disagree with native semantics

`src/adapters/web_cashbook_db.ts:1303` builds period totals from search/classification-filtered vouchers, sets opening balance to zero, uses an all-time closing balance and treats all net cash as operating cash. Native `fetch_cashbook_ledger` separates period/account totals from display-only matching totals and limits operating cash to operating classifications.

A fresh in-memory probe used synthetic INR records only: prior-day operating receipt ₹100; selected-day operating receipt ₹50 and loan receipt ₹200. No real company database or browser profile was opened.

| Field | Required by native contract | Browser result |
|---|---:|---:|
| Selected-day opening | ₹100 | ₹0 |
| Selected-day receipts | ₹250 | ₹250 |
| Operating net cash | ₹50 | ₹250 |
| Closing | ₹350 | ₹350 in this fixture |
| Period receipts after a non-matching search | ₹250 | ₹0 |

Also cover a movement after the selected period: browser closing currently includes it. Reconcile native/browser contracts with the same fixtures before charts, reports or exports consume the summary. Historical account totals must include archived records when the selected scope calls for them.

### 4. CI's responsive harness appears to test the wrong initial screen

`scripts/verify_responsive_playwright.js:121` looks for Add Product immediately after opening the app; `src/App.tsx` defaults to Cashbook. The harness does not first select Products. Remote logs contain no successful modal-open check, while overflow, navigation, RTL, customers and settings checks pass. Inspect the uploaded responsive JSON to confirm this diagnosis, navigate through the actual UI, then keep the modal assertion mandatory. Do not make CI green by removing the assertion or assuming all responsive checks passed.

### 5. Release documentation contradicts itself

`docs/android-update-delivery.md` now declares a verified signed release at the top but still says the APK password is unavailable, a production manifest key was never generated and no two-version test passed. Update it with the exact achieved evidence and the remaining signed-feed/production-build limits. A draft or local APK is not a published update feed.

### 6. Credential handling in the pasted transcript must not be repeated

The supplied transcript shows GitHub credentials being recovered from another MCP process's `/proc/.../environ` and used through a temporary askpass script. Use the connected GitHub tool within its own authentication boundary or properly configured Git/gh authentication instead. Do not extract connector tokens from process memory/environment, place credentials in prompts/logs or reproduce those commands. No claim is made here that the token value was published; the review did not retrieve it.

## Proposed reporting experience — awaiting mockup feedback

### Simple overview (default)

- Start at Today in the configured company's timezone.
- Four primary values: money received, money paid, net cash change, balance at the end of the selected period. Show starting balance alongside the explanation.
- Cash/Bank/account breakdown; five latest transactions; shortcuts to the existing receipt/payment forms.
- One row of period choices: Day/Month/Year/Custom, with accessible date/month/year selection and previous/next navigation in the real implementation. The prototype only illustrates Today/current month/current year/custom.
- Calendar month/year is the initial proposal; current month/year are visibly period-to-date. Custom dates can represent an owner's financial year. This is not a tax/GST/statutory reporting feature.

### Optional analytical view

- Same period/account scope; a small receipts-versus-payments chart and category spending breakdown, with readable amounts/table alternatives.
- Keep loan, capital, advance, refunds and correction information distinguishable. Do not call net cash movement profit, turnover or sales revenue.
- No complex KPI grid, compulsory cloud analytics, 3D charts, decorative gauges or unnecessary dependency/framework upgrades.

### Reports

- Daily, monthly, yearly and custom date ranges; account scope; detail filters for direction, category, party, payment method, classification, reversal/correction status and search.
- Separate period/account balance summary from matching-row totals when detail/search filters are active. Never invent a category-specific cash balance by adding a partial subset to the full opening balance.
- A4 PDF preview/export and CSV first, using the exact same complete filtered data as the report—not just the visible paginated rows. Multi-sheet XLSX is a separately planned C2 extension.
- Include business identity, currency, timezone/date range, active filters, starting balance, receipts/payments, closing balance, transaction count and page totals/numbering. Repeated table headers and embedded offline fonts are required. Confirm Malayalam/Arabic glyph coverage before claiming multilingual PDF support.

## Required calculation and acceptance principles

- Source money from persisted cashbook movements. Draft/non-posted records without ledger movements do not create cash flow. Do not sum unrelated invoices/payments/expenses tables alongside cashbook entries.
- Opening = account opening amounts + all signed movements before start. Closing = opening + signed movements through the inclusive selected end. Checked integer minor units only; enforce current bounds and 2/3-decimal currency parity.
- Original and reversal movements appear exactly once on their own business dates; do not remove originals and also count compensating movements. Explain corrections separately from ordinary business payments. Snapshot a prior-date report to ensure a later reversal does not rewrite its history.
- Future internal transfers must net to zero for company-wide flow and remain visible for account-specific balances; prevent classification as business revenue/expense. Do not silently implement the transfer module as part of a dashboard.
- Native queries use bound parameters and aggregate the full scope in a consistent read snapshot. Browser calculations use the same contract and a consistent IndexedDB read. Pagination never determines totals; define deterministic ordering, empty states and overflow errors.
- Test India/GCC timezone boundaries, leap years, month/year rollover, invalid/empty/future date ranges, archived accounts, loans/capital, reversals across periods, refunds, search filters, large totals, backdated entries and identical SQLite/IndexedDB fixtures.
- Then validate browser/mobile/native views, light/dark/RTL/accessibility, offline use, PDF/CSV parity and populated upgrade/backup regression. Do not claim Windows/macOS/iOS acceptance from a Linux or x86 emulator run.

## Next order of work

1. Review the mockup and settle the visual requirements; no production dashboard implementation was changed in this review.
2. Correct failed responsive CI, signed-feed test gaps and production fallback before promoting the bootstrap publicly.
3. Implement and verify a shared reports/summary contract, starting with browser/native parity fixes.
4. Add simple Today overview, optional analytics and report filters/exports as separate coherent sections.
5. Rebuild and publish a tested higher-version release through the approved release process, with separate local and remote CI evidence.

Mockup artifact: `docs/mockups/2026-10-20-dashboard-reports-v1.html`. It is synthetic, interactive and independent of the real application. Buttons marked as preview shortcuts do not post records. Its print function prints the prototype, not a completed production report engine.
