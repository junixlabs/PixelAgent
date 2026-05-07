import { parse, type ValidationWarning } from '@pixelagent/parser';
import { toReact } from '@pixelagent/codegen';

export type SynthesizeTarget = 'react';

export type SynthesizeInput = {
  dsl: string;
  target: SynthesizeTarget;
};

export type SynthesizeOk = {
  ok: true;
  code: string;
  warnings: ValidationWarning[];
};

export type SynthesizeErr = {
  ok: false;
  kind: 'parse_failed';
  details: ValidationWarning[];
};

/**
 * Pure synthesize pipeline: parse → codegen. Stateless and LLM-free —
 * the codegen target maps the AST deterministically. Shared by the HTTP
 * `/synthesize` route and the MCP `pixelagent_synthesize` tool.
 */
export const synthesizeService = (
  input: SynthesizeInput,
): SynthesizeOk | SynthesizeErr => {
  const parsed = parse(input.dsl);
  const errors = parsed.warnings.filter((w) => w.severity === 'error');
  if (errors.length > 0 || parsed.scene == null) {
    return { ok: false, kind: 'parse_failed', details: errors };
  }
  const code =
    input.target === 'react' ? toReact(parsed.scene) : toReact(parsed.scene);
  return {
    ok: true,
    code,
    warnings: parsed.warnings.filter((w) => w.severity === 'warning'),
  };
};
