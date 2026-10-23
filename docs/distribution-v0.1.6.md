# BillZen v0.1.6 distribution and acceptance

Published stable/latest: [v0.1.6](https://github.com/MohammedJabir18/BillZen/releases/tag/v0.1.6). Desktop bootstrap only; signed Android feed remains0.1.5/code1010 with its immutable APK URL.

## Provenance and packages

Application/package revision: `ad9845a0da90cbaf10f52136fbfb23e595c1edff`.
Successful complete packaging run: [40002290661](https://github.com/MohammedJabir18/BillZen/actions/runs/40002290661).
Verified draft assembly: [40003661548](https://github.com/MohammedJabir18/BillZen/actions/runs/40003661548).
The release tag retains its actual build revision; later delivery documentation/harness commits do not rewrite it.

| File | Bytes | SHA256 |
|---|---:|---|
| `BillZen-0.1.6-Linux-x64.deb` | 14,248,324 | `ff28b9c16951a7d2fe4d4b9d615144bc6d6532c2c1348131074dfcfba6fe01c8` |
| `BillZen-0.1.6-Linux-x64.AppImage` | 91,589,112 | `a176de83e1fb55235c2147f3c748bc0cf0a45b827e10b5fd72bd867af5a7ff49` |
| `BillZen-0.1.6-Windows-x64.exe` | 6,635,874 | `2fe9077ad299b69c10352b6b1276810dded4dd62f747a51378749766f5441523` |
| `BillZen-0.1.6-macOS-AppleSilicon.dmg` | 10,798,505 | `d315576e9e0e0c48cfd1947804a5fbff8b1aa6508b269c513a76594551f28076` |
| `BillZen-0.1.6-macOS-AppleSilicon.app.tar.gz` | 11,101,217 | `77368c8f95a061a0aaa2ef19ddfeac3c7336bbe5a312cfd0d3c4074cf113cd66` |

The19 published assets include ordinary installers, detached signatures, platform provenance/checksums/fragments, merged `desktop-update.json` and preserved signed `android-update.json`. All installer/server SHA256/size values matched build-info before publication; metadata/signature file hashes also matched. All three update package signatures and authenticated versions were cryptographically verified in the draft workflow before assets were uploaded. No private key/password was uploaded.

## Actual verification

- Frontend95 tests, native118 tests (one pre-existing synthetic interoperability fixture remains separately ignored), production build and publisher7 test files passed. Known frontend chunk/static-dynamic-import warnings remain.
- Desktop Settings harness checks desktop/Android routing, dirty/workspace/mutation/dialog protections, cancellation, failure recovery and non-dismissable/inert/focus-trapped installation. Four browser theme/viewport/offline scenarios passed. Independent reviewer confirmed the keyboard issue was fixed.
- Exact hosted Linux AppImage passed68 native assertions: real IPC updater guards/cancel/retry/database access plus cashbook, customer, stock, transfer, backup and cold restart. Real workspace fingerprints stayed unchanged.
- Actual signed upgrade passed from a **private updater-enabled test baseline** reporting0.1.5, using the immutable staged0.1.6 feed. This is not the original updater-less public0.1.5 app. Native download verified91,589,112bytes, installed the exact hosted SHA256, restarted into0.1.6, preserved a synthetic product and dark preference, and created a local before-app-update recovery snapshot. No business data was used. The staged release was promoted stable/latest only after this acceptance passed.
- Anonymous latest desktop endpoint returns0.1.6 with all three platform keys. Anonymous latest Android endpoint returns the exact unchanged signed0.1.5/code1010 envelope.
- Mac ARM64 architecture and deep/strict ad-hoc signature were checked on the application mounted from the actual DMG. Windows executable/installer icon resources were verified. Physical Mac/Windows install/restart tests were not performed; Linux success is not evidence for those platforms.

## Installation and next releases

The local Linux launcher now runs `/home/jabir/.local/opt/billzen/BillZen.AppImage` with extraction/run support for systems without FUSE. Its SHA256 matches the hosted artifact. Previous bare executable and launcher backup are retained; business data was untouched. Close/reopen an already running old instance to use the updated application. Debian and bare executable editions cannot install AppImage updates in-app.

Existing desktop0.1.5 recipients install the matching0.1.6 bootstrap once. Then use **Settings → App updates → Check for updates → Download update → Install update** for later published versions. Windows remains without Authenticode and macOS remains ad-hoc/not notarized; OS consent may appear. No IntelMac/iOS package is offered.

A source push alone does not deliver an update. Increment version, pass CI and signed full packaging, assemble a verified draft, then publish the new immutable version with both update endpoints. Preserve the desktop signing identity. See [updater maintainer guide](desktop-updates.md).
