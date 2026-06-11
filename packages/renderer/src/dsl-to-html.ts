import type {
  Scene,
  Node,
  StateNode,
  EffectNode,
  ElementState,
  Color,
  Border,
} from '@pixelagent/dsl-spec';

const WEIGHT_MAP: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const ALIGN_FLEX: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

// Layout & component defaults — keep here so changes don't require diffing
// the whole renderer. The renderer is intentionally token-aware (CSS vars
// for $primary etc.); these constants govern unstyled defaults the DSL
// doesn't (yet) expose.
const INPUT_LABEL_BLOCK_PX = 20;
const INPUT_LABEL_FONT_PX = 12;
const INPUT_LABEL_LINE_PX = 16;
const INPUT_LABEL_GAP_PX = 4;
const INPUT_LABEL_COLOR = '#374151';
const ICON_DEFAULT_SIZE_PX = 16;
const BUTTON_RADIUS_PX = 6;
const IMAGE_PLACEHOLDER_BG = '#e5e7eb';
const EFFECT_DEFAULT_SHADOW_COLOR = '#00000022';
const EFFECT_DEFAULT_BLUR_RADIUS = 4;

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveColor = (c: Color): string =>
  c.startsWith('$') ? `var(--${c.slice(1)})` : c;

const borderCss = (b: Border): string =>
  `${b.width}px solid ${resolveColor(b.color)}`;

const overrideCss = (key: string, value: string | number): string | null => {
  if (typeof value === 'string') {
    switch (key) {
      case 'bg':
        return `background: ${resolveColor(value)}`;
      case 'color':
        return `color: ${resolveColor(value)}`;
      default:
        return null;
    }
  }
  switch (key) {
    case 'r':
      return `border-radius: ${value}px`;
    case 'size':
      return `font-size: ${value}px`;
    case 'bg':
      return `background: ${value}`;
    case 'color':
      return `color: ${value}`;
    default:
      return null;
  }
};

const positionParts = (
  n: { x: number; y: number },
  positioned: boolean,
): string[] => (positioned ? [`left:${n.x}px`, `top:${n.y}px`] : []);

/**
 * Deep-clone a node subtree with `suffix` appended to every `id` and `targetId`.
 * Used to materialize REPEAT iterations as distinct DOM elements without
 * id collisions, while preserving the relative STATE/EFFECT wiring.
 */
const suffixIds = (n: Node, suffix: string): Node => {
  const clone = structuredClone(n) as Node;
  const visit = (x: Node): void => {
    const obj = x as unknown as { id?: unknown; targetId?: unknown; children?: unknown };
    if (typeof obj.id === 'string') obj.id = `${obj.id}${suffix}`;
    if (typeof obj.targetId === 'string') obj.targetId = `${obj.targetId}${suffix}`;
    if (Array.isArray(obj.children)) {
      for (const c of obj.children as Node[]) visit(c);
    }
  };
  visit(clone);
  return clone;
};

const posCls = (positioned: boolean, extra?: string): string => {
  const base = positioned ? 'pa-abs' : 'pa-flow';
  return extra ? `${base} ${extra}` : base;
};

const stateSelector = (id: string, state: ElementState): string => {
  switch (state) {
    case 'default':
      return `#${id}`;
    case 'disabled':
      return `#${id}[disabled]`;
    case 'hover':
      return `#${id}:hover`;
    case 'focus':
      return `#${id}:focus`;
    case 'active':
      return `#${id}:active`;
  }
};

const emitStateCss = (n: StateNode): string => {
  const decls: string[] = [];
  for (const [k, v] of Object.entries(n.overrides)) {
    const d = overrideCss(k, v);
    if (d) decls.push(d);
  }
  if (decls.length === 0) return '';
  const body = decls.join('; ');
  const main = `${stateSelector(n.targetId, n.state)} { ${body} }`;
  const forced = `#${n.targetId}.pa-state-${n.state} { ${body} }`;
  return `${main}\n${forced}`;
};

const emitEffectCss = (n: EffectNode): string => {
  const p = n.params ?? {};
  const id = n.targetId;
  const colorOf = (v: string | number | undefined, fallback: string): string => {
    if (v === undefined) return fallback;
    return typeof v === 'string' ? resolveColor(v) : String(v);
  };
  switch (n.effect) {
    case 'shadow': {
      const x = p.x ?? 0;
      const y = p.y ?? 0;
      const blur = p.blur ?? 0;
      const color = colorOf(p.color, EFFECT_DEFAULT_SHADOW_COLOR);
      return `#${id} { box-shadow: ${x}px ${y}px ${blur}px ${color} }`;
    }
    case 'blur': {
      const r = p.radius ?? EFFECT_DEFAULT_BLUR_RADIUS;
      return `#${id} { filter: blur(${r}px) }`;
    }
    case 'overlay': {
      const color = colorOf(p.color, EFFECT_DEFAULT_SHADOW_COLOR);
      return `#${id} { position: relative }\n#${id}::after { content:''; position:absolute; inset:0; background:${color} }`;
    }
  }
};

const collectMetaCss = (nodes: Node[], out: string[]): void => {
  for (const n of nodes) {
    if (n.type === 'state') {
      const r = emitStateCss(n);
      if (r) out.push(r);
    } else if (n.type === 'effect') {
      out.push(emitEffectCss(n));
    }
  }
};

const renderNode = (n: Node, positioned: boolean): string => {
  switch (n.type) {
    case 'state':
    case 'effect':
      return '';
    case 'fill': {
      const style = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;background:${resolveColor(n.color)}`;
      return `<div class="pa-abs" style="${style}"></div>`;
    }
    case 'rect': {
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.bg) parts.push(`background:${resolveColor(n.bg)}`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      if (n.border) parts.push(`border:${borderCss(n.border)}`);
      return `<div id="${escapeHtml(n.id)}" class="${posCls(positioned)}" style="${parts.join(';')}"></div>`;
    }
    case 'text': {
      const parts = positionParts(n, positioned);
      if (n.size !== undefined) parts.push(`font-size:${n.size}px`);
      if (n.weight) parts.push(`font-weight:${WEIGHT_MAP[n.weight]}`);
      if (n.color) parts.push(`color:${resolveColor(n.color)}`);
      if (n.maxWidth !== undefined) parts.push(`width:${n.maxWidth}px`);
      else if (n.align === 'center' || n.align === 'right') parts.push('width:100%');
      if (n.align) parts.push(`text-align:${n.align}`);
      return `<span id="${escapeHtml(n.id)}" class="${posCls(positioned)}" style="${parts.join(';')}">${escapeHtml(n.text)}</span>`;
    }
    case 'icon': {
      const size = n.size ?? ICON_DEFAULT_SIZE_PX;
      const parts = positionParts(n, positioned);
      parts.push(`width:${size}px`, `height:${size}px`);
      if (n.color) parts.push(`background:${resolveColor(n.color)}`);
      return `<span id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-icon')}" data-icon="${escapeHtml(n.name)}" style="${parts.join(';')}"></span>`;
    }
    case 'image': {
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      const fitMap: Record<string, string> = {
        cover: 'cover',
        contain: 'contain',
        fill: 'fill',
      };
      if (n.fit) parts.push(`object-fit:${fitMap[n.fit]}`);
      if (n.src) {
        return `<img id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-image')}" src="${escapeHtml(n.src)}" style="${parts.join(';')}"/>`;
      }
      return `<div id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-image')}" style="${parts.join(';')};background:${IMAGE_PLACEHOLDER_BG}"></div>`;
    }
    case 'input': {
      const inputType = n.inputType ?? 'text';
      const stateClass = n.state ? ` pa-state-${n.state}` : '';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      const placeholder = n.placeholder ? ` placeholder="${escapeHtml(n.placeholder)}"` : '';
      if (n.label) {
        const inputH = Math.max(0, n.h - INPUT_LABEL_BLOCK_PX);
        const wrapParts = positionParts(n, positioned);
        wrapParts.push(`width:${n.w}px`, `height:${n.h}px`);
        const labelStyle =
          `display:block;font-size:${INPUT_LABEL_FONT_PX}px;` +
          `line-height:${INPUT_LABEL_LINE_PX}px;` +
          `margin-bottom:${INPUT_LABEL_GAP_PX}px;color:${INPUT_LABEL_COLOR}`;
        return (
          `<div class="${posCls(positioned)}" style="${wrapParts.join(';')}">` +
          `<label style="${labelStyle}">${escapeHtml(n.label)}</label>` +
          `<input id="${escapeHtml(n.id)}" class="pa-input${stateClass}" type="${inputType}"${placeholder}${disabledAttr} style="display:block;width:100%;height:${inputH}px"/>` +
          `</div>`
        );
      }
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      return `<input id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-input')}${stateClass}" type="${inputType}"${placeholder}${disabledAttr} style="${parts.join(';')}"/>`;
    }
    case 'button': {
      const variant = n.variant ?? 'primary';
      const stateClass = n.state ? ` pa-state-${n.state}` : '';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `height:${n.h}px`, `border-radius:${BUTTON_RADIUS_PX}px`);
      return `<button id="${escapeHtml(n.id)}" class="${posCls(positioned, `pa-btn pa-btn-${variant}${stateClass}`)}"${disabledAttr} style="${parts.join(';')}">${escapeHtml(n.label)}</button>`;
    }
    case 'layer': {
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.bg) parts.push(`background:${resolveColor(n.bg)}`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      if (n.border) parts.push(`border:${borderCss(n.border)}`);
      const inner = n.children.map((c) => renderNode(c, true)).join('');
      return `<div id="${escapeHtml(n.id)}" class="${posCls(positioned)}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'stack': {
      const direction = n.direction ?? 'row';
      const parts = positionParts(n, positioned);
      parts.push(`flex-direction:${direction}`);
      if (n.gap !== undefined) parts.push(`gap:${n.gap}px`);
      if (n.align) parts.push(`align-items:${ALIGN_FLEX[n.align]}`);
      const inner = n.children.map((c) => renderNode(c, false)).join('');
      return `<div id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-stack')}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'grid': {
      const parts = positionParts(n, positioned);
      parts.push(`width:${n.w}px`, `grid-template-columns:repeat(${n.columns},1fr)`);
      if (n.gap !== undefined) parts.push(`gap:${n.gap}px`);
      const inner = n.children.map((c) => renderNode(c, false)).join('');
      return `<div id="${escapeHtml(n.id)}" class="${posCls(positioned, 'pa-grid')}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'repeat': {
      const count = Math.max(1, n.count);
      const direction = n.direction ?? 'column';
      const styleParts = [`flex-direction:${direction}`];
      if (n.gap !== undefined) styleParts.push(`gap:${n.gap}px`);
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        const subtree = i === 0 ? n.children : n.children.map((c) => suffixIds(c, `-${i}`));
        for (const c of subtree) out.push(renderNode(c, false));
      }
      return `<div id="${escapeHtml(n.id)}" class="pa-flow pa-stack" style="${styleParts.join(';')}">${out.join('')}</div>`;
    }
  }
};

// Click-to-inspect overlay for interactive HTML previews. Injected only when
// `inspector` is requested — never on the PNG path, so screenshots stay
// byte-stable. Click = reveal element id; Esc = clear. Nothing else.
const INSPECTOR_MARKUP = `<div id="pa-inspector" style="display:none;position:fixed;right:12px;bottom:12px;z-index:99999;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:#111827;color:#e5e7eb;padding:8px 12px;border-radius:6px;box-shadow:0 4px 12px #0006;pointer-events:none"></div>
<script>
(function () {
  var badge = document.getElementById('pa-inspector');
  var current = null;
  var clear = function () {
    if (current) current.style.outline = '';
    current = null;
    badge.style.display = 'none';
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[id]') : null;
    if (!el) { clear(); return; }
    if (current) current.style.outline = '';
    current = el;
    el.style.outline = '2px solid #4F8EF7';
    badge.textContent = el.id;
    badge.style.display = 'block';
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') clear();
  });
})();
</script>`;

const baseCss = `
*,*::before,*::after { box-sizing: border-box; }
html,body { margin:0; padding:0; background:#fff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111; }
.pa-screen { position: relative; overflow: hidden; }
.pa-abs    { position: absolute; }
.pa-flow   { position: relative; }
.pa-stack  { display: flex; }
.pa-grid   { display: grid; }
.pa-btn    { border: 0; cursor: pointer; font-size: 14px; font-weight: 500; }
.pa-btn-primary    { background: var(--primary, #185FA5); color: #fff; }
.pa-btn-secondary  { background: #e5e7eb; color: #111; }
.pa-btn-ghost      { background: transparent; color: inherit; }
.pa-btn-destructive{ background: #dc2626; color: #fff; }
.pa-input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0 12px; font-size: 14px; outline: none; background: #fff; color: #111; }
.pa-input:focus { border-color: var(--primary, #185FA5); }
.pa-icon  { display: inline-block; mask-image: var(--icon, none); }
`.trim();

// theme:dark canvas defaults. Scoped to .pa-screen (not body) so the themed
// region is exactly the screenshot clip. Values mirror codegen's Tailwind
// classes (gray-900 / gray-200) — renderer and synthesized code must agree.
const THEME_DARK_CSS = `.pa-screen { background:#111827; color:#E5E7EB; }`;

export type DslToHtmlOptions = {
  /** Inject the click-to-inspect overlay. Interactive-preview only. */
  inspector?: boolean;
};

export const dslToHtml = (
  scene: Scene,
  options: DslToHtmlOptions = {},
): string => {
  const tokenDecls = scene.tokens
    .map((t) => `  --${t.id}: ${t.value};`)
    .join('\n');

  const metaRules: string[] = [];
  collectMetaCss(scene.nodes, metaRules);

  const body = scene.nodes.map((n) => renderNode(n, true)).join('');
  const inspector = options.inspector ? `\n${INSPECTOR_MARKUP}` : '';
  const themeCss = scene.screen.theme === 'dark' ? `\n${THEME_DARK_CSS}` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
${tokenDecls}
}
${baseCss}${themeCss}
${metaRules.join('\n')}
</style>
</head>
<body>
<div class="pa-screen" style="width:${scene.screen.w}px;height:${scene.screen.h}px">${body}</div>${inspector}
</body>
</html>`;
};
