#!/usr/bin/env node
// Bin shim: imports tsx and runs the MCP server. Lets users wire this
// into Claude Code via `command: "pixelagent-mcp"` once the package is
// linked or installed.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('tsx/esm', pathToFileURL(import.meta.url));
await import('../src/index.ts');
