# Graph Report - BillZen  (2026-10-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 263 nodes · 361 edges · 25 communities (16 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- package.json
- worker.rs
- App.tsx
- lib.rs
- financial.rs
- compilerOptions
- db/mod.rs
- financial.ts
- tauri.conf.json
- devDependencies
- BillZen Architecture
- dependencies
- system.rs
- default.json
- unprivileged.json
- Second Brain Workflow Rules
- billzen

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `calculate_line_item()` - 11 edges
3. `DbWorkerHandle` - 10 edges
4. `FinancialError` - 10 edges
5. `run_migrations()` - 10 edges
6. `DbError` - 9 edges
7. `calculate_invoice_totals()` - 8 edges
8. `isTauriEnvironment()` - 7 edges
9. `DbRequest` - 7 edges
10. `BillZen Architecture` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Session End Protocol` --references--> `BillZen Architecture`  [EXTRACTED]
  .agents/rules/brain-workflow.md → brain/architecture.md
- `Session Start Protocol` --references--> `BillZen Architecture`  [EXTRACTED]
  .agents/rules/brain-workflow.md → brain/architecture.md
- `Graphify Knowledge Sync` --conceptually_related_to--> `Second Brain Setup`  [INFERRED]
  .agents/rules/brain-workflow.md → brain/sessions.md
- `Second Brain Setup` --conceptually_related_to--> `Second Brain Workflow Rules`  [INFERRED]
  brain/sessions.md → .agents/rules/brain-workflow.md
- `Agent Instructions` --references--> `Second Brain Workflow Rules`  [INFERRED]
  AGENTS.md → .agents/rules/brain-workflow.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Second Brain Core Integration** — brain_sessions_session_log, brain_architecture_billzen_architecture, agents_rules_brain_workflow_rules [EXTRACTED 1.00]

## Communities (25 total, 9 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.07
Nodes (25): name, private, scripts, build, dev, preview, tauri, test (+17 more)

### Community 1 - "worker.rs"
Cohesion: 0.14
Nodes (11): get_business_settings(), update_business_settings(), DbRequest, GetBusinessSettings, Ping, UpdateBusinessSettings, DbWorkerHandle, fetch_business_settings() (+3 more)

### Community 2 - "App.tsx"
Cohesion: 0.19
Nodes (18): lucide-react, react, @tanstack/react-query, checkPrintSupport(), getBusinessSettings(), isTauriEnvironment(), pingBackend(), updateBusinessSettings() (+10 more)

### Community 3 - "lib.rs"
Cohesion: 0.11
Nodes (6): main(), acquire_instance_lock(), get_app_data_dir(), InstanceLock, run(), test_single_instance_lock_mutual_exclusion_and_release()

### Community 4 - "financial.rs"
Cohesion: 0.17
Nodes (21): calculate_invoice_totals(), calculate_line_item(), CURRENCY_MINOR_FACTOR, FinancialError, DiscountExceedsGross, Overflow, OverpaymentNotAllowed, QuantityOutOfBounds (+13 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 6 - "db/mod.rs"
Cohesion: 0.22
Nodes (14): configure_connection(), DbError, ChecksumMismatch, IntegrityCheckFailed, Io, Sqlite, initialize_database(), run_integrity_check() (+6 more)

### Community 7 - "financial.ts"
Cohesion: 0.13
Nodes (15): vitest, cases, description, scaling, currency_minor_factor, quantity_scaled_factor, tax_basis_points_factor, $schema (+7 more)

### Community 8 - "tauri.conf.json"
Cohesion: 0.12
Nodes (16): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+8 more)

### Community 9 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, autoprefixer, postcss, tailwindcss, @tauri-apps/cli, @types/node, @types/react, @types/react-dom (+4 more)

### Community 10 - "BillZen Architecture"
Cohesion: 0.25
Nodes (9): Session End Protocol, Session Start Protocol, API Endpoints, BillZen Architecture, Data Models, System Overview, Tech Stack, Session 2026-10-18: Project Initialization (+1 more)

### Community 11 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, clsx, lucide-react, react, react-dom, tailwind-merge, @tanstack/react-query, @tauri-apps/api (+1 more)

### Community 12 - "system.rs"
Cohesion: 0.29
Nodes (3): check_print_support(), PrintSupportInfo, BusinessSettings

### Community 13 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "unprivileged.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 15 - "Second Brain Workflow Rules"
Cohesion: 0.50
Nodes (4): Agent Instructions, Graphify Knowledge Sync, Second Brain Workflow Rules, Second Brain Setup

## Knowledge Gaps
- **28 isolated node(s):** `autoprefixer`, `clsx`, `postcss`, `tailwind-merge`, `tailwindcss` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 143 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `clsx`, `postcss` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `financial.ts` to `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `worker.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.13675213675213677 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.11462450592885376 - nodes in this community are weakly interconnected._