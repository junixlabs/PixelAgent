# Tech Debt — discovered during E2E

## REPEAT layout not applied at render time

**Found:** 2026-05-07, by visual E2E (Playwright MCP) of REPEAT count=5 with
`direction:column gap:8`. Expected 5 stacked rectangles; rendered output
shows only 1 visible rectangle — siblings overlap at the same position.

**Root cause:** `packages/renderer/src/dsl-to-html.ts` REPEAT case wraps the
iterations in `<div class="pa-flow">` instead of an auto-layout container.
The DSL parses `direction` and `gap` correctly into the AST, but the
renderer ignores them.

**Fix sketch:** REPEAT should render like STACK. Either:
- Reuse the STACK rendering path (compose `display:flex; flex-direction;
  gap`), or
- Add a `pa-stack` class with the same direction/gap kvs to the wrapper.

**Affected file:** `packages/renderer/src/dsl-to-html.ts:303-310` (the
`case 'repeat'` branch).

**Test coverage gap:** the renderer unit test
(`packages/renderer/tests/index.test.ts`) only asserts no duplicate ids in
the output HTML — never asserts visual layout. Add a test that renders
REPEAT count=N and checks the wrapper has `display:flex` (or equivalent)
applied.

**Priority:** medium. Doesn't break anything in the validated MVP path
(login, dashboard) since neither uses REPEAT, but breaks any list / repeated
component flow that the LLM might emit.

---

## Anthropic prompt cache disabled (intentional, but worth tracking)

`packages/api/src/services/anthropic-patch.ts` — `cache_control` was
removed because the system prompt is ~80 tokens (cache requires ≥1024).
If we expand the system prompt to the full DSL grammar (~2-3k tokens),
re-enable `cache_control: { type: 'ephemeral' }` so per-request input
costs drop ~10× on cache hit.

---

## Tools available but not exercised in E2E

- `pixelagent_synthesize` route is still a stub (501). Phase 2 codegen
  package is empty.
- MCP server preview/patch tools not directly E2E'd via a real MCP host
  (only smoke-tested via raw stdio JSON-RPC during the wrapper commit).
  Validation that Claude Code actually picks them up requires a local
  install + restart; track manually until CI can spin up an MCP host.
