# PixelAgent — Vision & Guardrails

> **Purpose of this file:** Read this BEFORE making any architectural decision, adding any feature, or starting any task. This document constrains scope and prevents drift.
> **Audience:** AI coding agents (Claude Code, Cursor, etc.) and human contributors.
> **Status:** Source of truth. If a decision conflicts with this doc, raise it in a PR — don't silently override.

---

## What PixelAgent IS

A **middleware/protocol layer** that sits between AI coding agents (Claude Code, Cursor, Aider) and the code they generate for UI.

**Core mechanism:**
1. Coding agent generates **DSL** (~300 tokens) instead of full code (~3000 tokens)
2. PixelAgent renders DSL → bitmap (zero LLM cost, ~3 seconds)
3. User reviews bitmap, requests edits
4. Coding agent generates **DSL patches** (~30 tokens) instead of regenerating code
5. Only when user approves final DSL → coding agent synthesizes real code (React/HTML/SwiftUI)

**Token savings: 85% per UI iteration loop.**

---

## What PixelAgent IS NOT

These boundaries are non-negotiable. Reject any feature/PR that crosses them.

| ❌ NOT this | ✅ Instead this |
|---|---|
| A design tool for end-users (Lovable/v0/Framer competitor) | Infrastructure for AI coding agents |
| A code generator for full apps | A UI-shell preview + edit layer |
| A backend/API/database framework | Stateless DSL processing only |
| A general-purpose programming language (yet) | A focused DSL for UI structure |
| A Figma replacement | A protocol that complements existing tools |
| A no-code platform | A pro-code accelerator |

**Critical:** PixelAgent does not handle: routing, state management, API calls, authentication, payments, business logic, database schema, deployment. These are the coding agent's job. Don't add commands or features to support them.

---

## The 3 Problems We Solve

Only build features that directly address one of these. Anything else is scope creep.

**Problem 1: Preview cost**
Coding agents currently generate full code (~3000 tokens, 30 seconds) just to show a preview. If user rejects, that's pure waste. → DSL preview (300 tokens, 3 seconds).

**Problem 2: Edit cost**
Each "make button green" feedback triggers full component regeneration. 5 edits = 5× cost. → Surgical DSL patches (30 tokens, ~$0.003).

**Problem 3: Inconsistency**
Coding agents produce 3 buttons with different spacing, 2 cards with different border-radius, missing hover states. User must spot and report each. → DSL `TOKEN` system + validator enforce consistency before code generation.

---

## Architectural Invariants

These are decisions already made. Don't re-litigate.

1. **DSL is the source of truth.** Edits modify DSL, never bitmap. Bitmap is rendered output.
2. **Headless Chrome is the renderer.** No custom rendering engine. Browser engine guarantees pixel-perfect parity with code output.
3. **Stateless service.** No database in core service. Each API call is independent.
4. **Open-source DSL spec, MIT.** Renderer service may be commercial, but spec/parser/grammar must stay MIT.
5. **MCP-first distribution.** Primary integration point is Anthropic's MCP. Direct API is secondary.
6. **TypeScript + Node.js.** No Python, Go, Rust in core packages. Single-language monorepo.
7. **DSL has 15 commands.** Adding a 16th command requires explicit vision-doc update.

---

## Feature Decision Filter

Before building ANY new feature, answer all 4:

1. **Which of the 3 Problems does this solve?** If "none of them" → reject.
2. **Does this make PixelAgent more like Lovable/v0?** If yes → reject (that's competitor territory).
3. **Does this require state, database, or backend logic?** If yes → reject (that's coding agent's job).
4. **Could a coding agent already do this without PixelAgent?** If yes → reject (we don't duplicate their work).

If feature passes all 4 filters, write a one-paragraph design note in `/docs/decisions/` before implementing.

---

## Roadmap Boundaries

### ✅ In scope (Phase 1 — current)
- DSL parser + validator
- Headless Chrome renderer (DSL → PNG)
- Preview API (`POST /preview`)
- Patch API (`POST /patch`)
- MCP server wrapper
- 1 codegen target (React + Tailwind)

### 🟡 Maybe scope (Phase 2 — after MVP validation)
- Vision-based verify (optional, opt-in)
- Pixel-trace bidirectional (click pixel → element ID)
- Additional codegen targets (HTML standalone, SwiftUI)
- Consistency validator (warnings for spacing drift, missing hover states)

### ❌ Explicit non-goals (do NOT build, even if requested)
- Component library / design system marketplace
- Visual drag-drop editor UI
- User authentication / accounts
- Project hosting / collaboration
- Figma plugin / Figma import
- Animation / transition support
- Responsive breakpoint logic (CSS handles this; DSL stays absolute)
- Real-time collaboration
- Version control for DSL files (git handles this)
- Deployment / hosting features
- Custom theming engine beyond TOKEN
- Plugin / extension system

If a user requests one of these, document it in `/docs/rejected-requests.md` with reason. Don't silently start building.

---

## Naming & Concept Boundaries

To prevent semantic drift, these terms are reserved with specific meanings:

| Term | Meaning | Don't use for |
|---|---|---|
| **DSL** | The PixelAgent declarative language | Don't call this a "framework" or "language" yet |
| **Patch** | Surgical edit to existing DSL (e.g., `PATCH btn bg:#10B981`) | Don't call generic edits "patches" |
| **Render** | DSL → bitmap PNG via headless Chrome | Don't use for code generation |
| **Synthesize** | DSL → React/HTML/SwiftUI code | Don't use for rendering |
| **Token** | Design token (`$primary`, `$radius`) | Don't confuse with LLM tokens (use "LLM tokens" for those) |
| **Element** | An entity with an ID in DSL (RECT, TEXT, LAYER, etc.) | Don't say "component" — that's React's term |
| **Scene IR** | Parsed AST of DSL | Don't say "DOM" or "tree" |

---

## Code Structure Rules

When working on this codebase, AI agents must respect:

1. **Monorepo structure is fixed.** Don't add new top-level packages without explicit approval. The 4 packages (`parser`, `renderer`, `api`, `codegen`) cover everything.

2. **Cross-package dependencies flow one way:**
   ```
   api → renderer → parser
   api → codegen → parser
   ```
   `parser` depends on nothing else. Don't introduce circular deps.

3. **No npm packages outside this allowlist** without justification:
   - `typescript`, `tsx`, `vitest`, `@types/node` (root)
   - `puppeteer` (renderer)
   - `fastify` (api)
   - `prettier` (codegen)
   - `@anthropic-ai/sdk` (when adding LLM-calling features in api)

   Anything else (lodash, axios, express, dotenv, etc.) requires a written justification in PR.

4. **No new file extensions or formats.** DSL is `.dsl` plain text. No JSON/YAML/TOML alternatives. No binary formats.

5. **No premature abstraction.** Don't add interfaces, factories, or DI containers until there are 3+ concrete implementations needing them. YAGNI hard.

---

## Pitch Discipline

When writing docs, marketing, READMEs, or commit messages, do NOT use these phrases:

- ❌ "AI design tool"
- ❌ "First to verify visually"
- ❌ "Generates beautiful UI"
- ❌ "No-code"
- ❌ "Replaces designers"
- ❌ "Pixel-perfect AI"
- ❌ Anything claiming superiority over Lovable/v0/Framer

DO use:
- ✅ "Middleware for AI coding agents"
- ✅ "Reduces token cost in UI iteration"
- ✅ "DSL preview layer for Claude Code / Cursor"
- ✅ "Surgical edit instead of regeneration"

---

## When the Vision Should Change

This document is not immutable, but changes require:

1. A written proposal in `/docs/vision-changes/YYYY-MM-DD-title.md`
2. Justification with measurable signal (e.g., "30% of users requested feature X over 3 months")
3. Explicit version bump of this file with changelog entry below

### Changelog
- **2025-11-06:** Initial vision document. Covers Phase 1 MVP scope.

---

## For AI Coding Agents Specifically

When working on this repo, follow these meta-rules:

1. **Read this file first.** Every session, before any other context.

2. **If a task seems to violate this vision, stop and ask the human.** Don't silently scope-creep. Examples of stop-and-ask triggers:
   - "Should we add user accounts?"
   - "Should we support Figma import?"
   - "Should we make this responsive?"
   - "Should we add a database?"
   - "Should this work without an LLM?" (yes, for parser/renderer; no, for patch/synthesize)

3. **When uncertain about scope, default to LESS not MORE.** Building extra features is harder to undo than adding them later.

4. **Don't generalize prematurely.** If only React codegen is needed, don't build a "code target plugin system" yet. Wait for the second target before abstracting.

5. **Reference this file in commit messages when relevant.** Example:
   ```
   feat: add LAYER nesting validation

   Per VISION.md "Architectural Invariants" #1 (DSL is source of truth),
   validation must run on parsed AST before render.
   ```

6. **If a feature falls in the "Maybe" or "Non-goals" list, point that out in PR description.** Don't merge silently.

7. **Long-running sessions: re-read this file every ~10 turns or when context window approaches limit.** Drift accumulates. Re-anchoring prevents it.

---

## North Star Metric

PixelAgent is successful when:

> A developer using Claude Code or Cursor can iterate on a UI screen 5 times for under $0.20 total LLM cost, with the final code being production-ready and visually identical to what they approved during preview.

Every feature should serve this metric. If a feature doesn't measurably improve cost, latency, accuracy, or final code quality — it doesn't belong.

---

## Final Note

The temptation to expand scope is constant. Lovable raised $330M doing what they do. Bolt is fast. v0 has distribution. We will not win by competing in their lane. We win by being the layer they all need but none of them want to build.

**Stay narrow. Stay focused. Ship the middleware.**