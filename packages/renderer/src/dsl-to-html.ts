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
      const color = colorOf(p.color, '#00000022');
      return `#${id} { box-shadow: ${x}px ${y}px ${blur}px ${color} }`;
    }
    case 'blur': {
      const r = p.radius ?? 4;
      return `#${id} { filter: blur(${r}px) }`;
    }
    case 'overlay': {
      const color = colorOf(p.color, '#00000022');
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
      const parts: string[] = [];
      if (positioned) {
        parts.push(`left:${n.x}px`, `top:${n.y}px`);
      }
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.bg) parts.push(`background:${resolveColor(n.bg)}`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      if (n.border) parts.push(`border:${borderCss(n.border)}`);
      const cls = positioned ? 'pa-abs' : 'pa-flow';
      return `<div id="${escapeHtml(n.id)}" class="${cls}" style="${parts.join(';')}"></div>`;
    }
    case 'text': {
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      if (n.size !== undefined) parts.push(`font-size:${n.size}px`);
      if (n.weight) parts.push(`font-weight:${WEIGHT_MAP[n.weight]}`);
      if (n.color) parts.push(`color:${resolveColor(n.color)}`);
      if (n.maxWidth !== undefined) {
        parts.push(`width:${n.maxWidth}px`);
      }
      if (n.align) parts.push(`text-align:${n.align}`);
      const cls = positioned ? 'pa-abs' : 'pa-flow';
      return `<span id="${escapeHtml(n.id)}" class="${cls}" style="${parts.join(';')}">${escapeHtml(n.text)}</span>`;
    }
    case 'icon': {
      const size = n.size ?? 16;
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${size}px`, `height:${size}px`);
      if (n.color) parts.push(`background:${resolveColor(n.color)}`);
      const cls = positioned ? 'pa-abs pa-icon' : 'pa-flow pa-icon';
      return `<span id="${escapeHtml(n.id)}" class="${cls}" data-icon="${escapeHtml(n.name)}" style="${parts.join(';')}"></span>`;
    }
    case 'image': {
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      const fitMap: Record<string, string> = {
        cover: 'cover',
        contain: 'contain',
        fill: 'fill',
      };
      if (n.fit) parts.push(`object-fit:${fitMap[n.fit]}`);
      const cls = positioned ? 'pa-abs pa-image' : 'pa-flow pa-image';
      return `<div id="${escapeHtml(n.id)}" class="${cls}" data-src="${escapeHtml(n.src)}" style="${parts.join(';')};background:#e5e7eb"></div>`;
    }
    case 'input': {
      const inputType = n.inputType ?? 'text';
      const stateClass = n.state ? ` pa-state-${n.state}` : '';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      const placeholder = n.placeholder ? ` placeholder="${escapeHtml(n.placeholder)}"` : '';
      if (n.label) {
        const labelBox = 20;
        const inputH = Math.max(0, n.h - labelBox);
        const wrapStyle = positioned
          ? `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px`
          : `width:${n.w}px;height:${n.h}px`;
        const wrapCls = positioned ? 'pa-abs' : 'pa-flow';
        return (
          `<div class="${wrapCls}" style="${wrapStyle}">` +
          `<label style="display:block;font-size:12px;line-height:16px;margin-bottom:4px;color:#374151">${escapeHtml(n.label)}</label>` +
          `<input id="${escapeHtml(n.id)}" class="pa-input${stateClass}" type="${inputType}"${placeholder}${disabledAttr} style="display:block;width:100%;height:${inputH}px"/>` +
          `</div>`
        );
      }
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      const cls = positioned ? 'pa-abs pa-input' : 'pa-flow pa-input';
      return `<input id="${escapeHtml(n.id)}" class="${cls}${stateClass}" type="${inputType}"${placeholder}${disabledAttr} style="${parts.join(';')}"/>`;
    }
    case 'button': {
      const variant = n.variant ?? 'primary';
      const stateClass = n.state ? ` pa-state-${n.state}` : '';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${n.w}px`, `height:${n.h}px`, 'border-radius:6px');
      const cls = positioned ? 'pa-abs pa-btn' : 'pa-flow pa-btn';
      return `<button id="${escapeHtml(n.id)}" class="${cls} pa-btn-${variant}${stateClass}"${disabledAttr} style="${parts.join(';')}">${escapeHtml(n.label)}</button>`;
    }
    case 'layer': {
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${n.w}px`, `height:${n.h}px`);
      if (n.bg) parts.push(`background:${resolveColor(n.bg)}`);
      if (n.r !== undefined) parts.push(`border-radius:${n.r}px`);
      if (n.border) parts.push(`border:${borderCss(n.border)}`);
      const inner = n.children.map((c) => renderNode(c, true)).join('');
      const cls = positioned ? 'pa-abs' : 'pa-flow';
      return `<div id="${escapeHtml(n.id)}" class="${cls}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'stack': {
      const direction = n.direction ?? 'row';
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`flex-direction:${direction}`);
      if (n.gap !== undefined) parts.push(`gap:${n.gap}px`);
      if (n.align) parts.push(`align-items:${ALIGN_FLEX[n.align]}`);
      const inner = n.children.map((c) => renderNode(c, false)).join('');
      const cls = positioned ? 'pa-abs pa-stack' : 'pa-flow pa-stack';
      return `<div id="${escapeHtml(n.id)}" class="${cls}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'grid': {
      const parts: string[] = [];
      if (positioned) parts.push(`left:${n.x}px`, `top:${n.y}px`);
      parts.push(`width:${n.w}px`, `grid-template-columns:repeat(${n.columns},1fr)`);
      if (n.gap !== undefined) parts.push(`gap:${n.gap}px`);
      const inner = n.children.map((c) => renderNode(c, false)).join('');
      const cls = positioned ? 'pa-abs pa-grid' : 'pa-flow pa-grid';
      return `<div id="${escapeHtml(n.id)}" class="${cls}" style="${parts.join(';')}">${inner}</div>`;
    }
    case 'repeat': {
      const inner = n.children.map((c) => renderNode(c, false)).join('');
      const count = Math.max(1, n.count);
      const stripped = inner.replace(/\sid="[^"]*"/g, '');
      const body = count === 1 ? inner : inner + stripped.repeat(count - 1);
      return `<div id="${escapeHtml(n.id)}" class="pa-flow">${body}</div>`;
    }
  }
};

const baseCss = `
*,*::before,*::after { box-sizing: border-box; }
html,body { margin:0; padding:0; background:#fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111; }
.pa-screen { position: relative; overflow: hidden; }
.pa-abs    { position: absolute; }
.pa-flow   { position: relative; }
.pa-stack  { display: flex; }
.pa-grid   { display: grid; }
.pa-btn    { border: 0; cursor: pointer; font-size: 14px; font-weight: 500; }
.pa-btn-primary    { background: var(--primary, #185FA5); color: #fff; }
.pa-btn-secondary  { background: #e5e7eb; color: #111; }
.pa-btn-ghost      { background: transparent; color: #111; }
.pa-btn-destructive{ background: #dc2626; color: #fff; }
.pa-input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0 12px; font-size: 14px; outline: none; background: #fff; color: #111; }
.pa-input:focus { border-color: var(--primary, #185FA5); }
.pa-icon  { display: inline-block; mask-image: var(--icon, none); }
`.trim();

export const dslToHtml = (scene: Scene): string => {
  const tokenDecls = scene.tokens
    .map((t) => `  --${t.id}: ${t.value};`)
    .join('\n');

  const metaRules: string[] = [];
  collectMetaCss(scene.nodes, metaRules);

  const body = scene.nodes.map((n) => renderNode(n, true)).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
:root {
${tokenDecls}
}
${baseCss}
${metaRules.join('\n')}
</style>
</head>
<body>
<div class="pa-screen" style="width:${scene.screen.w}px;height:${scene.screen.h}px">${body}</div>
</body>
</html>`;
};
