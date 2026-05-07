import {
  applyPatch,
  parse,
  serialize,
  type PatchOp,
  type ValidationWarning,
} from '@pixelagent/parser';
import { dslToHtml, render } from '@pixelagent/renderer';

export type ApplyPatchOk = {
  ok: true;
  newDsl: string;
  applied: PatchOp[];
  png: Buffer;
  applyWarnings: string[];
};

export type ApplyPatchErr =
  | { ok: false; kind: 'parse_failed'; details: ValidationWarning[] }
  | { ok: false; kind: 'patch_no_op'; details: string[] }
  | { ok: false; kind: 'patch_invalid_result'; details: ValidationWarning[] }
  | { ok: false; kind: 'render_failed'; message: string };

export type ApplyPatchInput = { dsl: string; ops: PatchOp[] };

/**
 * Pure apply pipeline: parse → applyPatch → serialize → defensive re-parse
 * → render. No LLM call — caller supplies the ops, so this is the path
 * MCP tools use (Claude Code's host-side LLM generates the ops, the
 * server only validates + materializes them).
 */
export const applyPatchService = async (
  input: ApplyPatchInput,
): Promise<ApplyPatchOk | ApplyPatchErr> => {
  const parsed = parse(input.dsl);
  const errors = parsed.warnings.filter((w) => w.severity === 'error');
  if (errors.length > 0 || parsed.scene == null) {
    return { ok: false, kind: 'parse_failed', details: errors };
  }

  const result = applyPatch(parsed.scene, input.ops);
  if (result.applied.length === 0 && result.errors.length > 0) {
    return { ok: false, kind: 'patch_no_op', details: result.errors };
  }

  const newDsl = serialize(result.scene);

  // Defensive re-parse: catches AST corruption from a `modify` writing an
  // illegal field or an `add` injecting a malformed node, before render.
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
      applyWarnings: result.errors,
    };
  } catch (err) {
    return { ok: false, kind: 'render_failed', message: (err as Error).message };
  }
};
