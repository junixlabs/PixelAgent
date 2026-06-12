import type {
  Border,
  Node,
  Scene,
  ScreenNode,
  TokenNode,
} from '@pixelagent/dsl-spec';

const quote = (s: string): string => `"${s.replace(/"/g, '\\"')}"`;

const borderStr = (b: Border): string => `${b.width} ${b.color}`;

const kvParts = (entries: Array<[string, string | number | undefined]>): string[] =>
  entries
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}:${v}`);

const screenLine = (s: ScreenNode): string => {
  const parts = [`SCREEN`, String(s.w), String(s.h)];
  if (s.theme) parts.push(`theme:${s.theme}`);
  return parts.join(' ');
};

const tokenLine = (t: TokenNode): string => `TOKEN ${t.id} ${t.value}`;

const indent = (depth: number): string => '  '.repeat(depth);

const nodeLines = (n: Node, depth: number): string[] => {
  const pad = indent(depth);
  switch (n.type) {
    case 'fill':
      return [`${pad}FILL ${n.x} ${n.y} ${n.w} ${n.h} ${n.color}`];
    case 'rect': {
      const head = `${pad}RECT ${n.id} ${n.x} ${n.y} ${n.w} ${n.h}`;
      const kv = kvParts([
        ['bg', n.bg],
        ['r', n.r],
        ['border', n.border ? borderStr(n.border) : undefined],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'text': {
      const head = `${pad}TEXT ${n.id} ${n.x} ${n.y} ${quote(n.text)}`;
      const kv = kvParts([
        ['size', n.size],
        ['weight', n.weight],
        ['color', n.color],
        ['align', n.align],
        ['max-width', n.maxWidth],
        ['goto', n.goto],
        ['level', n.level],
        ['href', n.href !== undefined ? quote(n.href) : undefined],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'icon': {
      const head = `${pad}ICON ${n.id} ${n.x} ${n.y} ${quote(n.name)}`;
      const kv = kvParts([
        ['size', n.size],
        ['color', n.color],
        ['goto', n.goto],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'image': {
      const head = `${pad}IMAGE ${n.id} ${n.x} ${n.y} ${n.w} ${n.h} ${quote(n.src)}`;
      const kv = kvParts([
        ['fit', n.fit],
        ['r', n.r],
        ['goto', n.goto],
        ['alt', n.alt !== undefined ? quote(n.alt) : undefined],
        ['href', n.href !== undefined ? quote(n.href) : undefined],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'input': {
      const head = `${pad}INPUT ${n.id} ${n.x} ${n.y} ${n.w} ${n.h}`;
      const kv = kvParts([
        ['type', n.inputType],
        ['placeholder', n.placeholder !== undefined ? quote(n.placeholder) : undefined],
        ['label', n.label !== undefined ? quote(n.label) : undefined],
        ['state', n.state],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'button': {
      const head = `${pad}BUTTON ${n.id} ${n.x} ${n.y} ${n.w} ${n.h} ${quote(n.label)}`;
      const kv = kvParts([
        ['variant', n.variant],
        ['state', n.state],
        ['goto', n.goto],
        ['href', n.href !== undefined ? quote(n.href) : undefined],
      ]);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
    case 'layer': {
      const head = `${pad}LAYER ${n.id} ${n.x} ${n.y} ${n.w} ${n.h}`;
      const kv = kvParts([
        ['bg', n.bg],
        ['r', n.r],
        ['border', n.border ? borderStr(n.border) : undefined],
        ['role', n.role],
      ]);
      const open = kv.length ? `${head} ${kv.join(' ')}` : head;
      const inner = n.children.flatMap((c) => nodeLines(c, depth + 1));
      return [open, ...inner, `${pad}END`];
    }
    case 'stack': {
      const head = `${pad}STACK ${n.id} ${n.x} ${n.y}`;
      const kv = kvParts([
        ['direction', n.direction],
        ['gap', n.gap],
        ['align', n.align],
        ['role', n.role],
      ]);
      const open = kv.length ? `${head} ${kv.join(' ')}` : head;
      const inner = n.children.flatMap((c) => nodeLines(c, depth + 1));
      return [open, ...inner, `${pad}END`];
    }
    case 'grid': {
      const head = `${pad}GRID ${n.id} ${n.x} ${n.y} ${n.w}`;
      const kv = kvParts([
        ['columns', n.columns],
        ['gap', n.gap],
        ['role', n.role],
      ]);
      const open = kv.length ? `${head} ${kv.join(' ')}` : head;
      const inner = n.children.flatMap((c) => nodeLines(c, depth + 1));
      return [open, ...inner, `${pad}END`];
    }
    case 'repeat': {
      const head = `${pad}REPEAT ${n.id} ${n.count}`;
      const kv = kvParts([
        ['direction', n.direction],
        ['gap', n.gap],
      ]);
      const open = kv.length ? `${head} ${kv.join(' ')}` : head;
      const inner = n.children.flatMap((c) => nodeLines(c, depth + 1));
      return [open, ...inner, `${pad}END`];
    }
    case 'state': {
      const open = `${pad}STATE ${n.targetId} ${n.state}`;
      const body = Object.entries(n.overrides).map(
        ([k, v]) => `${indent(depth + 1)}${k}: ${v}`,
      );
      return [open, ...body, `${pad}END`];
    }
    case 'effect': {
      const head = `${pad}EFFECT ${n.targetId} ${n.effect}`;
      const params = n.params ?? {};
      const kv = Object.entries(params).map(([k, v]) => `${k}:${v}`);
      return [kv.length ? `${head} ${kv.join(' ')}` : head];
    }
  }
};

/**
 * Serialize a Scene back to DSL source. Best-effort: this drops original
 * comments, blank lines, and attribute order — the AST has no source-text
 * fidelity. `parse(serialize(parse(s)))` is structurally equal to
 * `parse(s)`, but `serialize(parse(s)) !== s` in general.
 */
export const serialize = (scene: Scene): string => {
  const lines: string[] = [];
  lines.push(screenLine(scene.screen));
  if (scene.tokens.length > 0) lines.push('');
  for (const t of scene.tokens) lines.push(tokenLine(t));
  if (scene.nodes.length > 0) lines.push('');
  for (const n of scene.nodes) {
    lines.push(...nodeLines(n, 0));
  }
  return lines.join('\n') + '\n';
};
