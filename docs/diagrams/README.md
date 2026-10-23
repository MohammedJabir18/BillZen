# Explore BillZen with Archify

Current diagrams refreshed 24 October 2026. Both trace committed application source at [`be226299bbbce6ffbbf809fb3ad2709d6e8ffb2e`](https://github.com/MohammedJabir18/BillZen/tree/be226299bbbce6ffbbf809fb3ad2709d6e8ffb2e); later documentation and calendar-test-only changes do not alter those runtime facts.

## Architecture · local by design

[Interactive HTML](billzen-runtime.html) · [Source specification](billzen-runtime.spec.json) · [Finalization receipt](billzen-runtime.receipt.json)

![BillZen runtime architecture](../assets/current/architecture-dark.png)

The React workspace calls typed adapters. Native commands dispatch to the serialized Rust/SQLite worker; browser paths persist in IndexedDB. Print rendering and explicit signed desktop updates are separate branches. The update network does not host business records. This is an overview of cooperating roles, not a claim that every catalog/business command is listed individually.

## Business workflow · from movement to a report

[Interactive HTML](business-workflow.html) · [Source specification](business-workflow.spec.json) · [Finalization receipt](business-workflow.receipt.json)

![Company money and inventory workflow](../assets/current/business-workflow.png)

Company setup/accounts → receipt or payment → posted ledger → Dashboard/Reports. A customer shortcut prefills the party; complete workspace backup exports the relevant records. Product Add/Reduce and history remain a separate stock path. Cards explain atomic transfers and boundaries: customer cash history is not invoice debt, and stock changes do not post money automatically.

Arrows describe supported user/data relationships, not unattended automation: users choose entry, export and stock actions.

## Open, verify and reproduce

GitHub displays HTML source rather than executing this viewer in README. Download its raw HTML and open it in a browser for source links, theme switching, node exploration and optional finite trace motion. The static PNG remains complete without motion; no hosted diagram service is required.

Both current candidates passed **showcase validation → delivery → strict artifact check → real-browser check**, with zero diagnostics. Light/dark captures were generated and visually inspected separately; final README PNGs capture the static SVG region with viewer buttons hidden in the temporary capture DOM. Published HTML copies are byte-identical to checked artifacts. Automated receipts do not themselves certify perceptual quality.

Specifications retain their original portable `.archify/` output paths. Place a specification at the corresponding `candidate.json` path, then run the installed Archify CLI:

```sh
node /path/to/archify/bin/archify.mjs finalize architecture .archify/architecture-billzen-runtime-20261024-001813/candidate.json .archify/architecture-billzen-runtime-20261024-001813/billzen-runtime.html --repo-root . --quality showcase --json
node /path/to/archify/bin/archify.mjs finalize workflow .archify/workflow-business-workflow-20261024-001813/candidate.json .archify/workflow-business-workflow-20261024-001813/business-workflow.html --repo-root . --quality showcase --json
```

After a candidate change, refresh source evidence, rerun finalization with a new evidence directory when prior browser evidence exists, inspect captures, and replace the publication copies/previews together. Root README capture scripts are described in [media provenance](../readme-design.md).

## Archived early diagrams

The [catalog-era architecture](billzen-system.html), its [specification](billzen-system.spec.json), and [verified section-delivery procedure](verified-delivery.html) remain available for historical links. The early runtime diagram describes the old browser mock and is **not the current storage architecture**. The delivery workflow is an engineering procedure, not an app business process. [Reporting data-flow study](reporting-data-flow.html) is a separate earlier design artifact.

## License

Viewer runtime code is distributed with the [Archify MIT notice](../licenses/archify-MIT.txt). BillZen's authored diagrams/media retain the project's MIT license.
