import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../src/index.js';
import { applyPatch } from '../src/apply-patch.js';
import { serialize } from '../src/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(__dirname, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

describe('applyPatch', () => {
  it('modify: updates a top-level field on a button', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'login-btn', field: 'variant', value: 'secondary' },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.applied).toHaveLength(1);
    const found = JSON.stringify(result.scene).match(/"variant":"secondary"/);
    expect(found).toBeTruthy();
  });

  it('modify: updates a nested field inside a layer', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'email-input', field: 'placeholder', value: 'you@example.com' },
    ]);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.scene)).toContain('"placeholder":"you@example.com"');
  });

  it('modify: unknown id reports error and leaves AST untouched for that op', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const before = JSON.stringify(scene);
    const result = applyPatch(scene, [
      { op: 'modify', id: 'nope', field: 'bg', value: '#10B981' },
    ]);
    expect(result.applied).toHaveLength(0);
    expect(result.errors[0]).toContain("'nope' not found");
    expect(JSON.stringify(result.scene)).toEqual(before);
  });

  it('remove: deletes a node by id', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [{ op: 'remove', id: 'pwd-input' }]);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.scene)).not.toContain('"pwd-input"');
  });

  it('add: appends a node under a parent container', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      {
        op: 'add',
        parentId: 'login-card',
        node: {
          type: 'text',
          id: 'extra',
          x: 32,
          y: 320,
          text: 'Forgot password?',
          size: 12,
        },
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.scene)).toContain('"id":"extra"');
  });

  it('does not mutate the input scene', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const snapshot = JSON.stringify(scene);
    applyPatch(scene, [
      { op: 'modify', id: 'login-btn', field: 'variant', value: 'ghost' },
    ]);
    expect(JSON.stringify(scene)).toEqual(snapshot);
  });
});

describe('serialize', () => {
  it('round-trips login.dsl through parse → serialize → parse', () => {
    const a = parse(loginDsl).scene;
    if (!a) throw new Error('parse failed');
    const text = serialize(a);
    const b = parse(text).scene;
    expect(b).not.toBeNull();
    // structural equality (warnings + line metadata are non-IR)
    const stripWarnings = (s: typeof a) => ({ ...s, warnings: undefined });
    expect(JSON.parse(JSON.stringify(stripWarnings(b!)))).toEqual(
      JSON.parse(JSON.stringify(stripWarnings(a))),
    );
  });

  it('serialize after modify produces DSL containing the new value', () => {
    const a = parse(loginDsl).scene;
    if (!a) throw new Error('parse failed');
    const { scene } = applyPatch(a, [
      { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
    ]);
    const text = serialize(scene);
    expect(text).toContain('variant:destructive');
  });
});
