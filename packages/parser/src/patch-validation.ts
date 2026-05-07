import type { Border, Node } from '@pixelagent/dsl-spec';
import { isContainer, parseBorderRaw } from './helpers.js';

const VALID_THEMES = ['light', 'dark'] as const;
const VALID_ALIGNS = ['left', 'center', 'right'] as const;
const VALID_WEIGHTS = ['regular', 'medium', 'semibold', 'bold'] as const;
const VALID_DIRECTIONS = ['row', 'column'] as const;
const VALID_FITS = ['cover', 'contain', 'fill'] as const;
const VALID_INPUT_TYPES = ['text', 'email', 'password', 'number', 'tel', 'url'] as const;
const VALID_BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'] as const;
const VALID_ELEMENT_STATES = ['default', 'hover', 'focus', 'active', 'disabled'] as const;
const VALID_EFFECTS = ['shadow', 'blur', 'overlay'] as const;
const VALID_NODE_TYPES = [
  'fill', 'rect', 'text', 'icon', 'image', 'input', 'button',
  'layer', 'stack', 'grid', 'repeat', 'state', 'effect',
] as const;

type Validator = (
  raw: string | number,
) => { ok: true; value: unknown } | { ok: false; error: string };

const num: Validator = (raw) => {
  if (typeof raw === 'number') return { ok: true, value: raw };
  if (typeof raw === 'string' && /^-?\d+$/.test(raw)) {
    return { ok: true, value: parseInt(raw, 10) };
  }
  return { ok: false, error: `expected integer, got '${raw}'` };
};

const str: Validator = (raw) => {
  if (typeof raw !== 'string') {
    return { ok: false, error: `expected string, got ${typeof raw}` };
  }
  // Mirror the parser's stripQuotes: an LLM may emit "\"foo\"" when it means foo.
  const unquoted =
    raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"'
      ? raw.slice(1, -1)
      : raw;
  return { ok: true, value: unquoted };
};

const color: Validator = (raw) => {
  if (typeof raw !== 'string') return { ok: false, error: 'expected color string' };
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) return { ok: true, value: raw };
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return { ok: true, value: raw };
  if (/^#[0-9a-fA-F]{8}$/.test(raw)) return { ok: true, value: raw };
  if (/^\$[a-zA-Z_][a-zA-Z0-9_-]*$/.test(raw)) return { ok: true, value: raw };
  return { ok: false, error: `invalid color '${raw}'` };
};

const enumOf = <T extends string>(values: readonly T[]): Validator => (raw) => {
  if (typeof raw !== 'string' || !(values as readonly string[]).includes(raw)) {
    return { ok: false, error: `expected one of ${values.join('|')}, got '${raw}'` };
  }
  return { ok: true, value: raw };
};

const border: Validator = (raw) => {
  if (typeof raw !== 'string') return { ok: false, error: 'expected border string' };
  const b = parseBorderRaw(raw);
  if (!b) return { ok: false, error: `invalid border value '${raw}'` };
  return { ok: true, value: b };
};

/**
 * Per-node modify rules. Maps each node type to its writable fields and the
 * value validator. The field name is the AST property — `max-width` is rewritten
 * to `maxWidth` and `type` to `inputType` by `aliasField` below to mirror the
 * names the LLM is more likely to emit (DSL syntax rather than IR shape).
 */
const RULES: Record<string, Record<string, Validator>> = {
  rect: { x: num, y: num, w: num, h: num, bg: color, r: num, border },
  text: {
    x: num, y: num, text: str,
    size: num, weight: enumOf(VALID_WEIGHTS), color,
    align: enumOf(VALID_ALIGNS), 'max-width': num, maxWidth: num,
  },
  icon: { x: num, y: num, name: str, size: num, color },
  image: { x: num, y: num, w: num, h: num, src: str, fit: enumOf(VALID_FITS), r: num },
  input: {
    x: num, y: num, w: num, h: num,
    type: enumOf(VALID_INPUT_TYPES), inputType: enumOf(VALID_INPUT_TYPES),
    placeholder: str, label: str, state: enumOf(VALID_ELEMENT_STATES),
  },
  button: {
    x: num, y: num, w: num, h: num, label: str,
    variant: enumOf(VALID_BUTTON_VARIANTS), state: enumOf(VALID_ELEMENT_STATES),
  },
  layer: { x: num, y: num, w: num, h: num, bg: color, r: num, border },
  stack: {
    x: num, y: num, direction: enumOf(VALID_DIRECTIONS),
    gap: num, align: enumOf(VALID_ALIGNS),
  },
  grid: { x: num, y: num, w: num, columns: num, gap: num },
  repeat: { count: num, direction: enumOf(VALID_DIRECTIONS), gap: num },
  fill: { x: num, y: num, w: num, h: num, color },
};

const FIELD_ALIASES: Record<string, string> = {
  'max-width': 'maxWidth',
  type: 'inputType',
};

export type ModifyValidation =
  | { ok: true; field: string; value: unknown }
  | { ok: false; error: string };

/**
 * Validate one `modify` op against the target node type, rejecting unknown
 * fields and bad values. Returns the canonicalized field name (e.g. `max-width`
 * → `maxWidth`) and coerced value ready to assign onto the node.
 */
export const validateModify = (
  nodeType: string,
  field: string,
  value: string | number,
): ModifyValidation => {
  const rules = RULES[nodeType];
  if (!rules) {
    return { ok: false, error: `cannot modify nodes of type '${nodeType}'` };
  }
  const validator = rules[field];
  if (!validator) {
    return {
      ok: false,
      error: `field '${field}' not writable on '${nodeType}'`,
    };
  }
  const r = validator(value);
  if (!r.ok) return r;
  const canonical = FIELD_ALIASES[field] ?? field;
  // For input.type → inputType, the canonical name is inputType. Apply that
  // remap so callers write the AST property, not the DSL keyword.
  if (nodeType === 'input' && field === 'type') {
    return { ok: true, field: 'inputType', value: r.value };
  }
  return { ok: true, field: canonical, value: r.value };
};

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Runtime shape check for an `add` op's payload. Verifies `type` is known,
 * required positional fields exist and are numbers, and recursively checks
 * children of container types. Doesn't enforce semantic rules (e.g.
 * `stack-no-coords`) — those surface on the post-patch re-parse.
 */
export const validateAddNode = (
  raw: unknown,
): { ok: true; node: Node } | { ok: false; error: string } => {
  if (!isPlainObject(raw)) return { ok: false, error: 'node must be an object' };
  const type = raw.type;
  if (typeof type !== 'string' || !(VALID_NODE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `invalid node type '${String(type)}'` };
  }
  // Meta nodes use targetId, not id.
  const idless = type === 'fill';
  const meta = type === 'state' || type === 'effect';
  if (!idless && !meta) {
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      return { ok: false, error: `${type} node requires non-empty id` };
    }
  }
  const requireNum = (k: string): string | null =>
    typeof raw[k] === 'number' ? null : `${type}.${k} must be a number`;
  const checks: string[] = [];
  if (!meta) {
    const xy = requireNum('x') ?? requireNum('y');
    if (xy) checks.push(xy);
  }
  // Size required for some types
  if (type === 'rect' || type === 'image' || type === 'input' || type === 'button' || type === 'layer' || type === 'fill') {
    const wh = requireNum('w') ?? requireNum('h');
    if (wh) checks.push(wh);
  }
  if (type === 'grid') {
    if (typeof raw.w !== 'number') checks.push('grid.w must be a number');
    if (typeof raw.columns !== 'number') checks.push('grid.columns must be a number');
  }
  if (type === 'repeat') {
    if (typeof raw.count !== 'number') checks.push('repeat.count must be a number');
  }
  if (type === 'fill') {
    if (typeof raw.color !== 'string') checks.push('fill.color must be a string');
  }
  if (type === 'state') {
    if (typeof raw.targetId !== 'string') checks.push('state.targetId must be a string');
    if (typeof raw.state !== 'string' || !(VALID_ELEMENT_STATES as readonly string[]).includes(raw.state)) {
      checks.push(`state.state must be one of ${VALID_ELEMENT_STATES.join('|')}`);
    }
  }
  if (type === 'effect') {
    if (typeof raw.targetId !== 'string') checks.push('effect.targetId must be a string');
    if (typeof raw.effect !== 'string' || !(VALID_EFFECTS as readonly string[]).includes(raw.effect)) {
      checks.push(`effect.effect must be one of ${VALID_EFFECTS.join('|')}`);
    }
  }
  if (checks.length > 0) return { ok: false, error: checks.join('; ') };

  if (isContainer(raw as Node)) {
    const children = raw.children;
    if (!Array.isArray(children)) {
      return { ok: false, error: `${type} requires children array` };
    }
    for (const child of children) {
      const inner = validateAddNode(child);
      if (!inner.ok) return inner;
    }
  }

  return { ok: true, node: raw as unknown as Node };
};
