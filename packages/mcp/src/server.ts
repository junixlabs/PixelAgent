import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  patchService,
  previewService,
  type PatchErr,
  type PreviewErr,
} from '@pixelagent/api';

// The SDK's `registerTool` is generic over the input schema and produces a
// callback type too deep for TS to resolve through our shapes. We type the
// args explicitly and cast the callback at the SDK boundary; runtime
// validation is still enforced by zod via the SDK.
type PreviewArgs = { dsl: string; scale?: number };
type PatchArgs = { dsl: string; instruction: string };

const PREVIEW_DESCRIPTION =
  'Render a PixelAgent DSL string to a PNG bitmap preview. ' +
  'Use this to show a screen design without generating final code. ' +
  'Returns the PNG image plus any validator warnings.';

const PATCH_DESCRIPTION =
  'Apply a natural-language edit to an existing DSL screen. ' +
  'The model proposes patch ops (modify/add/remove) which are validated ' +
  'against the AST and applied surgically. Returns the new DSL plus a ' +
  'PNG of the patched screen and the token cost.';

const formatErrorText = (err: PreviewErr | PatchErr): string => {
  switch (err.kind) {
    case 'parse_failed':
      return (
        `parse_failed (${err.details.length} errors):\n` +
        err.details.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
      );
    case 'render_failed':
      return `render_failed: ${err.message}`;
    case 'anthropic_api_key_missing':
      return 'anthropic_api_key_missing — set ANTHROPIC_API_KEY in the MCP server env.';
    case 'llm_invalid_output':
      return `llm_invalid_output: ${err.message}`;
    case 'llm_call_failed':
      return `llm_call_failed: ${err.message}`;
    case 'patch_no_op':
      return `patch_no_op:\n` + err.details.map((d) => `  ${d}`).join('\n');
    case 'patch_invalid_result':
      return (
        `patch_invalid_result (defensive re-parse caught ${err.details.length} errors):\n` +
        err.details.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
      );
  }
};

const handlePreview = async ({ dsl, scale }: PreviewArgs) => {
  const result = await previewService({ dsl, scale });
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: formatErrorText(result) }],
    };
  }
  const summary =
    `Rendered in ${result.renderMs}ms.` +
    (result.warnings.length > 0
      ? ` ${result.warnings.length} validator warning(s):\n` +
        result.warnings
          .map((w) => `  line ${w.line ?? '?'}: ${w.message}`)
          .join('\n')
      : '');
  return {
    content: [
      {
        type: 'image' as const,
        data: result.png.toString('base64'),
        mimeType: 'image/png',
      },
      { type: 'text' as const, text: summary },
    ],
  };
};

const handlePatch = async ({ dsl, instruction }: PatchArgs) => {
  const result = await patchService({ dsl, instruction });
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: formatErrorText(result) }],
    };
  }
  const summary =
    `Applied ${result.applied.length} op(s), ${result.tokensUsed} tokens used.` +
    (result.applyWarnings.length > 0
      ? ` ${result.applyWarnings.length} apply-warning(s):\n` +
        result.applyWarnings.map((w) => `  ${w}`).join('\n')
      : '') +
    `\n\nNew DSL:\n${result.newDsl}`;
  return {
    content: [
      {
        type: 'image' as const,
        data: result.png.toString('base64'),
        mimeType: 'image/png',
      },
      { type: 'text' as const, text: summary },
    ],
  };
};

export const buildMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'pixelagent', version: '0.1.0' });

  // The SDK's `registerTool` is deeply generic; passing zod schemas through
  // its type machinery exceeds TS's instantiation depth limit. We cast the
  // server to a loose registration type — runtime validation is unchanged
  // (the SDK still parses each call's args against the declared schema).
  const register = server.registerTool.bind(server) as (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: Record<string, z.ZodTypeAny>;
    },
    cb: (args: never) => unknown,
  ) => unknown;

  register(
    'pixelagent_preview',
    {
      title: 'Preview DSL',
      description: PREVIEW_DESCRIPTION,
      inputSchema: {
        dsl: z.string().min(1).describe('PixelAgent DSL source. Must start with SCREEN.'),
        scale: z
          .number()
          .min(0.1)
          .max(4)
          .optional()
          .describe('Device scale factor for the rendered PNG. Default 1.0.'),
      },
    },
    handlePreview as never,
  );

  register(
    'pixelagent_patch',
    {
      title: 'Patch DSL with natural-language instruction',
      description: PATCH_DESCRIPTION,
      inputSchema: {
        dsl: z.string().min(1).describe('Current DSL source to patch.'),
        instruction: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            'Natural-language edit, e.g. "change Sign in button color to green" ' +
              'or "remove the password field".',
          ),
      },
    },
    handlePatch as never,
  );

  return server;
};
