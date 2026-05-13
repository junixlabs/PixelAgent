# MCP Integration

PixelAgent ships an MCP (Model Context Protocol) server that exposes
preview + patch + synthesize primitives as tools usable from any MCP
host — Claude Code, Cursor, Claude Desktop, etc.

The server makes **no LLM calls of its own**. The host's model
(Claude Code's Claude, Cursor's model, etc.) does the reasoning; the
server only parses, applies validated ops, and renders. This means:

- **No `ANTHROPIC_API_KEY` is required.**
- The user pays for one model call, not two — Claude reads the user
  prompt, reads the grammar resource, and emits ops. The server
  materializes them.

## Tools

### `pixelagent_preview`
Render a DSL string to a PNG bitmap. Use for the initial draft of a screen.

**Input**
- `dsl` (string, required) — PixelAgent DSL source. Must start with `SCREEN`.
- `scale` (number, optional, 0.1–4.0, default 1.0) — device scale factor.
- `outPath` (string, optional) — absolute file path (no `..` segments, must end with `.png`). When set, the rendered PNG is also written to disk at this path and the text block reports `Wrote PNG to <path>`. Invalid paths return an MCP error with prefix `outPath_failed:`; no file is written. See [Viewing previews on a terminal host](#viewing-previews-on-a-terminal-host).

**Output**
- `image` block (PNG, base64, `image/png`).
- `text` block summarizing render time and validator warnings.

### `pixelagent_apply_patch`
Apply structured patch ops (`modify` / `add` / `remove`) to existing DSL
and re-render. Use for any edit instead of re-emitting the whole DSL —
costs ~10× fewer tokens and preserves identity of unchanged elements.

**Input**
- `dsl` (string, required) — current DSL source.
- `ops` (array, required, 1–32 entries) — ordered patch operations.
  Each is one of:
  - `{ op: 'modify', id, field, value }`
  - `{ op: 'add', parentId?, node }`
  - `{ op: 'remove', id }`
- `outPath` (string, optional) — same semantics as `pixelagent_preview.outPath` above.

The server validates each op against the target node type's writable
fields (e.g. rejects `bg` on a `text` node, `weight: 'extra-bold'`,
malformed `border`). Failed ops are skipped and reported in the
response; later ops still apply against the partially-updated scene.

**Output**
- `image` block (PNG of the patched screen).
- `text` block with apply count, warnings, and the new DSL.

### `pixelagent_synthesize`
Emit production code (React + Tailwind) from an approved DSL. Call
this once the user is happy with what `preview` / `apply_patch`
rendered — the codegen maps the AST deterministically, so the output
matches the rendered pixels.

**Input**
- `dsl` (string, required) — DSL the user has approved.
- `target` (enum, optional, default `"react"`) — code target.

**Output**
- `text` block: `Synthesized N chars of React code.\n\n<code>`.

## Resources

### `pixelagent://grammar`
A concise reference covering DSL commands, validation rules, and the
patch op shape. Read this when composing ops or DSL — the host can
fetch it on demand instead of carrying it in every system prompt.

## Quick start (local dev)

The repo is already wired up:

```bash
git clone git@github-junixlabs:junixlabs/PixelAgent.git
cd PixelAgent
npm install
```

Smoke-test the stdio handshake:

```bash
cat <<EOF | ./node_modules/.bin/tsx packages/mcp/src/index.ts
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
EOF
```

Should print two responses, the second listing `pixelagent_preview`,
`pixelagent_apply_patch`, and `pixelagent_synthesize`.

## Wire into Claude Code (project-scoped)

The repo's `.mcp.json` is gitignored and already includes a
`pixelagent` entry pointing at the local `tsx` and source. Open Claude
Code in this project and the server starts automatically. To verify:
run `/mcp` — `pixelagent` should appear with status connected.

## Wire into Claude Code (user-wide)

To use it across projects, add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the equivalent on your platform:

```jsonc
{
  "mcpServers": {
    "pixelagent": {
      "command": "/absolute/path/to/PixelAgent/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/PixelAgent/packages/mcp/src/index.ts"]
    }
  }
}
```

No env block needed — the server has no required environment variables.

## Wire into Cursor / other MCP hosts

Same `command` + `args` shape. Refer to the host's MCP docs for the
exact config file location.

## Architecture

```
                  ┌─────────────────────────┐
                  │  pure services          │
                  │  previewService         │
                  │  applyPatchService      │
                  │  synthesizeService      │
                  └──────┬───────┬──────────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                              ▼
       ┌──────────────┐              ┌─────────────────┐
       │ HTTP routes  │              │ MCP server      │
       │ (Fastify)    │              │ (stdio JSON-RPC)│
       │ /preview     │              │ pixelagent_     │
       │ /apply-patch │              │   preview       │
       │ /synthesize  │              │ pixelagent_     │
       │              │              │   apply_patch   │
       │              │              │ pixelagent_     │
       │              │              │   synthesize    │
       └──────────────┘              └─────────────────┘
```

Both transports call the same pure services — no LLM lives on the
server. Hosts (Claude Code, Cursor, scripts) supply ops; PixelAgent
validates, applies, and renders. When the user approves the DSL, the
host calls `pixelagent_synthesize` (MCP) or `POST /synthesize` (HTTP)
to get production code.

## Workflow inside Claude Code

When you ask Claude to build or edit a screen:

1. Claude reads `pixelagent://grammar` (one-time per session, cached).
2. For a fresh screen: Claude composes the DSL and calls `pixelagent_preview`.
3. For an edit ("make Sign in green"): Claude composes ops and calls
   `pixelagent_apply_patch` — typically 1–3 ops, ~30 tokens output.
4. The server returns a PNG; Claude shows it inline; you approve or
   request further edits.

No PixelAgent server-side LLM call ever happens. All reasoning is in
the Claude session you already opened.

## Viewing previews on a terminal host

Terminal MCP hosts (e.g. Claude Code in a plain TTY without inline-image rendering) cannot display the `image` content block — only the model sees it. Use the `outPath` parameter to write the PNG to disk and open it with the OS image viewer:

```
pixelagent_preview({ dsl: "...", outPath: "/tmp/pa.png" })
```

then once, in another terminal:

```bash
open /tmp/pa.png    # macOS — Preview.app
xdg-open /tmp/pa.png  # Linux
start /tmp/pa.png   # Windows
```

**Tip — Playwright-style live refresh.** Use a single fixed path (e.g. `/tmp/pa.png`) for every preview/patch call in a session. macOS Preview.app and most modern image viewers detect the file rewrite and refresh the open window in place — no need to re-open between iterations. The PixelAgent server intentionally does not spawn the viewer itself; that's a host-side action that's easy to control and skip on headless environments (SSH, CI, containers without `DISPLAY`).

## Troubleshooting

- **Tools don't appear** — confirm `node_modules/.bin/tsx` exists in
  the configured path, and that `npm install` ran cleanly. Run the
  smoke-test command above to check the handshake. Logs go to stderr;
  Claude Code shows them in the MCP error console.
- **Slow first render** — first call to `pixelagent_preview` launches
  a headless Chrome (~1–2s cold start). Subsequent calls share the
  browser instance and are sub-second.
- **`patch_no_op` errors** — every op referenced an unknown id or an
  unwritable field. Read the `details` array; common cause is the
  model guessing a field name not in the grammar reference.
