# GitHub commit attribution

## Diagnosis — 2026-10-22

All69 commits on main through `e2b2b59b0b62f6bea7521f809494d9debc7deb75` use author/committer `Jabir <jabir@billzen.local>`. GitHub's commit API returns null for their linked author and committer. The repository is public, standalone (not a fork), and main is its default branch. These observations identify the unlinked local email as the attribution problem; the display name alone does not determine contribution credit.

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

## Historical69 commits: pending owner decision

Changing local configuration affects future commits only. GitHub does not support linking generic `.local` addresses. A `.mailmap` display alias or a fresh empty commit is not a repair of historical contribution credit.

Recoverable backup: ignored local `test_artifacts/git-attribution/before-identity-fix.bundle`; `git bundle verify` succeeded and records complete history. It contains local Git refs and must not be published as a release asset.

Proposed correction scope, **not executed**:

1. Snapshot the current remote refs and retain the verified backup.
2. In a separate disposable clone, change author/committer identity only where the original email is exactly `jabir@billzen.local`, retaining original author/committer dates, messages, parent ordering and file contents. Leave existing correctly attributed commits alone.
3. Verify each old/new commit pair has the same tree, message and timestamps; inspect the full mapping and unchanged current application tree.
4. Obtain explicit approval to replace shared main history before publishing. This changes affected commit IDs and descendant IDs, so collaborators/checkouts, CI/source links and release provenance need deliberate handling. Keep existing release tags/assets/feed untouched unless separately approved.
5. If approved, publish only against the previously inspected remote head using a lease-protected operation, then verify GitHub attribution and wait for statistics refresh. Never use an unconditional force push.

The repository's standing AGENTS.md instruction currently prohibits force-push/shared history rewriting. No historical rewrite or tag/release change has been performed; a specific owner instruction overriding that prohibition is required before step4/5. Future-commit identity correction does not recover the historical69 contributions by itself.

## Official references

- [Troubleshooting missing contributions](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)
- [Setting your commit email address](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)
- [Noreply email format](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)
- [Repository contributors and refresh behavior](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors)
