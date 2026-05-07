/**
 * Public surface of @pixelagent/api. Re-exports the Fastify app builder
 * plus the pure service functions, so non-HTTP callers (MCP server, CLI)
 * can use the same business logic without booting an HTTP listener.
 *
 * The HTTP server entrypoint is `./start.ts` — run via `npm run start`.
 */
export { buildApp } from './server.js';
export {
  previewService,
  type PreviewInput,
  type PreviewOk,
  type PreviewErr,
} from './services/preview.js';
export {
  patchService,
  type PatchInput,
  type PatchOk,
  type PatchErr,
} from './services/patch.js';
