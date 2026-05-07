# MCP Integration

PixelAgent ships an MCP (Model Context Protocol) server that exposes the
`/preview` and `/patch` flows as tools usable from any MCP host — Claude Code,
Cursor, Claude Desktop, etc.

## Tools

### `pixelagent_preview`
Render a DSL string to a PNG bitmap.

**Input**
- `dsl` (string, required) — PixelAgent DSL source. Must start with `SCREEN`.
- `scale` (number, optional, 0.1–4.0, default 1.0) — device scale factor.

**Output**
- An `image` block (PNG, base64, `image/png`).
- A `text` block summarizing render time and validator warnings.

### `pixelagent_patch`
Apply a natural-language edit to a DSL screen via Claude Sonnet.

**Input**
- `dsl` (string, required) — current DSL source.
- `instruction` (string, required, ≤ 2000 chars) — natural-language edit.

**Output**
- An `image` block (PNG of the patched screen).
- A `text` block with the new DSL, applied ops count, and tokens used.

**Requires** `ANTHROPIC_API_KEY` in the server's environment.

## Quick start (local dev)

```bash
git clone git@github-junixlabs:junixlabs/PixelAgent.git
cd PixelAgent
npm install
```

Verify the server starts and lists its tools:

```bash
(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'; sleep 1; \
 echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; sleep 2) \
 | npm run start --workspace=@pixelagent/mcp
```

Two JSON-RPC responses should print, the second listing
`pixelagent_preview` and `pixelagent_patch`.

## Wire into Claude Code

Add the server to Claude Code's MCP config (typically `~/.claude/claude_desktop_config.json`
on macOS, or via the Claude Code UI):

```jsonc
{
  "mcpServers": {
    "pixelagent": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/PixelAgent/packages/mcp/src/index.ts"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Replace `/absolute/path/to/PixelAgent` with the local clone path.

Restart Claude Code. The two tools should appear in the tool list.

## Wire into Cursor / other MCP hosts

Same `command` + `args` shape. Refer to the host's MCP docs for the exact
config file location.

## Troubleshooting

- **Tools don't appear** — confirm the host can spawn the command. Run the
  smoke-test command above with the same env vars to validate. Logs go to
  stderr; check the host's MCP error console.
- **`anthropic_api_key_missing` on patch** — `ANTHROPIC_API_KEY` is missing
  from the spawned process env. Add it to the `env` block in the config
  (NOT to your shell profile — Claude Code does not inherit shell env on
  Mac/Windows).
- **Slow first render** — first call to `pixelagent_preview` launches a
  headless Chrome (~1–2s cold start). Subsequent calls share the same
  browser instance and are sub-second.
- **Render quality differs from final code** — both the preview and the
  eventual code generator use the same Chrome engine; ±2px tolerance is
  documented, not a bug.

## Architecture

The MCP server is a thin wrapper over pure service functions exported from
`@pixelagent/api`. The same `previewService` and `patchService` back the
HTTP `/preview` and `/patch` routes. There is no MCP-specific business
logic — only a transport adapter.

```
                  ┌─────────────────────────┐
                  │  pure services          │
                  │  previewService         │
                  │  patchService           │
                  └──────┬───────┬──────────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                              ▼
       ┌──────────────┐              ┌─────────────────┐
       │ HTTP routes  │              │ MCP server      │
       │ (Fastify)    │              │ (stdio JSON-RPC)│
       └──────────────┘              └─────────────────┘
```

Adding a new transport (CLI, gRPC, …) means writing one adapter — the
service layer doesn't change.
