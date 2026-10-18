# Second Brain & Graphify Pair Programming Workflow

This workspace adheres strictly to the "Second Brain" architecture combining a local `brain/` directory and Graphify knowledge graphs for persistent memory across all sessions.

## 1. Directory Structure
- `brain/`: Persistent memory and knowledge base for the project.
  - `brain/sessions.md`: Log of every session (Date, goals, completed tasks, decisions made, and pending tasks).
  - `brain/architecture.md`: High-level system design, tech stack, data models, and API endpoints.
  - Graphify Obsidian vault files directly integrated into `brain/`.

## 2. Session Start Protocol (MANDATORY at the beginning of EVERY session)
Before writing any code or answering task questions:
1. Read `brain/sessions.md` to restore context from previous sessions.
2. Read `brain/architecture.md` and the Graphify graph in `brain/` to understand current dependencies.
3. Greet the user with a short 2-bullet summary:
   - "Where we left off last time:"
   - "Recommended next step for this session:"

## 3. During Development
- Before modifying or creating major components, check `brain/` to avoid breaking existing features.
- If classes or APIs are added or modified, ensure they align with `brain/architecture.md`.

## 4. Session End / Wrap-Up Protocol (MANDATORY at the end of work)
When the user says "Wrap up this session" or when major milestones are completed:
1. Append a new entry to `brain/sessions.md` with:
   - Today's date and summary of changes made.
   - Files modified or added.
   - Unfinished tasks / immediate next steps for the next session.
2. Update `brain/architecture.md` if any architectural changes occurred.
3. Re-sync Graphify by running:
   ```bash
   graphify . --obsidian --obsidian-dir ./brain --update
   ```
