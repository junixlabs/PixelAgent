# Tech Debt

## ~~REPEAT layout not applied at render time~~ — FIXED 2026-05-07

Rendered REPEAT iterations as `<div class="pa-flow">` and dropped
`direction`/`gap` from the AST, so siblings overlapped at the same
position regardless of count.

Fixed in `packages/renderer/src/dsl-to-html.ts` `case 'repeat'`: now
emits `class="pa-flow pa-stack"` with `flex-direction:<direction>` (default
`column`) and `gap:<n>px`. Two regression tests added in
`packages/renderer/tests/index.test.ts` to assert the flex style is
present, plus visual E2E re-run via Playwright MCP confirmed both
column-gap-8 and row-gap-12 layouts.

---

## Phase 2 surface — not debt, just unbuilt yet

- React codegen targets the rendered HTML 1:1 with Tailwind classes,
  but additional targets (HTML standalone, SwiftUI) are still stubs in
  `packages/codegen/src/`.
- The MCP server has only been smoke-tested via raw stdio JSON-RPC. Live
  validation through Claude Code (or any MCP host) requires a manual
  install + restart of the host — there's no automation that can spawn
  an MCP host on CI yet.
