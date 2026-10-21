# BillZen 0.1.3 Android candidate

Version: **0.1.3 / Android versionCode 1008** (strictly above the previous distributed code 1007).

This candidate includes the Precision Ledger Dashboard/Cashbook/Reports work, Settings-only language selection, removal of shell platform/framework/diagnostic labels, corrected Reports category filtering and readable category names in CSV/PDF exports. Company records stay on the device.

## Distribution identity

- Package: `com.billzen.desktop`.
- Same original BillZen Beta certificate; expected SHA-256 `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`.
- Friend distribution: `dist-android/billzen-beta-v0.1.3-arm64-v8a.apk`; ARM64, minimum Android 7/API24. No claim of compatibility with 32-bit-only phones.
- `billzen-test-v0.1.3-x86_64.apk` is an automation build with WebView debugging; do not send it to friends or list it in update metadata.
- Production Ed25519 update public pin is retained. APK signing and manifest signing remain separate; private inputs stay outside Git and never appear in command text or logs.

## Sharing and later updates

Install the signed ARM64 APK over the previous BillZen installation. Preserve the package/signing identity; do not uninstall or clear storage to update. Android may require permission to install an APK and user confirmation.

The updater-enabled APK checks the existing BillZen GitHub release feed. A source push runs CI; it does not itself publish an app update. Future higher-code releases need the verified APK and signed `android-update.json` published under the original public BillZen repository. A prepared local candidate/manifest is not a live update feed. No live release is published by this build task.

## Verification scope

Static packaging checks cover certificate, version/package, ABI, 16KB zip/ELF alignment, embedded assets/fonts and disabled distribution WebView debugging. Automated upgrade acceptance uses the dedicated Android14 x86_64 test AVD, with a pre-upgrade snapshot of company/accounts, five synthetic vouchers, inventory/customer records and device preferences. It upgrades in place without uninstalling or clearing storage, compares state, exercises Settings language and Arabic Reports, and verifies cold-restart preservation. ARM64 handset acceptance is separate from the x86 emulator.

### Verified candidate — 2026-10-21

- Built on October 20; final acceptance completed October 21 after the desktop session interruption. The interrupted run was not counted as a pass.
- Dedicated Android14 x86_64 AVD: **22/22 assertions passed**, comparing the saved code1006 baseline against installed code1008. Company/account/category/party/voucher/product/customer data and preferences matched before UI testing; financial/catalog data and Arabic language persisted after cold restart. No uninstall or storage clearing.
- Linux native acceptance: **39/39 assertions passed** against isolated temporary SQLite data, including cold restart and unchanged real-data fingerprints.
- Frontend: **72/72 tests**; release-contract suite: **3/3 test files**. Version guard passed against previous distributed code1007. See `verification-status.md` for browser UI coverage.
- ARM64 APK: **20,544,136 bytes**, SHA-256 `5bc9716964545174155b63097bf5f988a3d5f4c321adacfa9f2e91bed3dd21dd`.
- Automation-only x86_64 APK SHA-256: `429ff5b42b7ff1bf84411cb8b50479badfa16831ce15075178ea2752ee168636`.
- Linux executable: `src-tauri/target/release/billzen`, **20,671,560 bytes**, SHA-256 `0ba1ff05cb027e9d938d12bca06ec41c569b64e27e81dc67f62aec86088685af`.
- Local release candidate files: `dist-android/v0.1.3/manifest-payload.json` and `android-update.json`. The Ed25519 envelope verifies against the existing app public pin; APK hash, size and versionCode match. The asset URL is a future release location, not evidence of publication.
- Evidence: ignored `test_artifacts/android_candidate/report.json`, `reports-arabic.png` and `before.json`; `scripts/verify_android_candidate.js` captures a baseline before installing the candidate and verifies it afterwards. Use a populated dedicated `billzen_test_avd`; capture each baseline once, before upgrade. Verification intentionally changes only test-device language to Arabic.
- This run does **not** establish physical ARM64 handset compatibility, a fresh end-to-end signed-feed download/Android installer handoff, physical printing, or Windows/macOS/iOS native acceptance. Historical updater tests are not presented as newly rerun.
- Distribution APK has WebView debugging disabled. Build emitted existing Gradle DSL/NDK-selection warnings; packaging and 16KB checks succeeded. No replacement signing key was created.
