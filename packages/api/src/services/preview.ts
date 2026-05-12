import { parse, type ValidationWarning } from '@pixelagent/parser';
import { dslToHtml, render } from '@pixelagent/renderer';
import { mergeProjectTokens } from './load-tokens-dsl.js';

export type PreviewOk = {
  ok: true;
  png: Buffer;
  renderMs: number;
  warnings: ValidationWarning[];
};

export type PreviewErr =
  | {
      ok: false;
      kind: 'parse_failed';
      errors: ValidationWarning[];
      warnings: ValidationWarning[];
    }
  | { ok: false; kind: 'render_failed'; message: string };

export type PreviewInput = { dsl: string; scale?: number };

/**
 * Pure preview pipeline: parse → dslToHtml → render. Returns a
 * discriminated result so HTTP and MCP surfaces can shape responses
 * without duplicating control flow.
 */
export const previewService = async (
  input: PreviewInput,
): Promise<PreviewOk | PreviewErr> => {
  const merged = await mergeProjectTokens(input.dsl);
  const { scene, warnings } = parse(merged);
  const errors = warnings.filter((w) => w.severity === 'error');
  const warns = warnings.filter((w) => w.severity === 'warning');

  if (errors.length > 0 || scene == null) {
    return { ok: false, kind: 'parse_failed', errors, warnings: warns };
  }

  const start = performance.now();
  try {
    const html = dslToHtml(scene);
    const png = await render(html, {
      width: scene.screen.w,
      height: scene.screen.h,
      deviceScaleFactor: input.scale ?? 1.0,
    });
    return {
      ok: true,
      png,
      renderMs: Math.round(performance.now() - start),
      warnings: warns,
    };
  } catch (err) {
    return {
      ok: false,
      kind: 'render_failed',
      message: (err as Error).message,
    };
  }
};
