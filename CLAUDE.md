# Project: PixelAgent — Instructions for Claude Code

> This file is automatically loaded by Claude Code at the start of each session.
> Read `VISION.md` for the full constitutional document. This file is the quick reference.

---

## Before You Do Anything

1. **Read `VISION.md`** at repo root. It defines what PixelAgent is, isn't, and the boundaries you must respect.
2. **Read `README.md`** for current implementation status and roadmap phase.
3. **If the user's request seems to expand scope, STOP and confirm.** Don't silently build.

---

## What This Repo Is

PixelAgent: middleware between AI coding agents and code generation. Reduces token cost ~85% during UI iteration through DSL preview + surgical patches.

**Not a design tool. Not a Lovable competitor. Not a no-code platform.**

---

## The 3 Problems (verbatim — don't infer)

**Problem 1 — Preview cost:** Coding agents generate full code
(~3000 tokens, 30s) just to show a preview. If user rejects = waste.
DSL preview = 300 tokens, 3 seconds.

**Problem 2 — Edit cost:** Each micro-edit triggers full component
regeneration. 5 edits = 5× cost. DSL patches = 30 tokens, 100× cheaper.

**Problem 3 — Inconsistency:** Agents produce mismatched spacing,
border-radius, missing hover states. User must spot each manually.
TOKEN system + validator enforce consistency before codegen.

---

## What This Repo Is NOT

If a task involves any of these, ask the user before proceeding:

- ❌ Adding authentication, accounts, or user state
- ❌ Adding a database (we are stateless)
- ❌ Adding routing, navigation, or app-level logic
- ❌ Building a visual editor or drag-drop UI
- ❌ Supporting Figma import or design system marketplace
- ❌ Adding animations, transitions, or interactivity to DSL
- ❌ Building a "framework" — we are a focused DSL processor

The full non-goals list is in `VISION.md`. Don't build any of them, even if it seems helpful.

---

## DSL Has 15 Commands. That's It.

```
Setup:      SCREEN, TOKEN
Paint:      FILL, RECT, TEXT, ICON, IMAGE
Components: INPUT, BUTTON
Layout:     LAYER, STACK, GRID
Meta:       STATE, REPEAT, EFFECT
```

**Adding a 16th command requires updating `VISION.md` first.** Don't add commands ad-hoc to support edge cases. Find a way to express the need with existing commands, or escalate to the human.

---

## Stack Constraints

- TypeScript + Node.js only. No Python/Go/Rust in core.
- npm workspaces (no Lerna/Nx/pnpm).
- Allowed dependencies: `typescript`, `tsx`, `vitest`, `@types/node`, `puppeteer`, `fastify`, `prettier`, `@anthropic-ai/sdk`.
- Anything outside this list needs justification.

---

## Code Structure (Don't Reorganize)

```
packages/
  dsl-spec/   # Canonical DSL types + SPEC.md. No runtime deps.
  parser/     # DSL → AST. No external deps.
  renderer/   # AST → HTML → PNG (Puppeteer).
  api/        # Fastify HTTP + MCP server.
  codegen/    # AST → React/HTML/SwiftUI.
```

Dependency direction: `api → renderer → parser`, `api → codegen → parser`. Don't add cycles.

---

## When Scope Is Ambiguous, Default to LESS

If you're unsure whether a feature belongs:
1. Check `VISION.md` "Feature Decision Filter" (4 questions).
2. If still unsure → ask the user, don't decide unilaterally.
3. If user is unavailable → choose the smaller scope. Easier to add later than remove.

---

## Long Sessions: Re-anchor Often

After ~10 turns or when context window fills:
1. Re-read `VISION.md`.
2. Confirm current task still aligns with North Star metric.
3. If drift detected, summarize and confirm direction with user.

---

## North Star

> A developer using Claude Code or Cursor can iterate on a UI screen 5 times for under $0.20 total LLM cost, with the final code being production-ready and visually identical to what they approved during preview.

Every PR, every feature, every line of code should serve this. If it doesn't measurably improve cost, latency, accuracy, or final code quality — push back.

---

## Quick Reference Files

| File | When to read |
|---|---|
| `VISION.md` | Always, first. Constitutional document. |
| `README.md` | For implementation status and roadmap. |
| `CLAUDE.md` | This file. Quick rules. |
| `packages/dsl-spec/SPEC.md` | When working on parser, renderer, or codegen. |
| `docs/GITFLOW.md` | Before any branching or merging operation. |
| `docs/mcp-integration.md` | When working on the api/MCP package. |
| `docs/tech-debt.md` | Known debt; check before adding new. |

---

## Workspace

- npm workspaces monorepo. Packages: `dsl-spec`, `parser`, `renderer`, `api`, `codegen`.
- Node ≥ 20.11. TypeScript strict, ESM (`"type": "module"`, NodeNext resolution).
- Imports between local packages use `@pixelagent/<name>` and resolve via npm workspace symlinks. Relative imports inside a package must include the `.js` extension (NodeNext requirement) — e.g. `import { tokenize } from './tokenizer.js'`.

## Commands

```bash
npm run typecheck   # tsc --noEmit across all workspaces
npm test            # vitest run
npm run build       # workspace builds (no-op for packages without build script)
```

Run both `typecheck` and `test` from repo root before any push.

## Git workflow — Trunk-Based Development

**Authoritative doc:** [`docs/GITFLOW.md`](./docs/GITFLOW.md). Read it before any branching or merging operation.

Quick rules (full rationale in the doc):

- **Trunk = `main`.** Always green, always deployable. There is no `develop`/`release`/`hotfix`/`staging` branch.
- **Feature branches:** `ISS-<N>-<kebab-slug>`, branched from `main`, lifetime ≤ 2 days.
- **Commit subject:** `ISS-<N>: <imperative summary>` (or `chore(<scope>): ...` for issue-less chores). Reference `VISION.md` when a decision is constrained by it.
- **Merge to `main`:** squash merge only, via PR with green CI.
- **Stay current:** rebase on `origin/main` daily. Never merge `main` into a feature branch.
- **Validate before push:** `npm run typecheck` and `npm test` must pass.

Example commit when constrained by VISION:

```
feat(parser): validate LAYER nesting depth max 16

Per VISION.md "Architectural Invariants" — keeping DSL bounded
prevents stack overflow in renderer.
```

### Hard rules for any agent operating on this repo

1. Never commit directly to `main`. Always create/switch to an `ISS-*` branch first.
2. Confirm branch before changes: `git branch --show-current` + `git status`.
3. Never run destructive ops (`push --force`, `reset --hard`, `branch -D`, `checkout -- .`, `clean -f`) without explicit user confirmation. `--force-with-lease` only on your own feature branch.
4. Never skip hooks (`--no-verify`). If a hook fails, fix the cause.
5. Never invent an `ISS-*` id. If none provided, ask the user or create the issue via Forge first.
6. If a Forge skill applies (`forge-code`, `forge-fix`, `forge-staging`, `forge-release`), follow it — those skills are specializations of the gitflow, not replacements.

## Secrets and local-only files

Gitignored, never commit:

- `.env`, `.env.*` (any secrets)
- `.mcp.json` (contains Bearer tokens for Forge MCP)
- `.claude/` (local Claude Code project config and skills)
- `node_modules`, `dist`, `*.log`

Always inspect `git status` and `git diff --staged` before committing — confirm no secret-bearing files slipped in.

## GitHub remote

The repo lives at `git@github-junixlabs:junixlabs/PixelAgent.git`. The host alias `github-junixlabs` (defined in `~/.ssh/config`) forces use of the `id_ed25519_junixlabs` SSH key. Plain `git@github.com:...` will authenticate as the wrong user.

## Issue tracking

Forge (MCP-integrated). Issue ids follow `ISS-<N>` and appear in branch names, commit subjects, and PR titles. The Forge skills under `.claude/skills/forge-*/` automate the full pipeline: triage → clarify → plan → code → review → test → staging → release.

## Coding conventions

- Strict TypeScript. No `any` unless justified by a comment. Prefer explicit types on exported APIs.
- Errors and warnings carry `{ rule, line, severity, message }` — see `packages/dsl-spec/src/index.ts` (`ValidationWarning`).
- Tests colocate with packages: `packages/<name>/tests/*.test.ts`. Use `vitest`.
- No comments unless the *why* is non-obvious. Identifier names should explain *what*.
- Don't add scope beyond the issue. One issue = one logical change.
