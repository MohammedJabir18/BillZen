# Next priority — Release delivery and in-app updates (U0)

Status: researched design proposed; implementation approval pending. C2 remains deferred behind the owner's update-delivery priority.

Read AGENTS.md, brain/sessions.md, brain/architecture.md, and `docs/superpowers/specs/2026-10-19-release-updates-design.md`.

The owner wants recipients to discover/install later releases inside the installed app instead of repeatedly receiving installer files. Existing direct APK recipients are the first audience. An updater-enabled bootstrap must be installed once because current releases contain no updater code.

Use installed brainstorming guidance to obtain approval of the complete proposed design, then writing-plans, test-driven-development, systematic-debugging and verification-before-completion. Apply Karpathy Guidelines and Harness Engineering. Do not invent skill/plugin availability or require every installed skill on every step.

The concrete design separates:
- Android direct APK discovery + authenticated manifest + existing certificate + OS installer consent.
- Desktop Tauri signed updates, using AppImage rather than the existing loose Linux executable.
- CI on ordinary pushes, draft releases on version-tag/manual runs, and owner-controlled stable promotion.
- Database recovery before migrations, including the bootstrap/external-upgrade path.

After design approval, deliver U1–U4 in order with Android and Linux first. Prepare a concrete implementation plan with small verified sections. Windows/macOS are advertised only after their own release gates pass. No release/visibility changes, production key generation, secret changes or live publication are authorized by this handoff alone.

Connected GitHub metadata confirms that the source repository is private. Keep it private; obtain approval for the proposed public artifact-only repository or website endpoint. Do not point anonymous clients directly at private release assets.

Key prerequisites to verify securely: GitHub CLI push/release access, anonymous download availability, continuity of the existing Android signing certificate, updater signing keys/public keys, monotonically increasing Android versionCode, and portable Android CI toolchain configuration. Never request secret values in chat or replace the existing Android signing identity.

Acceptance requires a real two-version native upgrade with populated local data preserved, plus offline, cancellation, invalid signature, wrong package/certificate, partial release and migration failure tests. A successful build or mocked Update button is insufficient.

Commit and push coherent verified sections per AGENTS.md. Preserve local commits and report exact authentication blockers. Do not label this feature complete before an installed bootstrap actually receives and installs a newer signed version.
