import type {
  Scene,
  Node,
  ButtonNode,
  InputNode,
  StackNode,
  RepeatNode,
  TextNode,
  TokenNode,
  ValidationWarning,
} from '@pixelagent/dsl-spec';
import { getNodeLine } from './parser.js';
import { walkNodes } from './helpers.js';

// rule no-op stubs (documented):
//   - rect-no-children: structurally impossible — RectNode has no children field.
//   - block-end-required: enforced at parse time.
//   - border-inline-only: enforced at parse time (rejects EFFECT … border).
//   - fill-no-id: enforced at parse time (parseFill).

const MIN_CONTRAST_RATIO = 3.0;

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (m3) {
    return [
      parseInt(m3[1] + m3[1], 16),
      parseInt(m3[2] + m3[2], 16),
      parseInt(m3[3] + m3[3], 16),
    ];
  }
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m6) {
    return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)];
  }
  return null;
};

// WCAG 2.x relative luminance + contrast ratio.
const luminance = ([r, g, b]: [number, number, number]): number => {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrastRatio = (
  a: [number, number, number],
  b: [number, number, number],
): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

export function validate(scene: Scene): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // id-uniqueness — collect from tokens and every node with an id.
  const seen = new Map<string, number | undefined>();
  const checkId = (id: string, line: number | undefined) => {
    if (!id) return;
    if (seen.has(id)) {
      const first = seen.get(id);
      warnings.push({
        rule: 'id-uniqueness',
        message:
          first !== undefined
            ? `duplicate id '${id}' (first defined at line ${first})`
            : `duplicate id '${id}'`,
        severity: 'error',
        nodeId: id,
        line,
      });
    } else {
      seen.set(id, line);
    }
  };

  for (const t of scene.tokens as TokenNode[]) {
    checkId(t.id, getNodeLine(t));
  }

  walkNodes(scene.nodes, (node) => {
    if ('id' in node) {
      checkId((node as { id: string }).id, getNodeLine(node));
    }

    if (node.type === 'stack' || node.type === 'repeat') {
      const c = (node as StackNode | RepeatNode).children;
      for (const child of c) {
        if (
          'x' in child &&
          'y' in child &&
          ((child as { x: number }).x !== 0 ||
            (child as { y: number }).y !== 0)
        ) {
          warnings.push({
            rule: 'stack-no-coords',
            severity: 'warning',
            line: getNodeLine(child),
            nodeId: 'id' in child ? (child as { id: string }).id : undefined,
            message: `child of ${node.type.toUpperCase()} should use 0 for x and y (auto-layout)`,
          });
        }
      }
    }

    if (node.type === 'text') {
      const t = node as TextNode;
      if (t.align === 'center' && (t.maxWidth === undefined || t.x !== 0)) {
        warnings.push({
          rule: 'text-center-needs-maxwidth',
          severity: 'warning',
          line: getNodeLine(t),
          nodeId: t.id,
          message: 'TEXT align:center requires x:0 and max-width',
        });
      }
    }

    if (node.type === 'input') {
      const n = node as InputNode;
      if (n.label && n.label.length > 0 && n.y < 20) {
        warnings.push({
          rule: 'input-label-clearance',
          severity: 'warning',
          line: getNodeLine(n),
          nodeId: n.id,
          message: 'INPUT with label requires y >= 20 for label clearance',
        });
      }
      if (n.h < 36) {
        warnings.push({
          rule: 'tap-target-min-height',
          severity: 'warning',
          line: getNodeLine(n),
          nodeId: n.id,
          message: 'INPUT min height is 36px',
        });
      }
    }

    if (node.type === 'button') {
      const b = node as ButtonNode;
      if (b.h < 36) {
        warnings.push({
          rule: 'tap-target-min-height',
          severity: 'warning',
          line: getNodeLine(b),
          nodeId: b.id,
          message: 'BUTTON min height is 36px',
        });
      }
    }
  });

  // token-coverage — a raw hex literal that duplicates a declared TOKEN
  // value suggests the author forgot the $ref. Only fires when the value
  // matches a token exactly (case-insensitive) — inconsistency, not style.
  const hexToToken = new Map<string, string>();
  for (const t of scene.tokens as TokenNode[]) {
    if (typeof t.value === 'string' && t.value.startsWith('#')) {
      hexToToken.set(t.value.toLowerCase(), t.id);
    }
  }
  if (hexToToken.size > 0) {
    const checkLiteral = (
      value: string | undefined,
      node: { type: string },
      field: string,
    ): void => {
      if (!value || !value.startsWith('#')) return;
      const tokenId = hexToToken.get(value.toLowerCase());
      if (tokenId === undefined) return;
      warnings.push({
        rule: 'token-coverage',
        severity: 'warning',
        line: getNodeLine(node),
        nodeId: 'id' in node ? (node as { id: string }).id : undefined,
        message: `${node.type.toUpperCase()} ${field} ${value} duplicates TOKEN '${tokenId}' — use $${tokenId}`,
      });
    };
    walkNodes(scene.nodes, (node) => {
      const n = node as {
        type: string;
        bg?: string;
        color?: string;
        border?: { color?: string };
      };
      checkLiteral(n.bg, node, 'bg');
      checkLiteral(n.color, node, 'color');
      checkLiteral(n.border?.color, node, 'border color');
    });
  }

  // hover-coverage — fires only when the scene already declares at least one
  // STATE hover (the author cares about hover) but some BUTTONs lack one.
  // Scenes with no hover styling at all stay silent: that is a draft, not an
  // inconsistency.
  const hoverTargets = new Set<string>();
  let buttonCount = 0;
  const buttons: ButtonNode[] = [];
  walkNodes(scene.nodes, (node) => {
    if (node.type === 'state' && node.state === 'hover') {
      hoverTargets.add(node.targetId);
    }
    if (node.type === 'button') {
      buttonCount++;
      buttons.push(node as ButtonNode);
    }
  });
  if (hoverTargets.size > 0 && buttonCount > hoverTargets.size) {
    for (const b of buttons) {
      if (!hoverTargets.has(b.id)) {
        warnings.push({
          rule: 'hover-coverage',
          severity: 'warning',
          line: getNodeLine(b),
          nodeId: b.id,
          message: `BUTTON '${b.id}' has no STATE hover while other elements do`,
        });
      }
    }
  }

  // spacing-rhythm — among ≥3 same-type absolutely-positioned siblings
  // aligned on one axis, consecutive gaps that differ by 1–8px are the
  // signature of a drift mistake (large differences are deliberate design).
  const RHYTHM_DRIFT_MAX = 8;
  const checkRhythm = (children: Node[]): void => {
    type Positioned = { id: string; x: number; y: number; line?: number };
    const columns = new Map<string, Positioned[]>();
    const rows = new Map<string, Positioned[]>();
    for (const c of children) {
      if (!('id' in c) || !('x' in c) || !('y' in c)) continue;
      const p = {
        id: (c as { id: string }).id,
        x: (c as { x: number }).x,
        y: (c as { y: number }).y,
        line: getNodeLine(c),
      };
      const add = (m: Map<string, Positioned[]>, key: string): void => {
        const arr = m.get(key);
        if (arr) arr.push(p);
        else m.set(key, [p]);
      };
      add(columns, `${c.type}:${p.x}`);
      add(rows, `${c.type}:${p.y}`);
    }
    const checkAxis = (
      groups: Map<string, Positioned[]>,
      axis: 'x' | 'y',
    ): void => {
      for (const group of groups.values()) {
        if (group.length < 3) continue;
        const sorted = [...group].sort((a, b) =>
          axis === 'y' ? a.y - b.y : a.x - b.x,
        );
        for (let i = 0; i + 2 < sorted.length; i++) {
          const d1 =
            axis === 'y'
              ? sorted[i + 1].y - sorted[i].y
              : sorted[i + 1].x - sorted[i].x;
          const d2 =
            axis === 'y'
              ? sorted[i + 2].y - sorted[i + 1].y
              : sorted[i + 2].x - sorted[i + 1].x;
          const drift = Math.abs(d1 - d2);
          if (drift >= 1 && drift <= RHYTHM_DRIFT_MAX) {
            warnings.push({
              rule: 'spacing-rhythm',
              severity: 'warning',
              line: sorted[i + 2].line,
              nodeId: sorted[i + 2].id,
              message: `inconsistent ${axis === 'y' ? 'vertical' : 'horizontal'} rhythm: gap ${d2}px after ${d1}px (off by ${drift}px) — '${sorted[i].id}' → '${sorted[i + 1].id}' → '${sorted[i + 2].id}'`,
            });
          }
        }
      }
    };
    checkAxis(columns, 'y');
    checkAxis(rows, 'x');
  };
  checkRhythm(scene.nodes);
  walkNodes(scene.nodes, (node) => {
    if (node.type === 'layer') checkRhythm(node.children);
  });

  // low-contrast — TEXT with an explicit color measured against the nearest
  // ancestor LAYER with an explicit bg. Token refs resolve first; non-hex
  // values are skipped. Deliberately conservative: no theme defaults, no
  // overlap analysis — zero false positives over completeness.
  const tokenValues = new Map(
    (scene.tokens as TokenNode[]).map((t) => [t.id, t.value]),
  );
  const resolveColor = (c: string): string =>
    c.startsWith('$') ? String(tokenValues.get(c.slice(1)) ?? c) : c;

  const checkContrast = (nodes: Node[], bg: string | null): void => {
    // A sibling RECT / IMAGE / FILL covering the text's anchor point means
    // the visible background is not the layer bg — skip rather than guess.
    const occluders = nodes.filter(
      (s) => s.type === 'rect' || s.type === 'image' || s.type === 'fill',
    ) as Array<{ x: number; y: number; w: number; h: number }>;
    const occluded = (x: number, y: number): boolean =>
      occluders.some(
        (o) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h,
      );
    for (const n of nodes) {
      if (n.type === 'layer') {
        checkContrast(n.children, n.bg ? resolveColor(n.bg) : bg);
      } else if (
        n.type === 'stack' ||
        n.type === 'grid' ||
        n.type === 'repeat'
      ) {
        checkContrast(n.children, bg);
      } else if (n.type === 'text' && n.color && bg && !occluded(n.x, n.y)) {
        const fg = hexToRgb(resolveColor(n.color));
        const bgRgb = hexToRgb(bg);
        if (fg && bgRgb) {
          const ratio = contrastRatio(fg, bgRgb);
          if (ratio < MIN_CONTRAST_RATIO) {
            warnings.push({
              rule: 'low-contrast',
              severity: 'warning',
              line: getNodeLine(n),
              nodeId: n.id,
              message: `TEXT color ${resolveColor(n.color)} on background ${bg} has contrast ratio ${ratio.toFixed(2)} (< ${MIN_CONTRAST_RATIO})`,
            });
          }
        }
      }
    }
  };
  checkContrast(scene.nodes, null);

  return warnings;
}
