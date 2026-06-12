import type {
  ButtonVariant,
  Color,
  Node,
  Scene,
} from '@pixelagent/dsl-spec';

const WEIGHT_CLASS: Record<string, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const ALIGN_TEXT_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const STACK_ALIGN_CLASS: Record<string, string> = {
  left: 'items-start',
  center: 'items-center',
  right: 'items-end',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'bg-gray-200 text-black',
  // ghost inherits the theme foreground — resolved per-theme in emitNode.
  ghost: 'bg-transparent',
  destructive: 'bg-red-600 text-white',
};

// theme:dark canvas classes. Mirror the renderer's THEME_DARK_CSS
// (#111827 / #E5E7EB) — preview and synthesized code must agree.
const SCREEN_DARK_CLASS = 'bg-[#111827] text-[#E5E7EB]';
const GHOST_TEXT: Record<'light' | 'dark', string> = {
  light: 'text-black',
  dark: 'text-[#E5E7EB]',
};

const FIT_CLASS: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
};

const BUTTON_BASE = 'border-0 cursor-pointer text-sm font-medium';
const INPUT_BASE =
  'block border border-gray-300 rounded-lg px-3 text-sm bg-white text-black outline-none';
const LABEL_BASE = 'block text-xs leading-4 mb-1 text-gray-700';
const PRIMARY_DEFAULT = '#185FA5';
const INPUT_LABEL_BLOCK_PX = 20;
const ICON_DEFAULT_SIZE_PX = 16;
const BUTTON_RADIUS_PX = 6;
const IMAGE_PLACEHOLDER_BG = '#e5e7eb';

const px = (n: number): string => `[${n}px]`;

const join = (parts: ReadonlyArray<string>): string =>
  parts.filter((p) => p.length > 0).join(' ');

const posCls = (positioned: boolean, extra: string): string =>
  join([positioned ? 'absolute' : 'relative', extra]);

const positionParts = (
  n: { x: number; y: number },
  positioned: boolean,
): string[] => (positioned ? [`left-${px(n.x)}`, `top-${px(n.y)}`] : []);

const escapeJsxText = (s: string): string => {
  const html = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return html.replace(/[{}]/g, (m) => `{'${m}'}`);
};

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Ids follow the DSL identifier grammar — safe to single-quote verbatim.
const quoteId = (id: string): string => `'${id}'`;

const wrapHref = (el: string, href?: string): string =>
  href ? `<a href="${escapeAttr(href)}">${el}</a>` : el;

type Ctx = {
  resolveColor: (c: Color) => string;
  buttonHover: Map<string, string>;
  primary: string;
  theme: 'light' | 'dark';
};

const emitNode = (n: Node, positioned: boolean, ctx: Ctx): string => {
  switch (n.type) {
    case 'state':
    case 'effect':
      return '';
    case 'fill': {
      const cls = join([
        'absolute',
        `left-${px(n.x)}`,
        `top-${px(n.y)}`,
        `w-${px(n.w)}`,
        `h-${px(n.h)}`,
        `bg-[${ctx.resolveColor(n.color)}]`,
      ]);
      return `<div className="${cls}" />`;
    }
    case 'rect': {
      const parts: string[] = [
        ...positionParts(n, positioned),
        `w-${px(n.w)}`,
        `h-${px(n.h)}`,
      ];
      if (n.bg) parts.push(`bg-[${ctx.resolveColor(n.bg)}]`);
      if (n.r !== undefined) parts.push(`rounded-${px(n.r)}`);
      if (n.border) {
        parts.push(
          `border-[${n.border.width}px]`,
          'border-solid',
          `border-[${ctx.resolveColor(n.border.color)}]`,
        );
      }
      return `<div id="${escapeAttr(n.id)}" className="${posCls(
        positioned,
        parts.join(' '),
      )}" />`;
    }
    case 'text': {
      const parts: string[] = [...positionParts(n, positioned)];
      if (n.size !== undefined) parts.push(`text-${px(n.size)}`);
      if (n.weight) parts.push(WEIGHT_CLASS[n.weight]);
      if (n.color) parts.push(`text-[${ctx.resolveColor(n.color)}]`);
      if (n.maxWidth !== undefined) parts.push(`w-${px(n.maxWidth)}`);
      if (n.align) parts.push(ALIGN_TEXT_CLASS[n.align]);
      const cls = posCls(positioned, parts.join(' '));
      // Semantic level relies on Tailwind preflight zeroing h1–h6 defaults,
      // so the explicit size/weight classes stay the only visual source.
      const tag = n.level ?? 'span';
      const el = `<${tag} id="${escapeAttr(n.id)}" className="${cls}">{text[${quoteId(
        n.id,
      )}] ?? ${JSON.stringify(n.text)}}</${tag}>`;
      return wrapHref(el, n.href);
    }
    case 'icon': {
      const size = n.size ?? ICON_DEFAULT_SIZE_PX;
      const parts: string[] = [
        ...positionParts(n, positioned),
        'inline-block',
        `w-${px(size)}`,
        `h-${px(size)}`,
      ];
      if (n.color) parts.push(`bg-[${ctx.resolveColor(n.color)}]`);
      const cls = posCls(positioned, parts.join(' '));
      return `<span id="${escapeAttr(n.id)}" className="${cls}" data-icon="${escapeAttr(
        n.name,
      )}" />`;
    }
    case 'image': {
      const parts: string[] = [
        ...positionParts(n, positioned),
        `w-${px(n.w)}`,
        `h-${px(n.h)}`,
      ];
      if (n.r !== undefined) parts.push(`rounded-${px(n.r)}`);
      if (n.fit) parts.push(FIT_CLASS[n.fit]);
      if (!n.src) {
        const cls = posCls(
          positioned,
          [...parts, `bg-[${IMAGE_PLACEHOLDER_BG}]`].join(' '),
        );
        return `<div id="${escapeAttr(n.id)}" className="${cls}" />`;
      }
      const cls = posCls(positioned, parts.join(' '));
      const el = `<img id="${escapeAttr(n.id)}" className="${cls}" src="${escapeAttr(
        n.src,
      )}" alt="${escapeAttr(n.alt ?? '')}" />`;
      return wrapHref(el, n.href);
    }
    case 'input': {
      const inputType = n.inputType ?? 'text';
      const placeholderAttr = n.placeholder
        ? ` placeholder="${escapeAttr(n.placeholder)}"`
        : '';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      if (n.label) {
        const wrapCls = posCls(
          positioned,
          [...positionParts(n, positioned), `w-${px(n.w)}`, `h-${px(n.h)}`].join(
            ' ',
          ),
        );
        const inputH = Math.max(0, n.h - INPUT_LABEL_BLOCK_PX);
        return (
          `<div className="${wrapCls}">` +
          `<label className="${LABEL_BASE}">${escapeJsxText(n.label)}</label>` +
          `<input id="${escapeAttr(n.id)}" type="${inputType}"` +
          `${placeholderAttr}${disabledAttr} className="${INPUT_BASE} w-full h-${px(
            inputH,
          )}" />` +
          `</div>`
        );
      }
      const cls = posCls(
        positioned,
        [
          ...positionParts(n, positioned),
          `w-${px(n.w)}`,
          `h-${px(n.h)}`,
          INPUT_BASE,
        ].join(' '),
      );
      return `<input id="${escapeAttr(n.id)}" type="${inputType}"${placeholderAttr}${disabledAttr} className="${cls}" />`;
    }
    case 'button': {
      const variant = n.variant ?? 'primary';
      const disabledAttr = n.state === 'disabled' ? ' disabled' : '';
      const variantCls =
        variant === 'primary'
          ? `bg-[${ctx.primary}] text-white`
          : variant === 'ghost'
            ? `${VARIANT_CLASS.ghost} ${GHOST_TEXT[ctx.theme]}`
            : VARIANT_CLASS[variant];
      const hover = ctx.buttonHover.get(n.id);
      const hoverCls = hover ? `hover:bg-[${hover}]` : '';
      const cls = posCls(
        positioned,
        [
          ...positionParts(n, positioned),
          `w-${px(n.w)}`,
          `h-${px(n.h)}`,
          `rounded-${px(BUTTON_RADIUS_PX)}`,
          BUTTON_BASE,
          variantCls,
          hoverCls,
        ].join(' '),
      );
      const el = `<button id="${escapeAttr(n.id)}" type="button"${disabledAttr} onClick={on[${quoteId(
        n.id,
      )}]} className="${cls}">{text[${quoteId(n.id)}] ?? ${JSON.stringify(
        n.label,
      )}}</button>`;
      return wrapHref(el, n.href);
    }
    case 'layer': {
      const parts: string[] = [
        ...positionParts(n, positioned),
        `w-${px(n.w)}`,
        `h-${px(n.h)}`,
      ];
      if (n.bg) parts.push(`bg-[${ctx.resolveColor(n.bg)}]`);
      if (n.r !== undefined) parts.push(`rounded-${px(n.r)}`);
      if (n.border) {
        parts.push(
          `border-[${n.border.width}px]`,
          'border-solid',
          `border-[${ctx.resolveColor(n.border.color)}]`,
        );
      }
      const inner = n.children.map((c) => emitNode(c, true, ctx)).join('');
      const tag = n.role ?? 'div';
      return `<${tag} id="${escapeAttr(n.id)}" className="${posCls(
        positioned,
        parts.join(' '),
      )}">${inner}</${tag}>`;
    }
    case 'stack': {
      const direction = n.direction ?? 'row';
      const parts: string[] = [
        ...positionParts(n, positioned),
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
      ];
      if (n.gap !== undefined) parts.push(`gap-${px(n.gap)}`);
      if (n.align) parts.push(STACK_ALIGN_CLASS[n.align]);
      const inner = n.children.map((c) => emitNode(c, false, ctx)).join('');
      const tag = n.role ?? 'div';
      return `<${tag} id="${escapeAttr(n.id)}" className="${posCls(
        positioned,
        parts.join(' '),
      )}">${inner}</${tag}>`;
    }
    case 'grid': {
      const parts: string[] = [
        ...positionParts(n, positioned),
        'grid',
        `w-${px(n.w)}`,
        `grid-cols-[repeat(${n.columns},minmax(0,1fr))]`,
      ];
      if (n.gap !== undefined) parts.push(`gap-${px(n.gap)}`);
      const inner = n.children.map((c) => emitNode(c, false, ctx)).join('');
      const tag = n.role ?? 'div';
      return `<${tag} id="${escapeAttr(n.id)}" className="${posCls(
        positioned,
        parts.join(' '),
      )}">${inner}</${tag}>`;
    }
    case 'repeat': {
      const count = Math.max(1, n.count);
      const direction = n.direction ?? 'column';
      const parts: string[] = [
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
      ];
      if (n.gap !== undefined) parts.push(`gap-${px(n.gap)}`);
      const items: string[] = [];
      for (let i = 0; i < count; i++) {
        for (const c of n.children) items.push(emitNode(c, false, ctx));
      }
      return `<div id="${escapeAttr(n.id)}" className="relative ${parts.join(
        ' ',
      )}">${items.join('')}</div>`;
    }
  }
};

export type ToReactOptions = {
  /** sha256 of the source DSL — embedded in the generated header for drift checks. */
  dslSha256?: string;
};

export const toReact = (scene: Scene, options: ToReactOptions = {}): string => {
  const tokens = new Map(scene.tokens.map((t) => [t.id, t.value]));
  const resolveColor = (c: Color): string =>
    c.startsWith('$') ? tokens.get(c.slice(1)) ?? c : c;

  const buttonHover = new Map<string, string>();
  for (const n of scene.nodes) {
    if (n.type === 'state' && n.state === 'hover') {
      const bg = n.overrides['bg'];
      if (typeof bg === 'string') buttonHover.set(n.targetId, resolveColor(bg));
    }
  }

  const primary = tokens.get('primary') ?? PRIMARY_DEFAULT;
  const theme = scene.screen.theme ?? 'light';
  const ctx: Ctx = { resolveColor, buttonHover, primary, theme };

  const body = scene.nodes.map((n) => emitNode(n, true, ctx)).join('');
  const screenCls = `relative overflow-hidden w-${px(
    scene.screen.w,
  )} h-${px(scene.screen.h)}${theme === 'dark' ? ` ${SCREEN_DARK_CLASS}` : ''}`;

  return [
    `// GENERATED by PixelAgent -- dsl-sha256:${options.dslSha256 ?? 'unverified'} -- do not edit; edit the DSL and regenerate.`,
    ``,
    `export type GeneratedScreenProps = {`,
    `  /** Override TEXT/BUTTON content by element id. Defaults come from the DSL. */`,
    `  text?: Partial<Record<string, string>>;`,
    `  /** Click handlers by element id (BUTTON elements). */`,
    `  on?: Partial<Record<string, () => void>>;`,
    `};`,
    ``,
    `export default function GeneratedScreen({ text = {}, on = {} }: GeneratedScreenProps) {`,
    `  return (`,
    `    <div className="${screenCls}">${body}</div>`,
    `  );`,
    `}`,
    ``,
  ].join('\n');
};
