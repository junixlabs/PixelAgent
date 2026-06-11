import { parse, type ValidationWarning } from '@pixelagent/parser';
import type { Node } from '@pixelagent/dsl-spec';
import {
  bundleToHtml,
  dslToHtml,
  render,
  type BundleScreen,
} from '@pixelagent/renderer';
import { mergeProjectTokens } from './load-tokens-dsl.js';

export type PreviewFormat = 'png' | 'html';

export type PreviewOk =
  | {
      ok: true;
      format: 'png';
      png: Buffer;
      renderMs: number;
      warnings: ValidationWarning[];
    }
  | {
      ok: true;
      format: 'html';
      html: string;
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

export type PreviewInput = {
  dsl: string;
  scale?: number;
  format?: PreviewFormat;
};

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

  // HTML format skips Chrome entirely: the interactive preview IS the
  // renderer's intermediate document, plus the click-to-inspect overlay.
  if (input.format === 'html') {
    return {
      ok: true,
      format: 'html',
      html: dslToHtml(scene, { inspector: true }),
      renderMs: Math.round(performance.now() - start),
      warnings: warns,
    };
  }

  try {
    const html = dslToHtml(scene);
    const png = await render(html, {
      width: scene.screen.w,
      height: scene.screen.h,
      deviceScaleFactor: input.scale ?? 1.0,
    });
    return {
      ok: true,
      format: 'png',
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

export type PreviewBundleInput = {
  screens: Record<string, string>;
  entry: string;
  format?: PreviewFormat;
  scale?: number;
};

export type PreviewBundleOk =
  | {
      ok: true;
      format: 'html';
      html: string;
      renderMs: number;
      warnings: ValidationWarning[];
    }
  | {
      ok: true;
      format: 'png';
      pngs: Record<string, Buffer>;
      renderMs: number;
      warnings: ValidationWarning[];
    };

export type PreviewBundleErr =
  | {
      ok: false;
      kind: 'parse_failed';
      screenId: string;
      errors: ValidationWarning[];
      warnings: ValidationWarning[];
    }
  | { ok: false; kind: 'bad_bundle'; message: string }
  | { ok: false; kind: 'render_failed'; message: string };

const collectGotoWarnings = (
  nodes: Node[],
  screenId: string,
  knownScreens: Set<string>,
  out: ValidationWarning[],
): void => {
  for (const n of nodes) {
    if ('children' in n) {
      collectGotoWarnings(
        (n as { children: Node[] }).children,
        screenId,
        knownScreens,
        out,
      );
    }
    const g = (n as { goto?: string }).goto;
    if (g && !knownScreens.has(g)) {
      out.push({
        rule: 'goto-unknown-screen',
        severity: 'warning',
        nodeId: (n as { id?: string }).id,
        message: `[${screenId}] goto target '${g}' is not a screen in this bundle`,
      });
    }
  }
};

/**
 * Multi-screen preview: parse every screen, cross-check goto targets,
 * then compose either one navigable HTML bundle or per-screen PNGs.
 * Stateless — the whole bundle travels in each request.
 */
export const previewBundleService = async (
  input: PreviewBundleInput,
): Promise<PreviewBundleOk | PreviewBundleErr> => {
  const ids = Object.keys(input.screens);
  if (ids.length === 0) {
    return {
      ok: false,
      kind: 'bad_bundle',
      message: 'screens must contain at least one entry',
    };
  }
  if (!ids.includes(input.entry)) {
    return {
      ok: false,
      kind: 'bad_bundle',
      message: `entry '${input.entry}' is not a key of screens`,
    };
  }

  const parsed: BundleScreen[] = [];
  const warns: ValidationWarning[] = [];
  for (const id of ids) {
    const merged = await mergeProjectTokens(input.screens[id]);
    const { scene, warnings } = parse(merged);
    const errors = warnings.filter((w) => w.severity === 'error');
    for (const w of warnings.filter((x) => x.severity === 'warning')) {
      warns.push({ ...w, message: `[${id}] ${w.message}` });
    }
    if (errors.length > 0 || scene == null) {
      return { ok: false, kind: 'parse_failed', screenId: id, errors, warnings: warns };
    }
    parsed.push({ id, scene });
  }

  const knownScreens = new Set(ids);
  for (const { id, scene } of parsed) {
    collectGotoWarnings(scene.nodes, id, knownScreens, warns);
  }

  const start = performance.now();
  if ((input.format ?? 'html') === 'html') {
    return {
      ok: true,
      format: 'html',
      html: bundleToHtml(parsed, input.entry),
      renderMs: Math.round(performance.now() - start),
      warnings: warns,
    };
  }

  try {
    const pngs: Record<string, Buffer> = {};
    for (const { id, scene } of parsed) {
      pngs[id] = await render(dslToHtml(scene), {
        width: scene.screen.w,
        height: scene.screen.h,
        deviceScaleFactor: input.scale ?? 1.0,
      });
    }
    return {
      ok: true,
      format: 'png',
      pngs,
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
