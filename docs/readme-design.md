# README design, research & media provenance

## Information architecture

The README introduces the product, shows its actual state, provides a quick start, explains the runtime boundary, links verification/roadmap evidence, and identifies the maintainer and license. Detailed PRD, technical design and acceptance criteria live in linked documents so the repository entry page remains navigable.

This follows GitHub's guidance that README content explain what a project does, why it is useful, how to start, where to get help and who maintains it. Relative links/images keep documentation usable in clones. See [GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes).

## Visual system

- Deep ink surfaces, acid-green accents and restrained lavender details.
- One custom editorial hero rather than a stack of unrelated banners.
- A small badge row, clear section navigation and restrained emojis.
- A real UI tour, with a static gallery and explicit synthetic/browser labels.
- Theme-aware architecture previews and downloadable interactive Archify viewers.
- No fabricated awards, usage numbers, performance measurements, testimonials or platform certification.

GitHub supports common image formats including GIF and SVG, but its documentation states that SVG inline scripting/animation is not supported. The README therefore uses a raster GIF for motion and static SVG for the hero. Interactive diagrams are standalone HTML downloads, not pretend embedded web apps. See [GitHub non-code file support](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files).

## Media provenance

| Asset | Origin | Meaning |
| --- | --- | --- |
| `docs/brand/billzen-hero.svg` | Original code-authored vector artwork | Brand illustration, not a product screenshot |
| `docs/assets/billzen-tour.gif` | Four current catalog Playwright screenshots assembled into a looping tour | Synthetic browser demonstration, not native persistence evidence |
| Catalog gallery PNGs | Existing verification script, rerun on 18 October 2026 | Products, customers and Arabic RTL |
| Architecture light/dark PNGs | Archify visual-check captures | Source-backed current runtime at the pinned commit |
| Interactive diagram HTML/JSON | Archify 3 generator | Runtime flow and the requested delivery procedure |

The GIF is a slideshow tour rather than a continuous session recording. No third-party stock GIF or external hosted video is required. The README contains external badge image URLs; these are documentation assets, not application runtime dependencies.

## Keeping the page credible

Update screenshots after meaningful UI changes, refresh evidence dates/counts after actual runs, and keep current/planned features distinct. The personal website is an author link, not a live BillZen deployment. MIT text follows the [standard MIT template](https://choosealicense.com/licenses/mit/); bundled font notices remain separate.
