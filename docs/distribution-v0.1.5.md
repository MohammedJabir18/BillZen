# BillZen v0.1.5 distribution — 2026-10-23

Published as the [public latest release](https://github.com/MohammedJabir18/BillZen/releases/tag/v0.1.5), with16 assets. Android versionCode1010; original package/certificate and signed-manifest identity retained.

## Files to share

Mac cousin (M-series): **BillZen-0.1.5-macOS-AppleSilicon.dmg**. Open the disk image and drag BillZen into Applications. Ad-hoc signature is verified, but this is not Apple Developer ID-signed/notarized. See [Apple's per-app approval guidance](https://support.apple.com/en-us/102445); do not disable Gatekeeper globally.

Windows64-bit: `.exe`; Ubuntu/Debian64-bit: `.deb`; other compatible Linux64-bit: `.AppImage` (mark executable). Android ARM64: `.apk`, installed over the same existing app. Static web ZIP requires HTTP hosting; it is not a website deployment or standalone file:// application. No Intel Mac/iPhone distribution.

Android updater-enabled installations can discover this version through Settings while online, with Android installation consent. Desktop automatic updater feeds remain unconfigured: download the new matching installer.

## Exact package checksums

| File | Bytes | SHA256 |
|---|---:|---|
| `BillZen-0.1.5-macOS-AppleSilicon.dmg` | 10,089,171 | `fc515411d29383c6e757d292d635a864028955c55e1d1f91b5262a3d7296f520` |
| `BillZen-0.1.5-Windows-x64.exe` | 6,238,935 | `61d4ffc14a93c8927bbd9020c5be128ef366836550dbfd7b464a339226d28abb` |
| `BillZen-0.1.5-Linux-x64.deb` | 13,212,482 | `7a36c392165947c4e07ae5b82a9fc62d85df06e47bb8cca05fff4e35b5ea9191` |
| `BillZen-0.1.5-Linux-x64.AppImage` | 90,687,992 | `77d2f00bf4f03da4129f1d3271334139a92234e229997e041f09c2653df0ceb1` |
| `billzen-beta-v0.1.5-arm64-v8a.apk` | 21,236,360 | `313897ecbdc0ad57cfdd7844d2c751ef55ff401784a6397b8e024e01c9c9ad42` |
| `BillZen-0.1.5-Web.zip` | 671,944 | `d3dbefd3a2dbd49102b626e604838f55489a940b128b600442bb32f980169190` |

The release also includes global/per-platform checksums, build-info provenance, signed android-update.json and release-verification.json. All16 uploaded file sizes and GitHub-computed SHA256 digests matched local preflight before publication. Anonymous latest-feed fetch returned0.1.5/code1010; anonymous Mac DMG download matched its checksum.

## Build and acceptance provenance

- Application source:665f2eb2c18b8041c666300c795e2c6325216dcc; its full source CI passed.
- Linux/Windows package workflow39964406925: both jobs passed, including native73/frontend81/publisher checks, Windows icon resources and installer collection.
- Mac workflow39995681279 from064423014f67e80c53268fb86c1ee3c8ef3d34bd passed. This revision changes only workflow/docs versus the application source. The delivered DMG was mounted read-only; contained ARM64 executable, deep/strict signature and plist version were checked.
- Independent workflow review found no remaining blocker. Initial Windows Unix-only test fixture and Mac intermediate-app verification errors were corrected; required tests were not skipped.
- Exact Linux Debian-packaged executable passed57 isolated native checks, stock/transfer/customer flows and cold restart. Real business-data fingerprints unchanged. Installed per-user executable SHA256 b8dbdbd225b6a51103b0f021f38427ce7fe4bbb2bdf2e02ed3a904ae9c8c6221; prior executable preserved as billzen.before-v0.1.5-e0e25bf37fa2. Restart app.
- Android original-certificate signature, exact current assets/commands, non-debuggable release, metadata and16KB packaging/ELF alignment passed. No new physical Android/Mac/Windows runtime acceptance is claimed. Windows Authenticode and Apple notarization are absent.

Source tagv0.1.5 remains immutable at0644230. Publication does not imply completed invoice finalization, supplier bills or synchronization. See [release notes](releases/v0.1.5.md).
