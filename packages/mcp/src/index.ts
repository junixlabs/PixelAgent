/**
 * stdio MCP server entrypoint. Claude Code (or any MCP host) spawns this
 * process and communicates over stdin/stdout via JSON-RPC.
 *
 * IMPORTANT: do NOT write anything to stdout outside the protocol. All
 * diagnostic output goes to stderr.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closeRenderer } from '@pixelagent/renderer';
import { buildMcpServer } from './server.js';

// Claude Code spawns this process without inheriting shell env. We load
// the project-root `.env` ourselves so PORT / LOG_LEVEL etc. are honoured.
// The MCP server itself does NOT call any LLM (host's Claude generates
// patch ops); ANTHROPIC_API_KEY is not required.
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '../../../.env');
try {
  const text = readFileSync(envPath, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env is optional — silent if absent.
}

const main = async (): Promise<void> => {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(`pixelagent-mcp: received ${signal}, shutting down\n`);
    await closeRenderer();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

main().catch((err) => {
  process.stderr.write(`pixelagent-mcp fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
