import type { Border, Node } from '@pixelagent/dsl-spec';

export type Container = Extract<Node, { children: Node[] }>;

export const isContainer = (n: Node): n is Container =>
  n.type === 'layer' ||
  n.type === 'stack' ||
  n.type === 'grid' ||
  n.type === 'repeat';

export const walkNodes = (nodes: Node[], visit: (n: Node) => void): void => {
  for (const n of nodes) {
    visit(n);
    if (isContainer(n)) walkNodes(n.children, visit);
  }
};

export const parseBorderRaw = (raw: string): Border | null => {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const width = parseInt(parts[0], 10);
  if (Number.isNaN(width)) return null;
  return { width, color: parts[1] };
};
