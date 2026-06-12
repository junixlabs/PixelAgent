# PixelAgent

> **The determinism layer between AI coding agents and UI.**
> Edits are surgical patch ops — the AI structurally *cannot* change what
> you didn't ask for. Previews render without an LLM call. And yes, a
> 6-step iteration session also costs ~90% fewer tokens.

When a coding agent re-generates a component to apply one piece of
feedback ("make the button green"), every other element gets re-sampled
too: a border-radius drifts from 6px to 8px, spacing shifts by 4px, a
hover state silently disappears. Cheaper models don't fix this —
**regeneration is sampling, and sampling is stochastic.** You can't
discount your way out of variance.

PixelAgent inserts a typed DSL (PXL) between the agent and the pixels:

- The agent drafts in PXL (~300 LLM tokens), not code (~3,000).
- Headless Chrome renders it to a PNG or an interactive HTML preview —
  zero LLM cost.
- Each edit is a structured patch op (~25 tokens) applied locally and
  re-rendered.
- Only the approved DSL is synthesized into code — once, at the end,
  hash-bound to its source.

## Three guarantees

1. **No drift, by construction.** `{op:"modify", id:"login-btn",
   field:"variant", value:"destructive"}` can only touch `login-btn`.
   Every untouched element keeps its exact pixels — a structural
   guarantee, not a statistical one. The human reviews a 25-token diff
   instead of re-verifying a whole screen.
2. **Closed world.** An element's rendered appearance is a pure function
   of its own DSL line, the tokens it references, and the screen theme
   (`VISION.md` Invariant #8). No cascade, no specificity wars, no
   stylesheet override the agent can't see — the scene is statically
   reasonable from the text alone.
3. **Deterministic projection.** Same DSL → the same pixels (same Chrome
   engine that renders your production output) and byte-identical
   generated code carrying a `dsl-sha256` header. Drift between spec and
   code is machine-detectable, not a matter of trust.

## Hero demo — a real SaaS dashboard

Top nav, sidebar, four KPI cards with trend deltas, bar chart, activity
feed, and a transactions table. The PNG below is the actual output of
`POST /preview` in this repo — 138 lines of DSL → headless Chrome →
PNG, end-to-end in ~335ms warm.

![Real SaaS dashboard rendered from 138 lines of DSL](docs/images/hero-dashboard.png)

### Pixel-stable across edits

| Initial draft | After 1 op (`variant: destructive`) | After 3 ops (rename, placeholder, drop password) |
|:---:|:---:|:---:|
| ![](docs/images/login-01-default.png) | ![](docs/images/login-02-destructive.png) | ![](docs/images/login-03-final.png) |
| `~110 tokens DSL` | `~19 tokens (1 op)` | `~46 tokens (3 ops)` |

Every unchanged element keeps its exact pixel position — no drift, no
"the model rewrote the button radius from 6px to 8px again". The token
table below is the secondary benefit; this is the primary one.

### And it is also dramatically cheaper

| Action on the dashboard above | Vanilla coding agent | + PixelAgent | Saving |
|---|---|---|---|
| Initial render | ~2,200-token React component | ~1,650-token DSL | **−25%** |
| "Make the Conversion KPI green again" | re-emit full component, ~2,200 tokens | 1 patch op, ~25 tokens | **−99%** |
| **6-step session (1 draft + 5 edits)** | **~13,200 tokens** | **~1,775 tokens** | **−87%** |

![Edit flow — 1 draft + 2 follow-up edits](docs/images/edit-flow.png)

Initial-draft savings are modest on complex layouts; the win compounds
with every edit because patch ops stay ~constant regardless of screen
complexity. Token prices fall every year — the determinism guarantees
above don't depreciate.

## Why a DSL when models emit HTML for free?

Because generation was never the bottleneck — **verification is.**

- **Addressability.** "The login button" maps to `login-btn` directly.
  In raw HTML the agent must locate the element and may pick the wrong
  one; in PXL the id *is* the contract.
- **Review surface.** A patch *is* the diff. A re-emitted component
  forces the human to re-check everything, because anything may have
  changed. Model tokens get cheaper every quarter; human attention
  doesn't.
- **Static reasoning.** An agent holding 50 lines of PXL knows what
  every pixel will be. An agent holding 50 lines of HTML knows almost
  nothing for sure without the entire CSS context — HTML's semantics
  are non-local; PXL's are closed-world.
- **Machine-checkable consistency.** The validator measures what neither
  human eyes nor vision models measure reliably: WCAG contrast, token
  coverage, hover coverage, spacing rhythm — deterministic warnings
  with line numbers, before a single pixel renders. (It found a real
  30px/32px row-spacing drift in this repo's own hero example.)

## Try it locally

```bash
git clone git@github.com:junixlabs/PixelAgent.git
cd PixelAgent
npm install
npm run start --workspace=@pixelagent/api  # boots HTTP API on :3030
```

Render a PNG preview:

```bash
curl -sX POST localhost:3030/preview \
  -H 'content-type: application/json' \
  -d "{\"dsl\":\"$(cat packages/dsl-spec/examples/login.dsl | jq -Rs . | sed 's/^"//;s/"$//')\"}" \
  | jq -r .png_base64 | base64 -d > preview.png
```

Or an **interactive HTML preview** — hover/focus states live, click any
element to see its id:

```bash
curl -sX POST localhost:3030/preview \
  -H 'content-type: application/json' \
  -d "{\"dsl\":\"...\",\"format\":\"html\"}" | jq -r .html > preview.html
open preview.html
```

Apply a surgical edit (no LLM call — your agent supplies the ops):

```bash
curl -sX POST localhost:3030/apply-patch \
  -H 'content-type: application/json' \
  -d '{"dsl":"...","ops":[{"op":"modify","id":"login-btn","field":"variant","value":"destructive"}]}' \
  | jq -r .png_base64 | base64 -d > patched.png
```

Or wire it into Claude Code as an MCP server (no API key needed) —
see [`docs/mcp-integration.md`](docs/mcp-integration.md).

## Multi-screen flows

`goto:<screen-id>` on BUTTON / TEXT / ICON / IMAGE links screens into a
navigable prototype — Figma-prototype-grade, zero logic. A click in
preview can do exactly two things: reveal a visual state, or jump to
another screen. Nothing else, by design.

```bash
curl -sX POST localhost:3030/preview \
  -H 'content-type: application/json' \
  -d '{"screens":{"login":"SCREEN 400 300\nBUTTON b 10 10 120 40 \"Go\" goto:home\n","home":"SCREEN 400 300\nTEXT t 10 10 \"Hi\"\n"},"entry":"login"}' \
  | jq -r .html > flow.html && open flow.html
```

Each screen lives in its own iframe — tokens, ids, and STATE css cannot
leak across screens (Invariant #8 again).

## Production-ready synthesis

`POST /synthesize` maps the approved DSL deterministically to a semantic
React + Tailwind component — no LLM call:

- `level:h1` → `<h1>`, `role:nav` → `<nav>`, `alt:` lands on a real
  `<img>`, `href:` wraps the element in `<a>`. Search engines and screen
  readers read what you shipped.
- **Synthesis contract:** the generated file opens with
  `// GENERATED by PixelAgent -- dsl-sha256:<hash>` and exposes `text` /
  `on` props keyed by element id. Your data and handlers live in a
  wrapper you own; regeneration never collides with it. CI can gate on
  `verifySynthesizedCode(code, dsl)` from `@pixelagent/codegen` — a
  hand-edited generated file or an un-regenerated DSL both fail loudly
  instead of rotting silently.

## Status

**Phase 1 (MVP core) + Level 2 — done.**

- DSL parser, serializer, surgical `applyPatch` with per-node-type field
  validation.
- Consistency validator: `low-contrast`, `token-coverage`,
  `hover-coverage`, `spacing-rhythm` — conservative by design (skip
  rather than guess; silent on honest drafts).
- Renderer: DSL → PNG (~330ms warm) and interactive HTML (hover/focus
  live, click → element id), theme-aware dark canvas.
- Flow links: `goto:` + stateless multi-screen bundles.
- Codegen: semantic React + Tailwind with the synthesis contract.
- HTTP API (`/preview`, `/apply-patch`, `/synthesize`) + MCP server
  (`pixelagent_preview`, `pixelagent_apply_patch`,
  `pixelagent_synthesize`, `pixelagent://grammar` resource). Hardened
  against LLM-malformed input.

**Next:** real-world benchmarks (a drift benchmark — vanilla agent
editing HTML N times vs PXL patches, pixel-diffing the untouched
regions — plus measured token costs and DSL first-try accuracy across
models), MCP registry listing, additional codegen targets, CLI binary,
CI pipeline.

## DSL at a glance

Fifteen commands — that number is constitutional (`VISION.md`):

```
Setup:      SCREEN, TOKEN
Paint:      FILL, RECT, TEXT, ICON, IMAGE
Components: INPUT, BUTTON
Layout:     LAYER, STACK, GRID
Meta:       STATE, REPEAT, EFFECT
```

```
SCREEN 1440 900 theme:dark

TOKEN primary #185FA5
TOKEN surface #1F2937

LAYER login-card 500 260 440 400 bg:$surface r:12 role:main
  TEXT brand 0 20 "Acme" size:20 weight:semibold align:center max-width:440 level:h1
  INPUT email-input 32 80 376 44 type:email label:"Email"
  BUTTON login-btn 32 224 376 48 "Sign in" variant:primary goto:home
END

STATE login-btn hover
  bg: #0C447C
END
```

Semantic intent params (`level:`, `alt:`, `href:`, `role:`) and flow
links (`goto:`) are renderer-inert — pixels never change; they exist so
the synthesized code is semantic and screens connect in preview. Full
grammar, parameter tables, and validation rules:
[`packages/dsl-spec/SPEC.md`](packages/dsl-spec/SPEC.md).

## API reference

### `POST /preview`

Single screen: `{ dsl, scale?, format? }` — `format:"png"` (default)
returns `{ png_base64, render_ms, warnings }`; `format:"html"` skips
Chrome entirely and returns `{ html, render_ms, warnings }` with the
interactive preview.

Multi-screen: `{ screens: { "<id>": "<dsl>", … }, entry, format? }` —
returns a navigable HTML bundle (default) or per-screen
`{ pngs_base64 }`. Stateless: the whole bundle travels in each request.
`goto:` targets missing from the bundle yield `goto-unknown-screen`
warnings; parse failures name the offending screen.

### `POST /apply-patch`

`{ dsl, ops } → { new_dsl, applied, png_base64, warnings }`. No LLM
call — the caller's agent supplies the ops. Each op is validated against
the target node type's writable fields; failed ops are skipped and
reported, later ops still apply.

### `POST /synthesize`

`{ dsl, target:"react" } → { code, warnings }`. Deterministic AST →
semantic React + Tailwind, with the synthesis-contract header and props.

All warnings carry `{ rule, line, severity, message }`.

## Repository structure

```
packages/
  dsl-spec/   # Canonical DSL types + SPEC.md. No runtime deps.
  parser/     # DSL → AST: tokenizer, parser, validator, serializer, applyPatch.
  renderer/   # AST → HTML → PNG (Puppeteer); interactive + bundle HTML.
  api/        # Fastify HTTP API; pure services shared with MCP.
  mcp/        # MCP stdio server: preview / apply_patch / synthesize + grammar resource.
  codegen/    # AST → React (semantic, contract-signed). HTML/SwiftUI planned.
```

Dependency direction: `api → renderer → parser`, `api → codegen → parser`.

## Technical decisions

1. **Headless Chrome as render engine** — battle-tested, pixel-perfect,
   and the same engine your shipped code runs in. A custom renderer is
   six months of font-hinting pain for negative value.
2. **DSL as a public contract** — spec correctness over feature count;
   breaking changes are versioned (`SPEC.md` §6).
3. **Edit on AST, never on bitmap** — single source of truth; enables
   patches, undo, and codegen.
4. **Open-source spec (MIT), commercial service** — open spec earns
   trust and adoption; the hosted renderer/API is the revenue stream.
5. **MCP-first distribution** — built-in path to Claude Code users;
   Cursor and friends speak MCP too.

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Anthropic/OpenAI build native DSL preview | High | Open-source spec, become the standard first |
| Coding agents struggle to write PXL | High | Grammar resource ships in the MCP server; measure first-try accuracy, redesign grammar if <80% |
| Renderer fidelity gap (preview ≠ shipped code) | Medium | Same Chrome engine both sides; theme/variant values spelled out in SPEC and mirrored in codegen |
| Pricing model unclear | Medium | Free tier + hosted SLA, pattern from Vercel/Cloudflare |

## License

MIT for the DSL spec, parser, and examples.
The renderer service and hosted API are under a separate commercial
license (TBD).

## Contributing

Architecture is settled; issues and PRs welcome — see
[`docs/GITFLOW.md`](docs/GITFLOW.md) for the trunk-based workflow.

## Resources

- **DSL spec:** [`packages/dsl-spec/SPEC.md`](packages/dsl-spec/SPEC.md)
- **Vision & guardrails:** [`VISION.md`](VISION.md)
- **MCP setup:** [`docs/mcp-integration.md`](docs/mcp-integration.md)
- **Git workflow:** [`docs/GITFLOW.md`](docs/GITFLOW.md)
- **Tech debt:** [`docs/tech-debt.md`](docs/tech-debt.md)
- **Examples:** [`packages/dsl-spec/examples/`](packages/dsl-spec/examples/)

---

**Maintainer:** [@junixlabs](https://github.com/junixlabs)
**North Star:** a developer iterates on a UI screen 5 times for under
$0.20 total LLM cost, and the final code is production-ready and
visually identical to what they approved in preview.
