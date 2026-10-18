# Antigravity handoff · M3.1 migration safety

Copy the following task into Antigravity. The GitHub delivery rule is also persisted in the repository's `AGENTS.md`.

---

Read AGENTS.md, brain/architecture.md, brain/sessions.md, docs/reviews/2026-10-18-m3-review.md, docs/verification-status.md and docs/roadmap.md before changing code.

Use the installed Superpowers systematic-debugging, test-driven-development and verification-before-completion skills for the correction. Use Karpathy Guidelines to keep the change focused, Harness Engineering for reliable verification/handoff, and Archify only if an architectural flow actually changes. Report unavailable skills accurately rather than pretending they ran.

## Objective

Close the M3.1 legacy-category upgrade blocker before starting M4 invoicing. V4 permits category case variants; the current V5 unique NOCASE index can fail on previously valid data and prevent startup.

## Section A · Diagnose the remote PDF discrepancy

Inspect CI run 39144580607 and its browser-verification artifact. Rust/unit/build/catalog passed, but the long-text PDF check missed the exact extracted string `South Asian Trans-Regional Infrastructure` while local output passed. Reproduce or inspect the PDF, extracted text, fonts and browser versions. Establish the cause before modifying layout or assertions. If whitespace normalization is justified, preserve detection of missing content, numeric errors and overflow. Commit/push this independently after verification and inspect its actual CI result.

## Section B · Required migration work

1. Reproduce the issue with an isolated V4 database containing `Groceries`, `groceries`, and products assigned to both. Write a regression test that fails against the current code.
2. Define a deterministic canonical category per collision group. Preserve product assignments, category metadata and recoverability. Document the policy.
3. Reconcile duplicates transactionally before enforcing uniqueness. Test injected failure/rollback and repeat startup.
4. Respect checksum-tracked migration history. Determine how the correction handles both a V4 database that never applied V5 and a database where V5 already succeeded. A later migration alone cannot repair an earlier failing migration. Do not silently edit applied migration checksums or bypass migration verification.
5. Confirm the intended scope of SQLite NOCASE; do not claim Unicode-wide case folding. Preserve foreign-key integrity and business records.
6. Expand numeric regression coverage to update rejection and inclusive maximum acceptance if it remains a small independent section.

Never delete the database, reset user data, disable foreign keys/checksums, discard product references or start unrelated invoicing/UI work to make this correction pass.

## Verification and delivery

Run the targeted regression first, then Rust tests, frontend tests, production build, native persistence probe, catalog browser automation and A4 PDF matrix. Distinguish browser mock checks, native worker checks and untested native UI/IPC paths. Inspect actual results.

Update verification status, roadmap, PRD/design notes if affected, and Second Brain session notes. Update diagrams only if their facts changed; preserve pinned source identity when regenerating.

After EACH completed logical section: inspect the diff, run relevant checks, stage only intended files, commit with a clear message, push normally to the intended GitHub branch, verify the remote SHA and inspect the triggered CI run. Report local results and actual remote status separately. Do not force-push, leak credentials or claim success with failing checks. Authentication blockers must be reported with the local checkpoint preserved.

Do not begin M4A until the migration blocker is resolved with the required evidence. Then propose the next bounded draft-invoice task: choose customer/items, calculate authoritative totals, save/reopen/edit a draft after restart, with no stock decrement or final number allocation.
