# Git Workflow — Trunk-Based Development (TBD)

> **Audience:** human developers AND AI coding agents (Claude Code, Cursor, etc.).
> **Status:** authoritative. Diverging from this doc requires updating it first.

This project uses **Trunk-Based Development**. There is one long-lived branch (`main`), and short-lived feature branches that merge back within 1–2 days.

---

## 1. Core Principles

1. **`main` is always green and deployable.** Never push code that breaks build, tests, or typecheck to `main`.
2. **Short-lived branches.** A feature branch should live ≤ 2 days. If longer, split the work or hide it behind a feature flag.
3. **Small, frequent merges.** Prefer 5 small PRs over 1 large PR. Each PR should be reviewable in ≤ 15 minutes.
4. **One issue → one branch → one squash merge.** No long-running release/develop/hotfix branches.
5. **Feature flags over branch isolation.** Incomplete work goes behind a flag and merges to `main`. Do not hold work on a branch waiting for "the right time".
6. **Linear history.** All merges to `main` are squash merges.

---

## 2. Branch Model

| Branch              | Purpose                                                     | Lifetime    |
| ------------------- | ----------------------------------------------------------- | ----------- |
| `main`              | Trunk. Always green. Deploy source.                         | Forever     |
| `ISS-<N>-<slug>`    | Feature/fix branch tied to a Forge issue. Branched from `main`. | ≤ 2 days |

**No other branch types.** No `develop`, no `release/*`, no `hotfix/*`, no `staging`. If you need to ship urgently, that is just another short-lived `ISS-*` branch.

### Branch naming

```
ISS-<issue-id>-<kebab-slug>
```

- `<issue-id>` — Forge issue number, no leading zeros (`ISS-7`, not `ISS-007`).
- `<kebab-slug>` — 2–5 words, lowercase, hyphenated, derived from issue title.

✅ `ISS-12-render-png-puppeteer`
✅ `ISS-3-dsl-parser`
❌ `feature/render` (no issue id)
❌ `ISS-12_render` (underscores)
❌ `ISS-12-implement-the-full-puppeteer-rendering-pipeline-for-stage-2` (too long)

### When there is no Forge issue

Create the issue first. Every change ties to an issue. The only exception is trivial chore commits (typo fixes, gitignore tweaks) made directly on `main` by a human maintainer — these use a `chore:` prefix and skip the branch.

---

## 3. Commit Messages

Format:

```
ISS-<N>: <short summary in imperative mood>

<optional body — what changed and why, NOT how>
```

Or for chores without an issue:

```
chore(<scope>): <summary>
```

### Rules

- Subject line ≤ 72 chars, imperative ("add", not "added"), no trailing period.
- Reference the issue id at the start (`ISS-12: ...`) so it links automatically in Forge/GitHub.
- Body explains **why**, not what. The diff shows what.
- One logical change per commit while developing. Squash on merge keeps `main` history clean.

### Examples

✅
```
ISS-12: render DSL to PNG via Puppeteer

Drops the placeholder Buffer.alloc(0) stub. Reuses the same Chrome
instance across requests to keep cold-start under 1s.
```

✅ `ISS-3: drop unused LineMap/BuildResult exports from types.ts`

✅ `chore: gitignore local tool configs (.claude/, .mcp.json)`

❌ `update parser` (no issue, vague)
❌ `ISS-12: WIP` (use draft PR + feature flag instead)
❌ `Fixed bug.` (past tense, period, no context)

---

## 4. Daily Workflow

### Starting work on an issue

```bash
git checkout main
git pull --ff-only
git checkout -b ISS-12-render-png-puppeteer
```

### Staying current (do this at least once per day)

```bash
git fetch origin
git rebase origin/main
# resolve conflicts as they appear, not at the end
```

Rebase, do **not** merge `main` into your branch. The branch should stay linear so the eventual squash is clean.

### Pushing

```bash
git push -u origin ISS-12-render-png-puppeteer
```

After the first push, subsequent pushes use `git push` (or `git push --force-with-lease` after a rebase — never plain `--force`).

### Opening a PR

- Title: `ISS-12: render DSL to PNG via Puppeteer`
- Body: link the Forge issue. List what changed and how to test.
- Mark **Draft** if not ready for review.

### Merging to `main`

1. PR is approved.
2. CI is green (typecheck + tests).
3. **Squash merge** via the GitHub UI or `gh pr merge --squash --delete-branch`.
4. The squash commit message uses the PR title (`ISS-12: ...`).
5. Branch is deleted automatically.

### Releasing

`main` is the deploy source. Tag a release when ready:

```bash
git checkout main && git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Deployment runs from the tagged commit on `main`.

---

## 5. Hard Rules — Never Violate

These rules apply equally to humans and AI agents:

1. **Never commit directly to `main`.** Exception: `chore:` commits by a maintainer (typos, gitignore, README edits with no code impact).
2. **Never force-push to `main`.** Use `--force-with-lease` only on your own feature branch.
3. **Never merge with `--no-ff` to `main`.** Always squash merge.
4. **Never merge `main` into a feature branch.** Always rebase.
5. **Never push code that fails `npm run typecheck` or `npm test`.** Run them locally first.
6. **Never skip hooks** (`--no-verify`, `--no-gpg-sign`). If a hook fails, fix the cause.
7. **Never amend a commit that has been pushed to a shared branch.** Create a new commit instead.
8. **Never include secrets in commits.** Check the diff before committing. `.mcp.json`, `.env`, and `.claude/` are gitignored — keep it that way.
9. **Never let a branch live longer than 2 days.** Either ship it (behind a flag if needed) or delete it.
10. **Never create branches outside `ISS-*` naming.** No `feature/`, `bugfix/`, `wip/` branches.

---

## 6. Rules for AI Coding Agents

When Claude Code (or any agent) operates on this repo:

1. **Confirm branch before any change.** Run `git branch --show-current` and `git status`. Do not assume.
2. **Never check out `main` to make changes.** Always create or switch to an `ISS-*` branch.
3. **Never run destructive operations without explicit user confirmation:** `git push --force`, `git reset --hard`, `git branch -D`, `git checkout -- .`, `git clean -f`.
4. **Always pull before branching.** `git checkout main && git pull --ff-only && git checkout -b ISS-XX-...`.
5. **Validate before push.** Run `npm run typecheck` and `npm test` from the repo root. Do not push if either fails.
6. **One commit per logical change** while iterating. The squash on merge handles the cleanup.
7. **Never invent issue ids.** If no `ISS-*` is provided, ask the user or create the issue first via `forge_issues`.
8. **Never push to a branch you did not create in this session** without confirming the user wants you to add to it.
9. **If a Forge skill applies (`forge-code`, `forge-fix`, etc.), follow it.** Those skills are specializations of this gitflow, not replacements.
10. **Read this doc at the start of any branching/merging task.** When in doubt, prefer the rule here over older patterns observed in `git log`.

---

## 7. Common Scenarios

### Scenario A: Hotfix in production

There is no separate hotfix branch. Treat it as any other issue:

```bash
git checkout main && git pull --ff-only
git checkout -b ISS-99-fix-render-crash
# fix, test, push, PR, squash merge, tag patch release
```

If the fix is genuinely 1-line and the maintainer is human, a direct `chore:` commit on `main` is acceptable. AI agents must always go through a branch + PR.

### Scenario B: Long-running feature (> 2 days)

Split it. If you cannot split:

1. Merge incomplete code behind a feature flag (`if (process.env.PIXELAGENT_FEATURE_X) { ... }`).
2. Each day, ship the next slice to `main` behind the flag.
3. Flip the flag in a final PR when complete.

Never let a feature branch live more than 2 days.

### Scenario C: PR has merge conflicts with `main`

```bash
git fetch origin
git rebase origin/main
# resolve conflicts
git push --force-with-lease
```

Do **not** click "Update branch" in the GitHub UI — that creates a merge commit and pollutes the eventual squash.

### Scenario D: Reverting a bad merge

```bash
git checkout main && git pull --ff-only
git revert <squash-commit-sha>
git push origin main
```

Because `main` is squash-merged, every PR is one commit and trivially revertable.

---

## 8. Quick Reference

```bash
# Start
git checkout main && git pull --ff-only
git checkout -b ISS-N-short-slug

# Work
# … edit, commit, edit, commit …
git rebase origin/main          # daily, to stay current
git push -u origin ISS-N-short-slug

# Validate
npm run typecheck
npm test

# Ship
gh pr create --fill
# after approval + green CI:
gh pr merge --squash --delete-branch
```

---

## 9. Why TBD (and not Gitflow)

- Gitflow's `develop`/`release`/`hotfix` branches make sense for shipped desktop software with quarterly releases. PixelAgent ships continuously.
- Long-lived branches accumulate merge debt. TBD avoids this by definition.
- Feature flags are strictly more powerful than branch isolation: you can ship dark, test in production, A/B test, and roll back without redeploying.
- Single source of truth (`main`) makes CI, deploy, and rollback trivially scriptable. Forge automation depends on this.

---

**Last updated:** 2026-05-07
