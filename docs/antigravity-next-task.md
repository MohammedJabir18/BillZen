# Next priority — Android update-enabled bootstrap acceptance

The owner approved signed in-app update delivery and selected the original public `MohammedJabir18/BillZen` repository for releases. The unused BillZen-releases repository was deleted at the owner's request. Do not re-create it or ask for design approval again.

Read AGENTS.md, brain/sessions.md, brain/architecture.md, `docs/android-update-delivery.md`, the approved release-update spec and implementation plan. Source implementation has started; **no distributable updater-enabled APK or end-to-end update acceptance exists yet**.

Blocking prerequisite: the owner does not know the existing Android APK keystore password. Preserve the original keystore/certificate. Recover its password via the original owner-controlled signing configuration, password manager or first APK build conversation. Do not print credentials, request them in chat, brute-force passwords, replace the APK signing key, uninstall the app or clear its business records.

A separate production Ed25519 manifest key/public pin must be provisioned securely. Do not ship the test fixture key or an updater-disabled build. After signing access is restored, verify 0.1.1/code1005 bootstrap against the existing certificate, then a strictly higher-code candidate with seeded company/voucher/product/customer/theme data. Test metadata, download, invalid signatures/certificates, permission return, activity recreation, cancellation, process restart and pre-migration recovery on a real emulator/device.

Desktop U3 and versioned draft-release publishing U4 remain pending. Ordinary CI pushes must not publish live app updates. Do not call this task complete from unit tests, Kotlin compilation or a mocked update toast. Existing loose Linux executable is not updater-ready.

Commit/push coherent verified sections per AGENTS.md. Report local and remote CI status separately; CLI authentication was unavailable at this checkpoint. Keep the next action focused on restoring signing continuity, not adding C2 financial features.
