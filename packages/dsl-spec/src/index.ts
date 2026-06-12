/**
 * @pixelagent/dsl-spec — typed Scene IR for the PixelAgent DSL v0.
 *
 * This module is the single source of truth shared by the parser, renderer,
 * and codegen packages. It exports only types — no runtime values — so
 * importers stay dependency-free.
 *
 * Spec: ./SPEC.md
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * Color value. One of:
 *   - hex literal `#RRGGBB` or `#RRGGBBAA`
 *   - token reference `$id` (resolved against `Scene.tokens`)
 */
export type Color = string;

/** Token reference syntax: `$<id>`. */
export type TokenRef = `$${string}`;

export type Theme = 'light' | 'dark';
export type Align = 'left' | 'center' | 'right';
export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
/** Semantic heading level for codegen (`<h1>`–`<h6>`). Renderer-inert. */
export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
/** Semantic container role for codegen (`<nav>`, `<main>`, …). Renderer-inert. */
export type ContainerRole =
  | 'nav'
  | 'header'
  | 'main'
  | 'section'
  | 'aside'
  | 'footer';
export type Direction = 'row' | 'column';
export type Fit = 'cover' | 'contain' | 'fill';
export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url';
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive';
export type ElementState =
  | 'default'
  | 'hover'
  | 'focus'
  | 'active'
  | 'disabled';
export type EffectType = 'shadow' | 'blur' | 'overlay';

export type Border = { width: number; color: Color };
export type Position = { x: number; y: number };
export type Size = { w: number; h: number };

// ─── Tokens & meta ───────────────────────────────────────────────────────────

export type Token = { id: string; value: string };

/**
 * Renderer hint. Open-ended for v0 — the renderer package will narrow this
 * once concrete needs land. Spec consumers should treat unknown `kind` values
 * as opaque pass-throughs.
 */
export type RenderHint = { kind: string; [key: string]: unknown };

export type ValidationSeverity = 'error' | 'warning';

export type ValidationWarning = {
  /** Stable rule id (e.g. `screen-first`). See SPEC.md §Validation rules. */
  rule: string;
  line?: number;
  nodeId?: string;
  message: string;
  severity: ValidationSeverity;
};

// ─── Node discriminated union ────────────────────────────────────────────────

export type ScreenNode = {
  type: 'screen';
  w: number;
  h: number;
  theme?: Theme;
};

export type TokenNode = {
  type: 'token';
  id: string;
  value: string;
};

/** FILL is paint-only and intentionally has no id (rule #4 exception). */
export type FillNode = {
  type: 'fill';
  x: number;
  y: number;
  w: number;
  h: number;
  color: Color;
};

export type RectNode = {
  type: 'rect';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  bg?: Color;
  r?: number;
  border?: Border;
};

export type TextNode = {
  type: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  size?: number;
  weight?: Weight;
  color?: Color;
  align?: Align;
  maxWidth?: number;
  /** Flow link: id of the screen this element navigates to in preview. */
  goto?: string;
  /** Semantic heading level — codegen emits <h1>–<h6>. */
  level?: HeadingLevel;
  /** External link — codegen wraps in <a href>. */
  href?: string;
};

export type IconNode = {
  type: 'icon';
  id: string;
  x: number;
  y: number;
  name: string;
  size?: number;
  color?: Color;
  goto?: string;
};

export type ImageNode = {
  type: 'image';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  fit?: Fit;
  r?: number;
  goto?: string;
  /** Accessibility/SEO alt text — codegen emits it on the <img>. */
  alt?: string;
  href?: string;
};

export type InputNode = {
  type: 'input';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  inputType?: InputType;
  placeholder?: string;
  label?: string;
  state?: ElementState;
};

export type ButtonNode = {
  type: 'button';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  variant?: ButtonVariant;
  state?: ElementState;
  goto?: string;
  href?: string;
};

export type LayerNode = {
  type: 'layer';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  bg?: Color;
  r?: number;
  border?: Border;
  /** Semantic container role — codegen emits <nav>/<main>/… instead of <div>. */
  role?: ContainerRole;
  children: Node[];
};

/**
 * STACK auto-positions its children. Children must omit `x` / `y` — enforced
 * by the validator (rule `stack-no-coords`), not by the type system.
 */
export type StackNode = {
  type: 'stack';
  id: string;
  x: number;
  y: number;
  direction?: Direction;
  gap?: number;
  align?: Align;
  role?: ContainerRole;
  children: Node[];
};

export type GridNode = {
  type: 'grid';
  id: string;
  x: number;
  y: number;
  w: number;
  columns: number;
  gap?: number;
  role?: ContainerRole;
  children: Node[];
};

export type StateNode = {
  type: 'state';
  targetId: string;
  state: ElementState;
  overrides: Record<string, string | number>;
};

export type RepeatNode = {
  type: 'repeat';
  id: string;
  count: number;
  direction?: Direction;
  gap?: number;
  children: Node[];
};

export type EffectNode = {
  type: 'effect';
  targetId: string;
  effect: EffectType;
  params?: Record<string, string | number>;
};

/**
 * Discriminated union of every DSL command except `SCREEN` and `TOKEN`,
 * which live in dedicated `Scene` slots. Discriminator: `type`.
 */
export type Node =
  | FillNode
  | RectNode
  | TextNode
  | IconNode
  | ImageNode
  | InputNode
  | ButtonNode
  | LayerNode
  | StackNode
  | GridNode
  | StateNode
  | RepeatNode
  | EffectNode;

// ─── Scene document ──────────────────────────────────────────────────────────

/**
 * Top-level Scene document. `screen` is required exactly once (rule #1) and
 * `tokens` is hoisted to its own slot so consumers don't re-validate at the
 * type level. `nodes` is the flat body — paint, components, layout blocks,
 * and meta (state/effect) commands all live here in source order.
 */
export type Scene = {
  screen: ScreenNode;
  tokens: TokenNode[];
  nodes: Node[];
  warnings?: ValidationWarning[];
  hints?: RenderHint[];
};
