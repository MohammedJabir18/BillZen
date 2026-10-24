# BillZen - Agent Instructions & Second Brain Workflow

You are the Lead AI Pair Programmer for this project. We strictly use a "Second Brain" architecture combining a local `brain/` directory and Graphify knowledge graphs for persistent memory across all sessions.

## Second Brain Workflow Rules

### 1. Directory Structure
- `brain/`: Persistent memory and knowledge base for the project.
  - `brain/sessions.md`: Log of every session (Date, goals, completed tasks, decisions made, and pending tasks).
  - `brain/architecture.md`: High-level system design, tech stack, data models, and API endpoints.
  - Graphify Obsidian vault files directly integrated into `brain/`.

### 2. Session Start Protocol (MANDATORY at the beginning of EVERY session)
Before writing any code or answering task questions:
1. Read `brain/README.md`, `brain/session-handoff.md` and `brain/decisions.md`, then the recent entries of `brain/sessions.md` to restore context. Load `brain/conversation-history.md` on demand for earlier requests; it is a reconstruction, not a verbatim transcript.
2. Read `brain/architecture.md` and the Graphify graph in `brain/` to understand current dependencies.
3. Greet the user with a short 2-bullet summary:
   - "Where we left off last time:"
   - "Recommended next step for this session:"

### 3. During Development
- Before modifying or creating major components, check `brain/` to avoid breaking existing features.
- If classes or APIs are added or modified, ensure they align with `brain/architecture.md`.

### 4. Session End / Wrap-Up Protocol (MANDATORY at the end of work)
When the user says "Wrap up this session" or when major milestones are completed:
1. Append a new entry to `brain/sessions.md` with:
   - Today's date and summary of changes made.
   - Files modified or added.
   - Unfinished tasks / immediate next steps for the next session.
2. Update `brain/architecture.md` if any architectural changes occurred.
3. Re-sync Graphify by running:
   ```bash
   graphify . --obsidian --obsidian-dir ./brain --update --code-only
   ```

Use local code-only extraction for this checkout. Semantic extraction may upload repository content and was previously rejected by automatic approval review; do not retry without separately authorized safe configuration. Record missing SQL/semantic coverage honestly.

## GitHub Delivery — User-authorized workflow

The owner explicitly requests a commit and GitHub push after each completed logical section. This applies to Antigravity and other coding agents working in this repository.

1. Complete a coherent, reviewable section (feature, correction or documentation section), not every individual line or save.
2. Inspect the diff and run the checks relevant to that section. Record actual results and meaningful limitations. Do not claim a failed or unrun check passed.
3. Stage only the intended files. Exclude secrets, real business records, local databases and generated build/test directories.
4. Commit with a descriptive message and push the current intended branch to `origin` using existing configured authentication. The current project branch is `main`; follow a user-requested feature-branch workflow when one exists.
5. Verify the remote commit matches, inspect the triggered CI run and report its actual state. Local success and remote CI success are separate facts.
6. Continue to the next independent section. If verification fails, fix it before marking that section complete; report any external blocker honestly.

Before committing, inspect `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`. Use the human contributor's GitHub-associated email or account-specific GitHub noreply address; never invent a `.local` placeholder identity. Owner-driven sessions in this checkout use `Mohammed Jabir <113545300+MohammedJabir18@users.noreply.github.com>`. Do not overwrite a different collaborator's identity or rewrite past commits merely to pass this check.

Never force-push, rewrite shared history, reset user changes or bypass a failed safety check to satisfy this rule. Do not put credentials in remote URLs, tracked files, prompts or logs. If authentication or push access is unavailable, retain the local commit and report the exact blocked step. Do not change repository visibility or publish application deployments without a separate user instruction.
