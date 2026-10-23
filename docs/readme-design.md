# README design, research and media provenance

Refreshed 24 October 2026 against application source `be226299bbbce6ffbbf809fb3ad2709d6e8ffb2e`, the v0.1.6 delivery record, session history and current adapters. The subsequent calendar-test correction changes only a test fixture, not captured product behavior.

## What changed in the story

The early README described a catalog prototype, disposable browser records and October 18 checks. The current product centers company money: Cashbook, customer links, account transfers, stock adjustments, reporting, complete backup and signed multi-platform delivery. These shipped workflows now lead the page. Commercial invoicing, invoice receivables, supplier bills, encryption and device synchronization remain clearly separate planned work.

The reading order is product promise → real screen tour → device-specific downloads/updates → feature connections → worked business example → runtime architecture → development → scoped verification → roadmap/docs/maintainer. Longer galleries, numerical walkthroughs and commands use disclosure sections.

## GitHub research and rendering decisions

- The entry page explains purpose, usefulness, setup, help and ownership, with detailed material linked to guides. Relative repository links keep clones navigable. [GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes).
- GIF and SVG are supported images, but inline SVG scripts/animation are not supported. The hero is static SVG; motion uses real raster GIFs. Interactive Archify HTML is a downloadable viewer, not an embedded live README application. [Non-code file rendering](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files).
- The supported `picture` element provides light/dark architecture and reduced-motion static fallbacks. Explicit `<a name>` anchors keep section navigation independent of decorative headings. Alt text describes meaningful content. [Formatting, pictures and custom anchors](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax).
- Expandable sections keep optional media and technical details accessible without placing every image in the main reading path. [Collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections).

The live CI badge deliberately shows GitHub's actual state; recorded release checks name their source revision. No fabricated awards, customers, performance numbers, downloads, compliance certification or universal OS acceptance are implied.

## Visual direction

Keep the existing BillZen mark and acid-green/dark business-workspace identity. Use one editorial hero, a concise badge row, original media, meaningful emojis, generous spacing and comparison tables. Put humour in one small, relevant original cartoon rather than hotlinking unrelated reaction memes.

The main tour GIF is about 437KiB; the original chai-break GIF is about 224KiB. They have static PNG alternatives for reduced-motion readers. Exact committed sizes can be inspected in Git. No external GIF/video tracking host is needed; badges remain external documentation assets and are not application dependencies.

## Media provenance

| Asset | Source | What it proves |
| --- | --- | --- |
| `docs/brand/billzen-hero.svg` | Original vector artwork retaining canonical BillZen mark | Brand illustration; not a screenshot |
| `docs/assets/current/*.png` product screens | `scripts/capture_readme.js`, captured 24 October 2026 | Actual browser interface with fictional isolated IndexedDB records |
| `product-tour.gif` | `scripts/build_readme_media.py`, six product screenshots | Screen-to-screen slideshow; not a continuous recording/native persistence test |
| `offline-chai.gif` | Original code-drawn router/cup/receipt animation in the same script | Humour/brand illustration; no product evidence |
| Architecture/workflow PNGs | Static SVG-region capture from validated Archify viewers via `scripts/capture_readme_diagrams.mjs` | Static diagram model; source references/receipts accompany HTML |
| Diagram HTML/specifications/receipts | Installed Archify 3, pinned source revision above | Showcase validation, strict checks and browser containment/readability gates |

Capture uses a new Playwright browser context. No real company database, customer, email, transaction or signing secret is read. Fictional parties are Aster Cafe, Harbor Studio and Orchid Market. Opening account/transaction/stock examples are synthetic. Mobile captures exercise responsive web UI; they are not Android device screenshots.

The original comedic GIF and hero are authored for this MIT project. Bundled Noto fonts retain their existing OFL notices; Archify viewer code retains [its MIT notice](licenses/archify-MIT.txt). Historical October 18 media and viewers are retained for old documentation links, not presented as current screenshots.

## Reproduce and review

```sh
npm ci
node scripts/capture_readme.js
python3 scripts/build_readme_media.py
node scripts/capture_readme_diagrams.mjs
python3 scripts/verify_readme_media.py
```

Capture needs installed Chrome/Playwright; GIF generation needs Pillow. Diagram capture needs the checked viewers in `docs/diagrams/`. Curate and inspect outputs before committing: no automatic media mutation is part of normal application startup/build.

The update workflow checks local links/anchors, GIF frames/dimensions, exact diagram publication hashes, real-browser layouts and actual GitHub Markdown rendering. Diagram automated gates and perceptual screenshot review are recorded separately. Product build/test results remain the release's evidence, not a consequence of README rendering.

For the optional GitHub-rendered local preview, authenticate `gh`, then:

```sh
mkdir -p test_artifacts/readme-refresh
node --input-type=module -e 'import fs from "node:fs"; process.stdout.write(JSON.stringify({text:fs.readFileSync("README.md","utf8"),mode:"gfm",context:"MohammedJabir18/BillZen"}))' | gh api markdown --input - > test_artifacts/readme-refresh/github-rendered.html
node scripts/preview_readme.mjs
```

This uses GitHub's real GFM HTML with a small local reading stylesheet, not a pixel-identical copy of GitHub's CSS. Browser preview excludes remote badge loading; local screenshots/GIFs and expanded-gallery containment are checked at1440px and390px. Live badges link to their real remote sources. PNG menu export did not complete during media authoring, so the final static figures use the verified SVG-region capture path; no export success is claimed.
