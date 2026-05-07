import type { Border, Node, Scene } from '@pixelagent/dsl-spec';
import type { ApplyPatchResult, PatchOp } from './types.js';

type Container = Extract<Node, { children: Node[] }>;

const isContainer = (n: Node): n is Container =>
  n.type === 'layer' ||
  n.type === 'stack' ||
  n.type === 'grid' ||
  n.type === 'repeat';

const getId = (n: Node): string | undefined => {
  if (n.type === 'fill') return undefined;
  if (n.type === 'state' || n.type === 'effect') return undefined;
  return n.id;
};

const findNode = (
  nodes: Node[],
  id: string,
): { node: Node; parent: Node[]; index: number } | null => {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (getId(n) === id) return { node: n, parent: nodes, index: i };
    if (isContainer(n)) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findContainer = (nodes: Node[], id: string): Container | null => {
  for (const n of nodes) {
    if (isContainer(n)) {
      if (n.id === id) return n;
      const inner = findContainer(n.children, id);
      if (inner) return inner;
    }
  }
  return null;
};

const cloneScene = (scene: Scene): Scene => structuredClone(scene);

const parseBorderValue = (value: string | number): Border | null => {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const width = parseInt(parts[0], 10);
  if (Number.isNaN(width)) return null;
  return { width, color: parts[1] };
};

const applyModify = (
  node: Node,
  field: string,
  value: string | number,
  errors: string[],
): boolean => {
  if (field === 'border') {
    if (node.type !== 'rect' && node.type !== 'layer') {
      errors.push(`field 'border' not supported on ${node.type}`);
      return false;
    }
    const b = parseBorderValue(value);
    if (!b) {
      errors.push(`invalid border value '${value}'`);
      return false;
    }
    node.border = b;
    return true;
  }
  // Direct field assignment. Cast through `unknown` because the field name
  // is dynamic — runtime safety relies on caller-supplied LLM ops being
  // shape-correct, and the validator catching anything bogus on re-parse.
  const obj = node as unknown as Record<string, unknown>;
  obj[field] = value;
  return true;
};

/**
 * Apply patch operations to a Scene, returning a new Scene plus the list of
 * ops that successfully applied and human-readable errors for ones that
 * didn't. Pure: input scene is not mutated.
 *
 * Unknown ids are reported in `errors` and the corresponding op is skipped —
 * later ops still apply against the partially-updated scene.
 */
export const applyPatch = (scene: Scene, ops: PatchOp[]): ApplyPatchResult => {
  const next = cloneScene(scene);
  const applied: PatchOp[] = [];
  const errors: string[] = [];

  for (const op of ops) {
    if (op.op === 'modify') {
      const found = findNode(next.nodes, op.id);
      if (!found) {
        errors.push(`modify: node id '${op.id}' not found`);
        continue;
      }
      if (applyModify(found.node, op.field, op.value, errors)) {
        applied.push(op);
      }
    } else if (op.op === 'remove') {
      const found = findNode(next.nodes, op.id);
      if (!found) {
        errors.push(`remove: node id '${op.id}' not found`);
        continue;
      }
      found.parent.splice(found.index, 1);
      applied.push(op);
    } else if (op.op === 'add') {
      if (op.parentId) {
        const parent = findContainer(next.nodes, op.parentId);
        if (!parent) {
          errors.push(`add: parent id '${op.parentId}' not found`);
          continue;
        }
        parent.children.push(op.node);
      } else {
        next.nodes.push(op.node);
      }
      applied.push(op);
    }
  }

  return { scene: next, applied, errors };
};
