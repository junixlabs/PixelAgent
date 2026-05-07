import {
  applyPatch,
  parse,
  serialize,
  type PatchOp,
  type ValidationWarning,
} from '@pixelagent/parser';
import { dslToHtml, render } from '@pixelagent/renderer';
import {
  LlmInvalidOutputError,
  MissingApiKeyError,
  generatePatchOps,
} from './anthropic-patch.js';

export type PatchOk = {
  ok: true;
  newDsl: string;
  applied: PatchOp[];
  png: Buffer;
  tokensUsed: number;
  applyWarnings: string[];
};

export type PatchErr =
  | { ok: false; kind: 'parse_failed'; details: ValidationWarning[] }
  | { ok: false; kind: 'anthropic_api_key_missing' }
  | { ok: false; kind: 'llm_invalid_output'; message: string }
  | { ok: false; kind: 'llm_call_failed'; message: string }
  | { ok: false; kind: 'patch_no_op'; details: string[] }
  | { ok: false; kind: 'patch_invalid_result'; details: ValidationWarning[] }
  | { ok: false; kind: 'render_failed'; message: string };

export type PatchInput = { dsl: string; instruction: string };

/**
 * Pure patch pipeline: parse → LLM → applyPatch → serialize → defensive
 * re-parse → render. Same logic as the HTTP route, packaged for reuse by
 * non-HTTP callers (MCP server, CLI, tests).
 */
export const patchService = async (
  input: PatchInput,
): Promise<PatchOk | PatchErr> => {
  const { scene, warnings } = parse(input.dsl);
  const errors = warnings.filter((w) => w.severity === 'error');
  if (errors.length > 0 || scene == null) {
    return { ok: false, kind: 'parse_failed', details: errors };
  }

  let ops: PatchOp[];
  let tokensUsed = 0;
  try {
    const out = await generatePatchOps({ scene, instruction: input.instruction });
    ops = out.ops;
    tokensUsed = out.tokensUsed;
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return { ok: false, kind: 'anthropic_api_key_missing' };
    }
    if (err instanceof LlmInvalidOutputError) {
      return { ok: false, kind: 'llm_invalid_output', message: err.message };
    }
    return { ok: false, kind: 'llm_call_failed', message: (err as Error).message };
  }

  const result = applyPatch(scene, ops);
  if (result.applied.length === 0 && result.errors.length > 0) {
    return { ok: false, kind: 'patch_no_op', details: result.errors };
  }

  const newDsl = serialize(result.scene);

  // Defensive re-parse: catches AST corruption from a `modify` writing an
  // illegal field or an `add` injecting a malformed node, before we render.
  const reparsed = parse(newDsl);
  const reparseErrors = reparsed.warnings.filter(
    (w) => w.severity === 'error',
  );
  if (reparseErrors.length > 0 || reparsed.scene == null) {
    return { ok: false, kind: 'patch_invalid_result', details: reparseErrors };
  }

  try {
    const html = dslToHtml(reparsed.scene);
    const png = await render(html, {
      width: reparsed.scene.screen.w,
      height: reparsed.scene.screen.h,
    });
    return {
      ok: true,
      newDsl,
      applied: result.applied,
      png,
      tokensUsed,
      applyWarnings: result.errors,
    };
  } catch (err) {
    return { ok: false, kind: 'render_failed', message: (err as Error).message };
  }
};
