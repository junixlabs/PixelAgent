import type {
  Scene,
  Node,
  ScreenNode,
  TokenNode,
  ValidationWarning,
  Border,
  ButtonNode,
  ButtonVariant,
  ElementState,
  Direction,
  EffectNode,
  EffectType,
  FillNode,
  Fit,
  GridNode,
  IconNode,
  ImageNode,
  InputNode,
  InputType,
  LayerNode,
  RectNode,
  RepeatNode,
  StackNode,
  StateNode,
  TextNode,
  Theme,
  Weight,
  Align,
} from '@pixelagent/dsl-spec';
import type { Token } from './types.js';
import { tokenize } from './tokenizer.js';

// Annotate parsed nodes with their source line for validator diagnostics.
// Stored as a non-IR property; consumers should ignore it.
const LINE_KEY = '__line' as const;

function setLine<T extends object>(obj: T, line: number): T {
  Object.defineProperty(obj, LINE_KEY, {
    value: line,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return obj;
}

export function getNodeLine(obj: object): number | undefined {
  return (obj as Record<string, unknown>)[LINE_KEY] as number | undefined;
}

export type BuildResult = {
  scene: Scene | null;
  errors: ValidationWarning[];
};

const VALID_THEMES: Theme[] = ['light', 'dark'];
const VALID_ALIGNS: Align[] = ['left', 'center', 'right'];
const VALID_WEIGHTS: Weight[] = ['regular', 'medium', 'semibold', 'bold'];
const VALID_DIRECTIONS: Direction[] = ['row', 'column'];
const VALID_FITS: Fit[] = ['cover', 'contain', 'fill'];
const VALID_INPUT_TYPES: InputType[] = [
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
];
const VALID_BUTTON_VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'destructive',
];
const VALID_ELEMENT_STATES: ElementState[] = [
  'default',
  'hover',
  'focus',
  'active',
  'disabled',
];
const VALID_EFFECT_TYPES: EffectType[] = ['shadow', 'blur', 'overlay'];

type ContainerFrame = {
  kind: 'container';
  parentList: Node[];
  childrenList: Node[];
  openerLine: number;
  command: string;
};
type StateFrame = {
  kind: 'state';
  parentList: Node[];
  overrides: Record<string, string | number>;
  openerLine: number;
};
type Frame = ContainerFrame | StateFrame;

export function buildScene(tokens: Token[]): BuildResult {
  const errors: ValidationWarning[] = [];
  let screen: ScreenNode | null = null;
  const tokenNodes: TokenNode[] = [];
  const rootNodes: Node[] = [];
  const stack: Frame[] = [];
  let current: Node[] = rootNodes;
  let firstCommandLine = -1;

  let i = 0;
  while (i < tokens.length) {
    const lineTokens: Token[] = [];
    while (i < tokens.length && tokens[i].kind !== 'newline') {
      lineTokens.push(tokens[i]);
      i++;
    }
    if (i < tokens.length && tokens[i].kind === 'newline') i++;
    if (lineTokens.length === 0) continue;

    const head = lineTokens[0];
    const lineNo = head.line;
    const top = stack[stack.length - 1];
    const inStateBody = top?.kind === 'state';

    if (inStateBody) {
      if (head.kind === 'end') {
        const popped = stack.pop()!;
        current = popped.parentList;
        continue;
      }
      if (head.kind === 'kvspaced' && lineTokens.length === 1) {
        (top as StateFrame).overrides[head.key] = coerceScalar(head.raw);
        continue;
      }
      errors.push({
        rule: 'parse-error',
        line: lineNo,
        message: 'expected `key: value` inside STATE body',
        severity: 'error',
      });
      continue;
    }

    if (head.kind === 'end') {
      if (stack.length === 0) {
        errors.push({
          rule: 'block-end-required',
          line: lineNo,
          message: 'unmatched END',
          severity: 'error',
        });
      } else {
        const popped = stack.pop()!;
        current = popped.parentList;
      }
      continue;
    }

    if (head.kind !== 'command') {
      errors.push({
        rule: 'parse-error',
        line: lineNo,
        message: `expected command, got ${head.kind}`,
        severity: 'error',
      });
      continue;
    }

    if (firstCommandLine === -1) firstCommandLine = lineNo;
    const cmd = head.value;
    const rest = lineTokens.slice(1);

    switch (cmd) {
      case 'SCREEN': {
        if (screen !== null) {
          errors.push({
            rule: 'screen-first',
            line: lineNo,
            message: 'SCREEN must appear exactly once',
            severity: 'error',
          });
          break;
        }
        if (firstCommandLine !== lineNo) {
          errors.push({
            rule: 'screen-first',
            line: lineNo,
            message: 'SCREEN must be the first command',
            severity: 'error',
          });
        }
        screen = parseScreen(rest, lineNo, errors);
        break;
      }
      case 'TOKEN': {
        const tn = parseTokenNode(rest, lineNo, errors);
        setLine(tn, lineNo);
        tokenNodes.push(tn);
        break;
      }
      case 'FILL':
        current.push(setLine(parseFill(rest, lineNo, errors), lineNo));
        break;
      case 'RECT':
        current.push(setLine(parseRect(rest, lineNo, errors), lineNo));
        break;
      case 'TEXT':
        current.push(setLine(parseText(rest, lineNo, errors), lineNo));
        break;
      case 'ICON':
        current.push(setLine(parseIcon(rest, lineNo, errors), lineNo));
        break;
      case 'IMAGE':
        current.push(setLine(parseImage(rest, lineNo, errors), lineNo));
        break;
      case 'INPUT':
        current.push(setLine(parseInput(rest, lineNo, errors), lineNo));
        break;
      case 'BUTTON':
        current.push(setLine(parseButton(rest, lineNo, errors), lineNo));
        break;
      case 'LAYER': {
        const node = setLine(parseLayerHeader(rest, lineNo, errors), lineNo);
        current.push(node);
        stack.push({
          kind: 'container',
          parentList: current,
          childrenList: node.children,
          openerLine: lineNo,
          command: 'LAYER',
        });
        current = node.children;
        break;
      }
      case 'STACK': {
        const node = setLine(parseStackHeader(rest, lineNo, errors), lineNo);
        current.push(node);
        stack.push({
          kind: 'container',
          parentList: current,
          childrenList: node.children,
          openerLine: lineNo,
          command: 'STACK',
        });
        current = node.children;
        break;
      }
      case 'GRID': {
        const node = setLine(parseGridHeader(rest, lineNo, errors), lineNo);
        current.push(node);
        stack.push({
          kind: 'container',
          parentList: current,
          childrenList: node.children,
          openerLine: lineNo,
          command: 'GRID',
        });
        current = node.children;
        break;
      }
      case 'REPEAT': {
        const node = setLine(parseRepeatHeader(rest, lineNo, errors), lineNo);
        current.push(node);
        stack.push({
          kind: 'container',
          parentList: current,
          childrenList: node.children,
          openerLine: lineNo,
          command: 'REPEAT',
        });
        current = node.children;
        break;
      }
      case 'STATE': {
        const node = setLine(parseStateHeader(rest, lineNo, errors), lineNo);
        current.push(node);
        stack.push({
          kind: 'state',
          parentList: current,
          overrides: node.overrides,
          openerLine: lineNo,
        });
        break;
      }
      case 'EFFECT':
        current.push(setLine(parseEffect(rest, lineNo, errors), lineNo));
        break;
      default:
        errors.push({
          rule: 'parse-error',
          line: lineNo,
          message: `unknown command ${cmd}`,
          severity: 'error',
        });
    }
  }

  for (const frame of stack) {
    errors.push({
      rule: 'block-end-required',
      line: frame.openerLine,
      message: 'unclosed block (missing END)',
      severity: 'error',
    });
  }

  if (!screen) {
    errors.push({
      rule: 'screen-first',
      line: 1,
      message: 'SCREEN required (must be the first command)',
      severity: 'error',
    });
    return { scene: null, errors };
  }

  if (errors.some((w) => w.severity === 'error')) {
    return { scene: null, errors };
  }

  const scene: Scene = {
    screen,
    tokens: tokenNodes,
    nodes: rootNodes,
  };
  return { scene, errors };
}

/** @internal — re-exposed so the public `parse()` orchestrator stays in index.ts. */
export function _runTokenize(input: string) {
  return tokenize(input);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function coerceScalar(raw: string): string | number {
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return raw;
}

function stripQuotes(raw: string): string {
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw.slice(1, -1);
  }
  return raw;
}

function expectNumber(
  toks: Token[],
  idx: number,
  name: string,
  line: number,
  errors: ValidationWarning[],
): number {
  const t = toks[idx];
  if (!t || t.kind !== 'number') {
    errors.push({
      rule: 'parse-error',
      line,
      message: `expected number for ${name}`,
      severity: 'error',
    });
    return 0;
  }
  return t.value;
}

function expectIdent(
  toks: Token[],
  idx: number,
  name: string,
  line: number,
  errors: ValidationWarning[],
): string {
  const t = toks[idx];
  if (!t || t.kind !== 'ident') {
    errors.push({
      rule: 'parse-error',
      line,
      message: `expected identifier for ${name}`,
      severity: 'error',
    });
    return '';
  }
  return t.value;
}

function expectString(
  toks: Token[],
  idx: number,
  name: string,
  line: number,
  errors: ValidationWarning[],
): string {
  const t = toks[idx];
  if (!t || t.kind !== 'string') {
    errors.push({
      rule: 'parse-error',
      line,
      message: `expected quoted string for ${name}`,
      severity: 'error',
    });
    return '';
  }
  return t.value;
}

function expectColor(
  toks: Token[],
  idx: number,
  name: string,
  line: number,
  errors: ValidationWarning[],
): string {
  const t = toks[idx];
  if (!t) {
    errors.push({
      rule: 'parse-error',
      line,
      message: `expected color for ${name}`,
      severity: 'error',
    });
    return '#000000';
  }
  if (t.kind === 'color') return t.value;
  if (t.kind === 'tokenref') return `$${t.value}`;
  errors.push({
    rule: 'parse-error',
    line,
    message: `expected color for ${name}`,
    severity: 'error',
  });
  return '#000000';
}

/**
 * Reads kvinline pairs from the remainder of a line. Merges `border:N` followed
 * by a color token into a single raw value `N #color`, since `border:1 #ccc`
 * is one logical value but tokenizes as two tokens (whitespace-separated).
 */
function readKvInline(
  toks: Token[],
  from: number,
  line: number,
  errors: ValidationWarning[],
): Record<string, string> {
  const out: Record<string, string> = {};
  let i = from;
  while (i < toks.length) {
    const t = toks[i];
    if (t.kind === 'kvinline') {
      let raw = t.raw;
      const next = toks[i + 1];
      if (/^\d+$/.test(raw) && next && next.kind === 'color') {
        raw = `${raw} ${next.value}`;
        i += 2;
      } else {
        i += 1;
      }
      out[t.key] = raw;
    } else {
      errors.push({
        rule: 'parse-error',
        line,
        message: `unexpected ${t.kind} after positional args`,
        severity: 'error',
      });
      i += 1;
    }
  }
  return out;
}

function parseBorder(
  raw: string,
  line: number,
  errors: ValidationWarning[],
): Border | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 2) {
    errors.push({
      rule: 'parse-error',
      line,
      message: `invalid border value '${raw}' (expected 'width color')`,
      severity: 'error',
    });
    return null;
  }
  const width = parseInt(parts[0], 10);
  if (Number.isNaN(width)) {
    errors.push({
      rule: 'parse-error',
      line,
      message: `invalid border width '${parts[0]}'`,
      severity: 'error',
    });
    return null;
  }
  return { width, color: parts[1] };
}

function checkEnum<T extends string>(
  raw: string,
  valid: readonly T[],
  field: string,
  line: number,
  errors: ValidationWarning[],
): T | undefined {
  if ((valid as readonly string[]).includes(raw)) return raw as T;
  errors.push({
    rule: 'parse-error',
    line,
    message: `invalid value '${raw}' for ${field}`,
    severity: 'error',
  });
  return undefined;
}

function parseIntKv(
  raw: string,
  field: string,
  line: number,
  errors: ValidationWarning[],
): number | undefined {
  if (!/^\d+$/.test(raw)) {
    errors.push({
      rule: 'parse-error',
      line,
      message: `expected integer for ${field}, got '${raw}'`,
      severity: 'error',
    });
    return undefined;
  }
  return parseInt(raw, 10);
}

// ─── per-command parsers ────────────────────────────────────────────────────

function parseScreen(rest: Token[], line: number, errors: ValidationWarning[]): ScreenNode {
  const w = expectNumber(rest, 0, 'SCREEN width', line, errors);
  const h = expectNumber(rest, 1, 'SCREEN height', line, errors);
  const kvs = readKvInline(rest, 2, line, errors);
  const node: ScreenNode = { type: 'screen', w, h };
  if (kvs.theme !== undefined) {
    const v = checkEnum(kvs.theme, VALID_THEMES, 'theme', line, errors);
    if (v) node.theme = v;
  }
  return node;
}

function parseTokenNode(rest: Token[], line: number, errors: ValidationWarning[]): TokenNode {
  const id = expectIdent(rest, 0, 'TOKEN id', line, errors);
  const t = rest[1];
  let value = '';
  if (!t) {
    errors.push({
      rule: 'parse-error',
      line,
      message: 'TOKEN value required',
      severity: 'error',
    });
  } else if (t.kind === 'color') value = t.value;
  else if (t.kind === 'number') value = String(t.value);
  else if (t.kind === 'ident') value = t.value;
  else if (t.kind === 'string') value = t.value;
  else {
    errors.push({
      rule: 'parse-error',
      line,
      message: 'TOKEN value: expected color, number, or identifier',
      severity: 'error',
    });
  }
  return { type: 'token', id, value };
}

function parseFill(rest: Token[], line: number, errors: ValidationWarning[]): FillNode {
  let i = 0;
  if (rest[0]?.kind === 'ident') {
    errors.push({
      rule: 'fill-no-id',
      line,
      message: `FILL has no id (paint-only); got extra identifier '${rest[0].value}'`,
      severity: 'warning',
    });
    i = 1;
  }
  const x = expectNumber(rest, i, 'FILL x', line, errors); i++;
  const y = expectNumber(rest, i, 'FILL y', line, errors); i++;
  const w = expectNumber(rest, i, 'FILL w', line, errors); i++;
  const h = expectNumber(rest, i, 'FILL h', line, errors); i++;
  const color = expectColor(rest, i, 'FILL color', line, errors);
  return { type: 'fill', x, y, w, h, color };
}

function parseRect(rest: Token[], line: number, errors: ValidationWarning[]): RectNode {
  const id = expectIdent(rest, 0, 'RECT id', line, errors);
  const x = expectNumber(rest, 1, 'RECT x', line, errors);
  const y = expectNumber(rest, 2, 'RECT y', line, errors);
  const w = expectNumber(rest, 3, 'RECT w', line, errors);
  const h = expectNumber(rest, 4, 'RECT h', line, errors);
  const kvs = readKvInline(rest, 5, line, errors);
  const node: RectNode = { type: 'rect', id, x, y, w, h };
  if (kvs.bg !== undefined) node.bg = kvs.bg;
  if (kvs.r !== undefined) {
    const r = parseIntKv(kvs.r, 'r', line, errors);
    if (r !== undefined) node.r = r;
  }
  if (kvs.border !== undefined) {
    const b = parseBorder(kvs.border, line, errors);
    if (b) node.border = b;
  }
  return node;
}

function parseText(rest: Token[], line: number, errors: ValidationWarning[]): TextNode {
  const id = expectIdent(rest, 0, 'TEXT id', line, errors);
  const x = expectNumber(rest, 1, 'TEXT x', line, errors);
  const y = expectNumber(rest, 2, 'TEXT y', line, errors);
  const text = expectString(rest, 3, 'TEXT text', line, errors);
  const kvs = readKvInline(rest, 4, line, errors);
  const node: TextNode = { type: 'text', id, x, y, text };
  if (kvs.size !== undefined) {
    const s = parseIntKv(kvs.size, 'size', line, errors);
    if (s !== undefined) node.size = s;
  }
  if (kvs.weight !== undefined) {
    const w = checkEnum(kvs.weight, VALID_WEIGHTS, 'weight', line, errors);
    if (w) node.weight = w;
  }
  if (kvs.color !== undefined) node.color = kvs.color;
  if (kvs.align !== undefined) {
    const a = checkEnum(kvs.align, VALID_ALIGNS, 'align', line, errors);
    if (a) node.align = a;
  }
  if (kvs['max-width'] !== undefined) {
    const mw = parseIntKv(kvs['max-width'], 'max-width', line, errors);
    if (mw !== undefined) node.maxWidth = mw;
  }
  return node;
}

function parseIcon(rest: Token[], line: number, errors: ValidationWarning[]): IconNode {
  const id = expectIdent(rest, 0, 'ICON id', line, errors);
  const x = expectNumber(rest, 1, 'ICON x', line, errors);
  const y = expectNumber(rest, 2, 'ICON y', line, errors);
  const name = expectString(rest, 3, 'ICON name', line, errors);
  const kvs = readKvInline(rest, 4, line, errors);
  const node: IconNode = { type: 'icon', id, x, y, name };
  if (kvs.size !== undefined) {
    const s = parseIntKv(kvs.size, 'size', line, errors);
    if (s !== undefined) node.size = s;
  }
  if (kvs.color !== undefined) node.color = kvs.color;
  return node;
}

function parseImage(rest: Token[], line: number, errors: ValidationWarning[]): ImageNode {
  const id = expectIdent(rest, 0, 'IMAGE id', line, errors);
  const x = expectNumber(rest, 1, 'IMAGE x', line, errors);
  const y = expectNumber(rest, 2, 'IMAGE y', line, errors);
  const w = expectNumber(rest, 3, 'IMAGE w', line, errors);
  const h = expectNumber(rest, 4, 'IMAGE h', line, errors);
  const src = expectString(rest, 5, 'IMAGE src', line, errors);
  const kvs = readKvInline(rest, 6, line, errors);
  const node: ImageNode = { type: 'image', id, x, y, w, h, src };
  if (kvs.fit !== undefined) {
    const f = checkEnum(kvs.fit, VALID_FITS, 'fit', line, errors);
    if (f) node.fit = f;
  }
  if (kvs.r !== undefined) {
    const r = parseIntKv(kvs.r, 'r', line, errors);
    if (r !== undefined) node.r = r;
  }
  return node;
}

function parseInput(rest: Token[], line: number, errors: ValidationWarning[]): InputNode {
  const id = expectIdent(rest, 0, 'INPUT id', line, errors);
  const x = expectNumber(rest, 1, 'INPUT x', line, errors);
  const y = expectNumber(rest, 2, 'INPUT y', line, errors);
  const w = expectNumber(rest, 3, 'INPUT w', line, errors);
  const h = expectNumber(rest, 4, 'INPUT h', line, errors);
  const kvs = readKvInline(rest, 5, line, errors);
  const node: InputNode = { type: 'input', id, x, y, w, h };
  if (kvs.type !== undefined) {
    const v = checkEnum(kvs.type, VALID_INPUT_TYPES, 'type', line, errors);
    if (v) node.inputType = v;
  }
  if (kvs.placeholder !== undefined) node.placeholder = stripQuotes(kvs.placeholder);
  if (kvs.label !== undefined) node.label = stripQuotes(kvs.label);
  if (kvs.state !== undefined) {
    const s = checkEnum(kvs.state, VALID_ELEMENT_STATES, 'state', line, errors);
    if (s) node.state = s;
  }
  return node;
}

function parseButton(rest: Token[], line: number, errors: ValidationWarning[]): ButtonNode {
  const id = expectIdent(rest, 0, 'BUTTON id', line, errors);
  const x = expectNumber(rest, 1, 'BUTTON x', line, errors);
  const y = expectNumber(rest, 2, 'BUTTON y', line, errors);
  const w = expectNumber(rest, 3, 'BUTTON w', line, errors);
  const h = expectNumber(rest, 4, 'BUTTON h', line, errors);
  const label = expectString(rest, 5, 'BUTTON label', line, errors);
  const kvs = readKvInline(rest, 6, line, errors);
  const node: ButtonNode = { type: 'button', id, x, y, w, h, label };
  if (kvs.variant !== undefined) {
    const v = checkEnum(kvs.variant, VALID_BUTTON_VARIANTS, 'variant', line, errors);
    if (v) node.variant = v;
  }
  if (kvs.state !== undefined) {
    const s = checkEnum(kvs.state, VALID_ELEMENT_STATES, 'state', line, errors);
    if (s) node.state = s;
  }
  return node;
}

function parseLayerHeader(rest: Token[], line: number, errors: ValidationWarning[]): LayerNode {
  const id = expectIdent(rest, 0, 'LAYER id', line, errors);
  const x = expectNumber(rest, 1, 'LAYER x', line, errors);
  const y = expectNumber(rest, 2, 'LAYER y', line, errors);
  const w = expectNumber(rest, 3, 'LAYER w', line, errors);
  const h = expectNumber(rest, 4, 'LAYER h', line, errors);
  const kvs = readKvInline(rest, 5, line, errors);
  const node: LayerNode = { type: 'layer', id, x, y, w, h, children: [] };
  if (kvs.bg !== undefined) node.bg = kvs.bg;
  if (kvs.r !== undefined) {
    const r = parseIntKv(kvs.r, 'r', line, errors);
    if (r !== undefined) node.r = r;
  }
  if (kvs.border !== undefined) {
    const b = parseBorder(kvs.border, line, errors);
    if (b) node.border = b;
  }
  return node;
}

function parseStackHeader(rest: Token[], line: number, errors: ValidationWarning[]): StackNode {
  const id = expectIdent(rest, 0, 'STACK id', line, errors);
  const x = expectNumber(rest, 1, 'STACK x', line, errors);
  const y = expectNumber(rest, 2, 'STACK y', line, errors);
  const kvs = readKvInline(rest, 3, line, errors);
  const node: StackNode = { type: 'stack', id, x, y, children: [] };
  if (kvs.direction !== undefined) {
    const d = checkEnum(kvs.direction, VALID_DIRECTIONS, 'direction', line, errors);
    if (d) node.direction = d;
  }
  if (kvs.gap !== undefined) {
    const g = parseIntKv(kvs.gap, 'gap', line, errors);
    if (g !== undefined) node.gap = g;
  }
  if (kvs.align !== undefined) {
    const a = checkEnum(kvs.align, VALID_ALIGNS, 'align', line, errors);
    if (a) node.align = a;
  }
  return node;
}

function parseGridHeader(rest: Token[], line: number, errors: ValidationWarning[]): GridNode {
  const id = expectIdent(rest, 0, 'GRID id', line, errors);
  const x = expectNumber(rest, 1, 'GRID x', line, errors);
  const y = expectNumber(rest, 2, 'GRID y', line, errors);
  const w = expectNumber(rest, 3, 'GRID w', line, errors);
  const kvs = readKvInline(rest, 4, line, errors);
  let columns = 1;
  if (kvs.columns === undefined) {
    errors.push({
      rule: 'parse-error',
      line,
      message: 'GRID requires columns:N',
      severity: 'error',
    });
  } else {
    const c = parseIntKv(kvs.columns, 'columns', line, errors);
    if (c !== undefined) columns = c;
  }
  const node: GridNode = { type: 'grid', id, x, y, w, columns, children: [] };
  if (kvs.gap !== undefined) {
    const g = parseIntKv(kvs.gap, 'gap', line, errors);
    if (g !== undefined) node.gap = g;
  }
  return node;
}

function parseRepeatHeader(rest: Token[], line: number, errors: ValidationWarning[]): RepeatNode {
  const id = expectIdent(rest, 0, 'REPEAT id', line, errors);
  const count = expectNumber(rest, 1, 'REPEAT count', line, errors);
  const kvs = readKvInline(rest, 2, line, errors);
  const node: RepeatNode = { type: 'repeat', id, count, children: [] };
  if (kvs.direction !== undefined) {
    const d = checkEnum(kvs.direction, VALID_DIRECTIONS, 'direction', line, errors);
    if (d) node.direction = d;
  }
  if (kvs.gap !== undefined) {
    const g = parseIntKv(kvs.gap, 'gap', line, errors);
    if (g !== undefined) node.gap = g;
  }
  return node;
}

function parseStateHeader(rest: Token[], line: number, errors: ValidationWarning[]): StateNode {
  const targetId = expectIdent(rest, 0, 'STATE target id', line, errors);
  const stateRaw = expectIdent(rest, 1, 'STATE state', line, errors);
  let state: ElementState = 'default';
  const checked = checkEnum(stateRaw, VALID_ELEMENT_STATES, 'state', line, errors);
  if (checked) state = checked;
  return { type: 'state', targetId, state, overrides: {} };
}

function parseEffect(rest: Token[], line: number, errors: ValidationWarning[]): EffectNode {
  const targetId = expectIdent(rest, 0, 'EFFECT target id', line, errors);
  const effectName = expectIdent(rest, 1, 'EFFECT effect', line, errors);
  let effect: EffectType = 'shadow';
  if (effectName === 'border') {
    errors.push({
      rule: 'border-inline-only',
      line,
      message: "border must be specified inline (border:width color), not via EFFECT",
      severity: 'error',
    });
  } else {
    const checked = checkEnum(effectName, VALID_EFFECT_TYPES, 'effect', line, errors);
    if (checked) effect = checked;
  }
  const kvs = readKvInline(rest, 2, line, errors);
  const node: EffectNode = { type: 'effect', targetId, effect };
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(kvs)) {
    params[k] = coerceScalar(v);
  }
  if (Object.keys(params).length > 0) node.params = params;
  return node;
}
