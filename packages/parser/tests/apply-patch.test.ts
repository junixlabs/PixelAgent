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

  it('modify: rejects invalid enum value (variant)', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'login-btn', field: 'variant', value: 'tertiary' },
    ]);
    expect(result.applied).toHaveLength(0);
    expect(result.errors[0]).toMatch(/variant.*tertiary/);
  });

  it("modify: rejects field not writable on node type (bg on text)", () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'brand', field: 'bg', value: '#ff0000' },
    ]);
    expect(result.applied).toHaveLength(0);
    expect(result.errors[0]).toMatch(/'bg' not writable on 'text'/);
  });

  it('modify: strips wrapping quotes from string fields', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'email-input', field: 'placeholder', value: '"hello"' },
    ]);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.scene)).toContain('"placeholder":"hello"');
  });

  it('modify: rewrites max-width alias to maxWidth', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      { op: 'modify', id: 'brand', field: 'max-width', value: 200 },
    ]);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(result.scene)).toContain('"maxWidth":200');
  });

  it('add: rejects malformed node (missing type)', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      // @ts-expect-error — testing runtime guard against malformed LLM output
      { op: 'add', parentId: 'login-card', node: { id: 'oops', x: 0, y: 0 } },
    ]);
    expect(result.applied).toHaveLength(0);
    expect(result.errors[0]).toMatch(/invalid node type/);
  });

  it('add: rejects node missing required dimensions', () => {
    const { scene } = parse(loginDsl);
    if (!scene) throw new Error('parse failed');
    const result = applyPatch(scene, [
      {
        op: 'add',
        parentId: 'login-card',
        // @ts-expect-error — testing runtime guard
        node: { type: 'rect', id: 'r1', x: 0, y: 0 },
      },
    ]);
    expect(result.applied).toHaveLength(0);
    expect(result.errors[0]).toMatch(/rect\.w must be a number/);
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

describe('goto flow link param', () => {
  const dsl = [
    'SCREEN 800 600',
    'BUTTON go-home 10 10 120 40 "Home" goto:home',
    'TEXT back 10 80 "Back to login" color:#185FA5 goto:login',
    '',
  ].join('\n');

  it('parses goto on BUTTON and TEXT', () => {
    const { scene, warnings } = parse(dsl);
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    const btn = scene!.nodes.find((n) => 'id' in n && n.id === 'go-home');
    const txt = scene!.nodes.find((n) => 'id' in n && n.id === 'back');
    expect((btn as { goto?: string }).goto).toBe('home');
    expect((txt as { goto?: string }).goto).toBe('login');
  });

  it('round-trips goto through serialize → parse', () => {
    const a = parse(dsl).scene!;
    const b = parse(serialize(a)).scene!;
    const btn = b.nodes.find((n) => 'id' in n && n.id === 'go-home');
    expect((btn as { goto?: string }).goto).toBe('home');
  });

  it('modify op can set and patch goto', () => {
    const { scene } = parse(dsl);
    const result = applyPatch(scene!, [
      { op: 'modify', id: 'go-home', field: 'goto', value: 'dashboard' },
    ]);
    expect(result.errors).toHaveLength(0);
    expect(serialize(result.scene)).toContain('goto:dashboard');
  });

  it('modify op rejects a non-identifier goto value', () => {
    const { scene } = parse(dsl);
    const result = applyPatch(scene!, [
      { op: 'modify', id: 'go-home', field: 'goto', value: '../evil' },
    ]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('identifier');
  });
});

describe('semantic intent params', () => {
  const dsl = [
    'SCREEN 800 600',
    'LAYER shell 0 0 800 80 role:header',
    '  TEXT t 16 16 "Title" level:h2 href:"https://a.b"',
    'END',
    'IMAGE i 16 120 100 100 "x.png" alt:"pic"',
    '',
  ].join('\n');

  it('parses and round-trips level/href/alt/role through serialize', () => {
    const a = parse(dsl);
    expect(a.warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    const text = serialize(a.scene!);
    expect(text).toContain('role:header');
    expect(text).toContain('level:h2');
    expect(text).toContain('href:"https://a.b"');
    expect(text).toContain('alt:"pic"');
    const b = parse(text);
    expect(b.warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });

  it('rejects invalid level and role values', () => {
    expect(
      parse('SCREEN 100 100\nTEXT t 0 0 "x" level:h7\n').warnings.some(
        (w) => w.severity === 'error',
      ),
    ).toBe(true);
    expect(
      parse(
        'SCREEN 100 100\nLAYER l 0 0 10 10 role:hero\nEND\n',
      ).warnings.some((w) => w.severity === 'error'),
    ).toBe(true);
  });

  it('modify op can set role and level', () => {
    const { scene } = parse(dsl);
    const result = applyPatch(scene!, [
      { op: 'modify', id: 'shell', field: 'role', value: 'footer' },
      { op: 'modify', id: 't', field: 'level', value: 'h3' },
    ]);
    expect(result.errors).toHaveLength(0);
    const text = serialize(result.scene);
    expect(text).toContain('role:footer');
    expect(text).toContain('level:h3');
  });
});
