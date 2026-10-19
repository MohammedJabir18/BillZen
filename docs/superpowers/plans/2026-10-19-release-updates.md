# Signed release updates implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver update-enabled Android/Linux installations and versioned draft release automation while preserving offline company data.
**Architecture:** Settings uses platform update adapters; desktop uses the Tauri updater, Android uses authenticated metadata and native installer consent. Release discovery is anonymous HTTPS against the owner's existing repository, which the owner has now explicitly requested be public.
**Tech Stack:** Existing React/Tauri/Rust/SQLite, official updater plugins, Ed25519, Kotlin Android installer, GitHub Actions.
**Spec:** docs/superpowers/specs/2026-10-19-release-updates-design.md

## Global constraints
- Owner approved design and subsequently chose the existing BillZen repository made public, superseding separate artifact-repository hosting. Owner completed the visibility change; public access was verified.
- Preserve existing Android package and signing identity. Never expose secrets or substitute production signing keys.
- Normal pushes test; versioned jobs prepare drafts. Live stable publication remains an owner action.
- Native two-version upgrades with populated data are the completion gate. Missing signing credentials cannot be presented as passing.
- Remain on the owner's established main/current-checkout delivery workflow; do not reset existing commits or create an unsolicited worktree.

## Review focus
- Bootstrap/external install must snapshot before migrations, not after opening the migration-applying initializer.
- Missing endpoint/key or private feed must produce a truthful unavailable state, while offline billing stays usable.
- No install/restart while posting/restoring or with unsaved financial edits; reject invalid packages/signatures.
- Metadata and download limits, platform compatibility and cancellation are verified before installer handoff.
- Partial release jobs and missing credentials must leave the last stable release intact.

## U1 — foundation
- [ ] Add failing Rust tests for startup recovery of a populated older/WAL database before migrations; implement SQLite-supported recovery snapshots and fail closed on snapshot failure.
- [ ] Add failing Node tests for release version alignment/monotonic code and artifact metadata; implement central metadata validation without automatically bumping published versions.
- [ ] Add typed update status/state model, Settings section, localized offline/unconfigured behavior and tests; keep platform adapters separate.
- [ ] Verify tests and commit the coherent foundation.

## U2 — Android direct APK
- [ ] Write native tests for authenticated envelope, byte mutation, unknown key, package/version/ABI/size/URL rules; implement shared contract and publisher fixture generator.
- [ ] Implement bounded native metadata/download, cached artifact verification, Android permission/installer handoff and cancellation states.
- [ ] Preserve production certificate; prepare increasing-version builds. Test two versions on isolated emulator/device when signing material is available; otherwise record the exact gate blocked and continue independent tasks.

## U3 — desktop
- [ ] Install compatible desktop-only Tauri updater/process plugins with locked versions. Add signed manifest adapter and pre-install quiescence/recovery.
- [ ] Enable AppImage release packaging; loose executable builds report manual-install limitation.
- [ ] Test check/download/verification/error states; run a real signed two-version AppImage upgrade when signing material exists.

## U4 — draft pipeline and handoff
- [ ] Add release validator, draft-only trusted-ref workflows, explicit signing prerequisites, provenance and complete manifest generation. No public live release from ordinary pushes.
- [ ] Add cashbook/theme/PDF gates to CI and exclude debug APKs from manifests.
- [ ] Verify workflow/scripts, run relevant suites, rebuild relevant native targets and request one fresh final review.
- [ ] Update Second Brain/Graphify and delivery docs; commit/push verified sections. Report credentials/runtime gates separately.

## Execution ledger
- Approved: owner selected public hosting, then explicitly changed the choice to making existing MohammedJabir18/BillZen public and using its releases.
- Hosting action: Owner explicitly requested and confirmed deletion of BillZen-releases; GitHub UI confirmed successful deletion. Original BillZen is public.
- External blockers: CLI push authentication is unavailable; owner reports not knowing the existing Android APK keystore password. Production manifest key is not provisioned. No signed APK or native two-version update acceptance is claimed.
- Ruling: execute inline in the existing main checkout, honoring the established user workflow and avoiding another permission loop for a worktree.

## Current checkpoint
- Startup recovery, installer quiescence, version alignment, typed Settings screen, Android signed metadata/private download and installer bridge implemented in source.
- Fresh review found internal/external cache mismatch, transient installer-return handling and effective build-version override gaps. Corrections made with regression checks; final suites recorded in verification-status.md.
- U1 localization and native acceptance remain incomplete; U2 signed two-version acceptance remains blocked. U3 desktop runtime and U4 draft publishing workflow remain pending. Existing CI gained release-contract, update-screen, cashbook/theme/PDF gates; it does not publish.
- Next safe action: recover existing keystore password from original secure configuration or owner's original build conversation. Do not generate a replacement APK identity or send an updater-disabled/unsigned build to friends.
