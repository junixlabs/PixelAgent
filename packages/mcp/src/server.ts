import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  applyPatchService,
  previewBundleService,
  previewService,
  synthesizeService,
  type ApplyPatchErr,
  type PreviewErr,
  type SynthesizeErr,
  type SynthesizeTarget,
} from '@pixelagent/api';
import type { PatchOp } from '@pixelagent/parser';
import { GRAMMAR_REFERENCE } from './grammar.js';
import { writeHtml, writePng } from './write-artifact.js';

// The SDK's `registerTool` is generic over the input schema and produces a
// callback type too deep for TS to resolve through our shapes. We type the
// args explicitly and cast the callback at the SDK boundary; runtime
// validation is still enforced by zod via the SDK.
type PreviewArgs = {
  dsl?: string;
  scale?: number;
  outPath?: string;
  screens?: Record<string, string>;
  entry?: string;
};
type ApplyPatchArgs = { dsl: string; ops: PatchOp[]; outPath?: string };
type SynthesizeArgs = { dsl: string; target?: SynthesizeTarget };

const PREVIEW_DESCRIPTION =
  'Render a PixelAgent DSL string to a PNG bitmap preview. ' +
  'Use this to draft a brand-new screen. For edits to existing DSL, ' +
  'prefer `pixelagent_apply_patch` — it costs ~10× fewer tokens than ' +
  're-emitting the whole DSL. An outPath ending in .html writes an ' +
  'interactive HTML preview instead (hover/focus states live, click ' +
  'shows element id) — point the user at the file to review in a browser. ' +
  'For multi-screen flows pass screens (id → DSL) + entry instead of dsl: ' +
  'elements with goto:<screen-id> become clickable links between screens ' +
  'in the navigable HTML bundle.';

const APPLY_PATCH_DESCRIPTION =
  'Apply structured patch ops (modify / add / remove) to an existing DSL ' +
  'and re-render. Use this for any edit instead of regenerating the full ' +
  'DSL. Read the `pixelagent://grammar` resource for the ops schema and ' +
  'field reference. The server validates each op per node-type rules and ' +
  'returns warnings for ops that did not apply.';

const SYNTHESIZE_DESCRIPTION =
  'Synthesize production code from a DSL the user has approved. Currently ' +
  'emits a single React component using Tailwind classes (target:"react"). ' +
  'Call this AFTER the user is happy with what `pixelagent_preview` / ' +
  '`pixelagent_apply_patch` rendered — the DSL is the source of truth, the ' +
  'generated code mirrors the rendered pixels deterministically.';

const formatPreviewErr = (err: PreviewErr): string => {
  switch (err.kind) {
    case 'parse_failed':
      return (
        `parse_failed (${err.errors.length} errors):\n` +
        err.errors.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
      );
    case 'render_failed':
      return `render_failed: ${err.message}`;
  }
};

const formatSynthesizeErr = (err: SynthesizeErr): string => {
  return (
    `parse_failed (${err.errors.length} errors):\n` +
    err.errors.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
  );
};

const formatApplyPatchErr = (err: ApplyPatchErr): string => {
  switch (err.kind) {
    case 'parse_failed':
      return (
        `parse_failed (${err.errors.length} errors):\n` +
        err.errors.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
      );
    case 'patch_no_op':
      return `patch_no_op:\n` + err.errors.map((e) => `  ${e}`).join('\n');
    case 'patch_invalid_result':
      return (
        `patch_invalid_result (defensive re-parse caught ${err.errors.length} errors):\n` +
        err.errors.map((e) => `  line ${e.line ?? '?'}: ${e.message}`).join('\n')
      );
    case 'render_failed':
      return `render_failed: ${err.message}`;
  }
};

const applyOutPath = async (
  png: Buffer,
  outPath: string | undefined,
  summary: string,
): Promise<
  | { ok: true; text: string }
  | {
      ok: false;
      response: {
        isError: true;
        content: [{ type: 'text'; text: string }];
      };
    }
> => {
  if (!outPath) return { ok: true, text: summary };
  try {
    const written = await writePng(png, outPath);
    return { ok: true, text: `${summary}\nWrote PNG to ${written}` };
  } catch (e) {
    return {
      ok: false,
      response: {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `outPath_failed: ${(e as Error).message}`,
          },
        ],
      },
    };
  }
};

const pngImageBlock = (png: Buffer) =>
  ({
    type: 'image' as const,
    data: png.toString('base64'),
    mimeType: 'image/png',
  }) as const;

const textError = (text: string) => ({
  isError: true,
  content: [{ type: 'text' as const, text }],
});

const handlePreview = async ({
  dsl,
  scale,
  outPath,
  screens,
  entry,
}: PreviewArgs) => {
  const wantsHtml = outPath?.toLowerCase().endsWith('.html') ?? false;

  if (screens !== undefined) {
    if (dsl !== undefined) {
      return textError('bad_request: provide either dsl or screens, not both');
    }
    if (entry === undefined) {
      return textError('bad_request: screens requires entry (the starting screen id)');
    }
    if (!wantsHtml) {
      return textError(
        'bad_request: a screens bundle requires outPath ending in .html (the navigable preview is an HTML file)',
      );
    }
    const result = await previewBundleService({ screens, entry, format: 'html' });
    if (!result.ok) {
      switch (result.kind) {
        case 'parse_failed':
          return textError(
            `parse_failed in screen '${result.screenId}' (${result.errors.length} errors):\n` +
              result.errors
                .map((e) => `  line ${e.line ?? '?'}: ${e.message}`)
                .join('\n'),
          );
        case 'bad_bundle':
          return textError(`bad_bundle: ${result.message}`);
        case 'render_failed':
          return textError(`render_failed: ${result.message}`);
      }
    }
    if (result.format !== 'html') {
      return textError('internal: bundle preview expected html result');
    }
    try {
      const written = await writeHtml(result.html, outPath as string);
      const warnText =
        result.warnings.length > 0
          ? ` ${result.warnings.length} warning(s):\n` +
            result.warnings.map((w) => `  ${w.message}`).join('\n')
          : '';
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Composed ${Object.keys(screens).length}-screen bundle (entry: ${entry}).${warnText}\n` +
              `Wrote navigable HTML preview to ${written}\n` +
              'Open it in a browser: clicking goto elements jumps between screens; hover/focus states are live.',
          },
        ],
      };
    } catch (e) {
      return textError(`outPath_failed: ${(e as Error).message}`);
    }
  }

  if (dsl === undefined) {
    return textError('bad_request: dsl is required when screens is not given');
  }
  const result = await previewService({
    dsl,
    scale,
    format: wantsHtml ? 'html' : 'png',
  });
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: formatPreviewErr(result) }],
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
  if (result.format === 'html') {
    try {
      // wantsHtml is only true when outPath is set.
      const written = await writeHtml(result.html, outPath as string);
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `${summary}\nWrote interactive HTML preview to ${written}\n` +
              'Open it in a browser: hover/focus states are live; ' +
              'click any element to see its id (Esc clears).',
          },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `outPath_failed: ${(e as Error).message}`,
          },
        ],
      };
    }
  }
  const out = await applyOutPath(result.png, outPath, summary);
  if (!out.ok) return out.response;
  return {
    content: [
      pngImageBlock(result.png),
      { type: 'text' as const, text: out.text },
    ],
  };
};

const handleSynthesize = async ({ dsl, target }: SynthesizeArgs) => {
  const result = await synthesizeService({ dsl, target: target ?? 'react' });
  if (!result.ok) {
    return {
      isError: true,
      content: [
        { type: 'text' as const, text: formatSynthesizeErr(result) },
      ],
    };
  }
  const summary =
    `Synthesized ${result.code.length} chars of React code.` +
    (result.warnings.length > 0
      ? ` ${result.warnings.length} validator warning(s):\n` +
        result.warnings
          .map((w) => `  line ${w.line ?? '?'}: ${w.message}`)
          .join('\n')
      : '');
  return {
    content: [
      { type: 'text' as const, text: `${summary}\n\n${result.code}` },
    ],
  };
};

const handleApplyPatch = async ({ dsl, ops, outPath }: ApplyPatchArgs) => {
  const result = await applyPatchService({ dsl, ops });
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: formatApplyPatchErr(result) }],
    };
  }
  const summary =
    `Applied ${result.applied.length} op(s).` +
    (result.applyWarnings.length > 0
      ? ` ${result.applyWarnings.length} apply-warning(s):\n` +
        result.applyWarnings.map((w) => `  ${w}`).join('\n')
      : '') +
    `\n\nNew DSL:\n${result.newDsl}`;
  const out = await applyOutPath(result.png, outPath, summary);
  if (!out.ok) return out.response;
  return {
    content: [
      pngImageBlock(result.png),
      { type: 'text' as const, text: out.text },
    ],
  };
};

export const buildMcpServer = (): McpServer => {
  const server = new McpServer({ name: 'pixelagent', version: '0.2.0' });

  server.registerResource(
    'grammar',
    'pixelagent://grammar',
    {
      title: 'PixelAgent DSL grammar reference',
      description:
        'Concise reference of DSL commands, validation rules, and patch op shape. Read this before generating ops or DSL.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: GRAMMAR_REFERENCE,
        },
      ],
    }),
  );

  // The SDK's registerTool is deeply generic; passing zod schemas through
  // its type machinery exceeds TS's instantiation depth limit. We bind a
  // loose-typed register at the boundary — runtime validation unchanged.
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
        dsl: z
          .string()
          .min(1)
          .optional()
          .describe(
            'PixelAgent DSL source. Must start with SCREEN. Required unless screens is given.',
          ),
        screens: z
          .record(z.string().min(1))
          .optional()
          .describe(
            'Multi-screen flow bundle: map of screen-id → DSL source. Elements with goto:<screen-id> navigate between screens in the HTML preview. Requires entry and an outPath ending in .html.',
          ),
        entry: z
          .string()
          .min(1)
          .optional()
          .describe('Starting screen id for a screens bundle.'),
        scale: z
          .number()
          .min(0.1)
          .max(4)
          .optional()
          .describe('Device scale factor for the rendered PNG. Default 1.0.'),
        outPath: z
          .string()
          .optional()
          .describe(
            'Optional absolute file path. Must be absolute, contain no ".." segments, and end with .png or .html. With .png the rendered bitmap is also written to disk. With .html an interactive preview is written instead of a PNG: hover/focus states are live and clicking an element shows its id — tell the user to open the file in a browser.',
          ),
      },
    },
    handlePreview as never,
  );

  // Per-op zod shapes. Ops are applied in array order; the server validates
  // each one against the target node type and skips bad ops with a warning.
  const opSchema = z.discriminatedUnion('op', [
    z.object({
      op: z.literal('modify'),
      id: z.string().min(1).describe('Target node id.'),
      field: z
        .string()
        .min(1)
        .describe(
          "AST property to write — e.g. bg, color, label, variant, size, x, y, w, h. See pixelagent://grammar.",
        ),
      value: z
        .union([z.string(), z.number()])
        .describe('New value. String for color/enum/text, number for integer fields.'),
    }),
    z.object({
      op: z.literal('add'),
      parentId: z
        .string()
        .min(1)
        .optional()
        .describe('Container to insert into. Omit to append at scene root.'),
      node: z
        .object({ type: z.string(), id: z.string().optional() })
        .passthrough()
        .describe('Full AST node, shape per pixelagent://grammar.'),
    }),
    z.object({
      op: z.literal('remove'),
      id: z.string().min(1).describe('Id of the node (and subtree) to delete.'),
    }),
  ]);

  register(
    'pixelagent_synthesize',
    {
      title: 'Synthesize code from DSL',
      description: SYNTHESIZE_DESCRIPTION,
      inputSchema: {
        dsl: z
          .string()
          .min(1)
          .describe('Approved DSL source. Must parse cleanly.'),
        target: z
          .enum(['react'])
          .optional()
          .describe('Code target. Defaults to "react".'),
      },
    },
    handleSynthesize as never,
  );

  register(
    'pixelagent_apply_patch',
    {
      title: 'Apply patch ops to DSL',
      description: APPLY_PATCH_DESCRIPTION,
      inputSchema: {
        dsl: z
          .string()
          .min(1)
          .describe('Current DSL source. Must parse cleanly.'),
        ops: z
          .array(opSchema)
          .min(1)
          .max(32)
          .describe(
            'Ordered patch operations. The server validates each op per node-type rules.',
          ),
        outPath: z
          .string()
          .optional()
          .describe(
            'Optional absolute file path. When set, the rendered PNG is also written to disk at this path. Must be absolute, contain no ".." segments, and end with .png.',
          ),
      },
    },
    handleApplyPatch as never,
  );

  return server;
};
