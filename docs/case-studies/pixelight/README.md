# Case study #1 — Pixelight homepage

First real-world test of PXL against a production page: the homepage of
Pixelight (a live seller-operations/fulfillment marketing site — 16 static
HTML pages sharing one 2,241-line stylesheet).

**Question:** can the 15-command DSL express a real production marketing
page, and does the full loop (draft → lint → patch → render → synthesize)
hold up outside our own examples?

## Artifacts

| File | What |
|---|---|
| `real-homepage.png` | The production page, 1440×3980, `.reveal` sections force-shown |
| `homepage.dsl` | The PXL reproduction — 213 lines, after the patch round |
| `pxl-draft-1.png` | First render, before any edit |
| `pxl-final.png` | After the 6-op patch round |
| `GeneratedHomepage.tsx.txt` | Synthesized React, hash-verified |

## Numbers

| Metric | Value |
|---|---|
| Real page | 153 lines HTML + 2,241 lines shared CSS |
| PXL reproduction | 213 lines, ~3,400 LLM tokens |
| First-try parse | **0 errors** on a 200+ line document |
| Full-page render (1440×3760) | ~1.6s cold |
| Patch round | 6 ops ≈ **138 tokens** (vs ~3,400 to re-emit the DSL, ~6,200 to re-emit the React) |
| Validator after patch | 0 warnings |
| Synthesized React | ~24.7KB, `<header>/<aside>/<section>/<footer>/<h1>/<h2>/<a href>` all present, `dsl-sha256` verified |

## The loop, as it actually ran

1. **Draft** — one shot, all 8 sections (header, hero, marquee, services,
   trust band, why-grid, CTA band, footer). Parsed clean first try.
2. **Lint** — the validator flagged 5 things: 4 buttons missing `STATE
   hover` while one had it (`hover-coverage`), and one `align:center`
   misuse (`text-center-needs-maxwidth`). All correct calls.
3. **Patch** — 6 ops (2 modifies + 4 `add` STATE-hover nodes), ~138
   tokens. Re-render: zero warnings, everything else pixel-identical.
4. **Synthesize** — semantic React with the contract header;
   `verifySynthesizedCode` → `true`.

## What the 15 commands expressed well

- The complete page structure, 1:1 — including the full-bleed dark trust
  band, the 3×3 benefits grid, the brown CTA panel with a 2×2 mini-grid,
  and a 5-column footer (STACKs made the footer columns trivial).
- The palette as 11 TOKENs. Re-skinning the entire page = patching 11
  lines. In the real stylesheet the brown appears dozens of times.
- Semantic intent end-to-end: `role:header/aside/section/footer`,
  `level:h1/h2`, `href:` on every nav and footer link — the synthesized
  code is crawlable in a way the *hand-written* original already is, but
  generated div-soup would not have been.
- A finding about the original, not about PXL: `.trust-section` is
  defined **four times** in the real stylesheet (lines 623, 678, 702,
  771) with escalating `!important` overrides. That is the open-world
  CSS problem in the wild — in PXL's closed world this bug class is
  *inexpressible*, not just discouraged.

## Where PXL hit its ceiling (honest list)

1. **Font families.** The real design leans on Marcellus (serif) display
   headings; the renderer hard-codes Inter. This is the single biggest
   visual gap. Candidate spec question: a `TOKEN font` / SCREEN-level
   typeface slot (param, not a 16th command) — needs a vision decision.
2. **Gradients.** Page background and trust band are linear-gradients;
   `FILL`/`bg:` are solid-only. Flattened to mid-tones.
3. **Icon glyphs.** The site uses inline custom SVGs; PXL `ICON` resolves
   named glyphs only. Approximated as brown rounded chips.
4. **Local image assets.** `pixelight-flow.png` can't resolve (renderer
   has no asset base directory), so the hero visual is a labeled
   placeholder. Candidate tech-debt: an assets base-URL option on
   preview.
5. **Button variants are a closed set.** The design's bordered "light"
   button has no exact variant; `ghost`/`secondary` approximate it.
6. **By-design exclusions held up fine:** marquee animation, dropdown
   menu, search-panel logic — none belong in a preview layer, and their
   absence cost nothing for layout review.
7. **Serializer drops comments.** The DSL's design-intent header comment
   vanished after the patch round-trip. Minor, but agents (and humans)
   annotate drafts — worth keeping comments through serialize.

## Verdict

A 15-command DSL reproduced a real production marketing page's full
structure on the first parse, the validator drove a 138-token cleanup
round that touched nothing else, and synthesis produced semantic,
hash-verified React. The expressiveness gaps are real but specific —
fonts and gradients are visual-fidelity items (spec-level decisions);
assets and comments are tooling items (tech debt). Nothing in the list
challenges the architecture.
