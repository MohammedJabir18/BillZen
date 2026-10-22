# GitHub commit attribution

## Diagnosis — 2026-10-22

Before correction, all69 original commits on main through `e2b2b59b0b62f6bea7521f809494d9debc7deb75` use author/committer `Jabir <jabir@billzen.local>`. GitHub's commit API returns null for their linked author and committer. The repository is public, standalone (not a fork), and main is its default branch. These observations identify the unlinked local email as the attribution problem; the display name alone does not determine contribution credit.

Authenticated owner: `MohammedJabir18`, account ID113545300, display name `Mohammed Jabir`. The public profile returns the owner's supplied Gmail address; the token cannot list verified email addresses (missing user scope). No additional account scope was requested. This checkout instead uses the account-specific GitHub noreply identity:

```text
Mohammed Jabir <113545300+MohammedJabir18@users.noreply.github.com>
```

Repository-local `user.name` and `user.email` were corrected; global settings were not changed. Agents must inspect effective author and committer before committing. Another checkout or a new computer needs its own configuration; this file does not configure Git automatically.

## Verify future commits

```bash
git config --local user.name "Mohammed Jabir"
git config --local user.email "113545300+MohammedJabir18@users.noreply.github.com"
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

These owner-specific values are for owner-operated checkouts. Collaborators must use their own linked identity. After a normal push, inspect GitHub's commit API: linked author/committer should resolve to the intended account. Contribution and contributor displays can require up to24 hours to refresh; correct API attribution is separate from visually refreshed profile statistics.

## Historical correction completed — 2026-10-23

The owner explicitly approved replacing shared main history for this correction after reviewing its scope and the standing no-rewrite rule. This was a one-time exception, not general permission to rewrite history.

- Old main:`d62098de1946517b1d1fc3c07e8c2527f7717af2`.
- Corrected main before this completion record:`a1a5b011bf498bf277fe140e62750e542556d5d5`.
- Exactly69 author and69 committer identities changed. The already-correct final commit retained its identity but received a new ID through its changed parent.
- All70 mapped commits retain byte-identical trees, full messages, dates/timezones, parent order/topology and unrelated headers. No signed commit headers were present. Full Git integrity and independent read-only verification passed.
- Main was published with an exact old-head `--force-with-lease`, so a concurrent remote update would have stopped publication. No unconditional force push or mirror push was used.
- GitHub's commits API linked author and committer for70/70 commits to `MohammedJabir18`. The contributors API also returned that account with70 contributions immediately after the rewrite. The profile calendar UI may refresh later; no particular total increment is promised.
- Release tag `v0.1.3` remains `99239635db043b0d2bf239461306a5ff4770eb02`. Release/asset IDs, names, sizes and digests match the pre-rewrite snapshot; no APK, installer, update manifest or feed changed.
- The existing checkout was fetched/synchronized by an identical-tree, expected-old-head ref update. No reset or tracked-file replacement was used. The previous head remains under local `refs/backup/attribution-before-20261023`.

Full recovery bundle: ignored local `test_artifacts/git-attribution/2026-10-23/remote-before-rewrite.bundle`, SHA256 `62a14786bc5dfd7e28a2071eb50d64cd9223e12ca5a71520c520dc9360423f7f`. Bundle verification confirmed complete original main/tag history. This local backup must not be published as a release asset. Original diagnosis backup remains available separately.

The [old/new commit map](history-attribution-map.csv) preserves historical provenance. Older build/source hashes in distribution notes identify the actual original builds and are intentionally not mass-replaced. Existing release tags retain their original history.

Other clones must deliberately synchronize with the corrected history; a fresh clone after saving local work is the simplest option. Do not merge the old main back into the corrected main. This machine's checkout has already been synchronized.

## Official references

- [Troubleshooting missing contributions](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)
- [Setting your commit email address](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)
- [Noreply email format](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)
- [Repository contributors and refresh behavior](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors)
