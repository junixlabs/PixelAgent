# Project: PixelAgent

DSL preview middleware that cuts token cost for AI coding agents building UI. See `README.md` for product context, `packages/dsl-spec/SPEC.md` for the DSL.

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
- **Commit subject:** `ISS-<N>: <imperative summary>` (or `chore(<scope>): ...` for issue-less chores).
- **Merge to `main`:** squash merge only, via PR with green CI.
- **Stay current:** rebase on `origin/main` daily. Never merge `main` into a feature branch.
- **Validate before push:** `npm run typecheck` and `npm test` must pass.

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
