# Contributing

BillZen is in early development. Keep changes small and tied to a documented milestone. Read `AGENTS.md`, `brain/architecture.md` and the latest session notes before making architectural changes.

Use synthetic data. Never add credentials, customer databases or production invoices. Keep both dependency lockfiles. Add migrations rather than editing released ones. Business writes and financial checks belong behind the Rust boundary; browser mock behavior must not be described as native persistence.

Run the checks relevant to the change and include their actual results and limitations in the change description. Financial or persistence corrections need a meaningful regression test. Update documentation when behavior changes. See `docs/testing.md` for the full check list and `docs/roadmap.md` for the next milestone.

A project license has not yet been selected; discuss redistribution/contribution terms with the owner before external contributions.
