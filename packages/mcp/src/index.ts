/**
 * stdio MCP server entrypoint. Claude Code (or any MCP host) spawns this
 * process and communicates over stdin/stdout via JSON-RPC.
 *
 * IMPORTANT: do NOT write anything to stdout outside the protocol. All
 * diagnostic output goes to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closeRenderer } from '@pixelagent/renderer';
import { buildMcpServer } from './server.js';

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
