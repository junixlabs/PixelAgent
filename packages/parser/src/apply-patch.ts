import type { Node, Scene } from '@pixelagent/dsl-spec';
import type { ApplyPatchResult, PatchOp } from './types.js';
import { type Container, isContainer } from './helpers.js';
import { validateAddNode, validateModify } from './patch-validation.js';

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

const applyModify = (
  node: Node,
  field: string,
  value: string | number,
  errors: string[],
): boolean => {
  const result = validateModify(node.type, field, value);
  if (!result.ok) {
    errors.push(`modify '${field}' on ${node.type}: ${result.error}`);
    return false;
  }
  (node as unknown as Record<string, unknown>)[result.field] = result.value;
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
      const validated = validateAddNode(op.node);
      if (!validated.ok) {
        errors.push(`add: ${validated.error}`);
        continue;
      }
      if (op.parentId) {
        const parent = findContainer(next.nodes, op.parentId);
        if (!parent) {
          errors.push(`add: parent id '${op.parentId}' not found`);
          continue;
        }
        parent.children.push(validated.node);
      } else {
        next.nodes.push(validated.node);
      }
      applied.push({ ...op, node: validated.node });
    }
  }

  return { scene: next, applied, errors };
};
