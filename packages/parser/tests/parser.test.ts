import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

describe('parser — happy paths', () => {
  it('parses a minimal SCREEN', () => {
    const { scene, warnings } = parse('SCREEN 1440 900 theme:light\n');
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    expect(scene?.screen).toMatchObject({
      type: 'screen',
      w: 1440,
      h: 900,
      theme: 'light',
    });
  });

  it('parses TOKEN entries with color, number, and ident values', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'TOKEN primary #185FA5',
        'TOKEN radius 8',
        'TOKEN family default',
        '',
      ].join('\n'),
    );
    expect(scene?.tokens).toEqual([
      { type: 'token', id: 'primary', value: '#185FA5' },
      { type: 'token', id: 'radius', value: '8' },
      { type: 'token', id: 'family', value: 'default' },
    ]);
  });

  it('parses a RECT with bg, r, and border:N color', () => {
    const { scene } = parse(
      'SCREEN 100 100\nRECT box 0 0 50 50 bg:#fff r:8 border:1 #ccc\n',
    );
    const rect = scene?.nodes[0];
    expect(rect).toMatchObject({
      type: 'rect',
      id: 'box',
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      bg: '#fff',
      r: 8,
      border: { width: 1, color: '#ccc' },
    });
  });

  it('parses a TEXT with align + max-width', () => {
    const { scene } = parse(
      'SCREEN 100 100\nTEXT t 0 20 "Hello" align:center max-width:200\n',
    );
    const text = scene?.nodes[0];
    expect(text).toMatchObject({
      type: 'text',
      align: 'center',
      maxWidth: 200,
    });
  });

  it('parses INPUT and BUTTON with state + variant', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'INPUT i 0 24 200 44 type:email label:"Email"',
        'BUTTON b 0 80 200 48 "Sign in" variant:primary',
        '',
      ].join('\n'),
    );
    expect(scene?.nodes[0]).toMatchObject({
      type: 'input',
      inputType: 'email',
      label: 'Email',
    });
    expect(scene?.nodes[1]).toMatchObject({
      type: 'button',
      variant: 'primary',
      label: 'Sign in',
    });
  });

  it("normalizes BUTTON variant alias 'danger' to canonical 'destructive'", () => {
    const { scene, warnings } = parse(
      [
        'SCREEN 100 100',
        'BUTTON a 0 0 100 48 "X" variant:danger',
        'BUTTON b 0 60 100 48 "X" variant:destructive',
        '',
      ].join('\n'),
    );
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    expect(scene?.nodes[0]).toMatchObject({ type: 'button', variant: 'destructive' });
    expect(scene?.nodes[1]).toMatchObject({ type: 'button', variant: 'destructive' });
  });

  it('accepts a token reference as the border color', () => {
    const { scene, warnings } = parse(
      [
        'SCREEN 100 100',
        'TOKEN border #e0e0e0',
        'LAYER card 0 0 400 300 bg:#ffffff border:1 $border',
        'END',
        '',
      ].join('\n'),
    );
    expect(warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    expect(scene?.nodes[0]).toMatchObject({
      type: 'layer',
      border: { width: 1, color: '$border' },
    });
  });

  it('parses nested LAYER with children', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'LAYER card 0 0 100 100 bg:#fff',
        '  RECT inner 4 4 92 92 bg:#eee',
        'END',
        '',
      ].join('\n'),
    );
    const layer = scene?.nodes[0] as { children: { id: string }[] };
    expect(layer).toMatchObject({ type: 'layer', id: 'card' });
    expect(layer.children[0]).toMatchObject({ type: 'rect', id: 'inner' });
  });

  it('parses STACK / GRID / REPEAT containers', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'STACK s 0 0 direction:column gap:8',
        '  RECT a 0 0 10 10',
        'END',
        'GRID g 0 0 100 columns:3 gap:10',
        '  RECT b 0 0 10 10',
        'END',
        'REPEAT r 3 direction:row gap:4',
        '  RECT c 0 0 10 10',
        'END',
        '',
      ].join('\n'),
    );
    expect(scene?.nodes[0]).toMatchObject({
      type: 'stack',
      direction: 'column',
      gap: 8,
    });
    expect(scene?.nodes[1]).toMatchObject({
      type: 'grid',
      columns: 3,
      gap: 10,
    });
    expect(scene?.nodes[2]).toMatchObject({
      type: 'repeat',
      count: 3,
      direction: 'row',
      gap: 4,
    });
  });

  it('parses STATE block with key: value overrides', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'BUTTON b 0 0 100 48 "Go" variant:primary',
        'STATE b hover',
        '  bg: #0C447C',
        '  size: 20',
        'END',
        '',
      ].join('\n'),
    );
    const stateNode = scene?.nodes[1] as {
      overrides: Record<string, string | number>;
    };
    expect(stateNode).toMatchObject({
      type: 'state',
      targetId: 'b',
      state: 'hover',
    });
    expect(stateNode.overrides).toEqual({ bg: '#0C447C', size: 20 });
  });

  it('parses EFFECT with params', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'LAYER l 0 0 100 100',
        'END',
        'EFFECT l shadow blur:24 y:8 color:#0f172a14',
        '',
      ].join('\n'),
    );
    const eff = scene?.nodes[1];
    expect(eff).toMatchObject({
      type: 'effect',
      targetId: 'l',
      effect: 'shadow',
      params: { blur: 24, y: 8, color: '#0f172a14' },
    });
  });

  it('keeps $token references as raw strings', () => {
    const { scene } = parse(
      [
        'SCREEN 100 100',
        'TOKEN primary #185FA5',
        'LAYER l 0 0 100 100 bg:$primary',
        'END',
        '',
      ].join('\n'),
    );
    const layer = scene?.nodes[0] as { bg?: string };
    expect(layer.bg).toBe('$primary');
  });
});

describe('parser — error cases', () => {
  it('errors on unmatched END', () => {
    const { warnings } = parse('SCREEN 100 100\nEND\n');
    expect(
      warnings.some(
        (w) => w.rule === 'block-end-required' && /unmatched/.test(w.message),
      ),
    ).toBe(true);
  });

  it('errors on unclosed block', () => {
    const { warnings } = parse('SCREEN 100 100\nLAYER l 0 0 10 10\n');
    expect(
      warnings.some(
        (w) => w.rule === 'block-end-required' && /unclosed/.test(w.message),
      ),
    ).toBe(true);
  });

  it('errors when SCREEN missing', () => {
    const { scene, warnings } = parse('LAYER l 0 0 10 10\nEND\n');
    expect(scene).toBeNull();
    expect(warnings.some((w) => w.rule === 'screen-first')).toBe(true);
  });

  it('errors on duplicate SCREEN', () => {
    const { warnings } = parse('SCREEN 100 100\nSCREEN 200 200\n');
    expect(
      warnings.some(
        (w) => w.rule === 'screen-first' && /once/.test(w.message),
      ),
    ).toBe(true);
  });

  it('errors when SCREEN is not the first command', () => {
    const { warnings } = parse(
      'TOKEN primary #fff\nSCREEN 100 100\n',
    );
    expect(
      warnings.some(
        (w) => w.rule === 'screen-first' && /first/.test(w.message),
      ),
    ).toBe(true);
  });

  it('errors on unknown command', () => {
    const { warnings } = parse('SCREEN 100 100\nWIDGET foo\n');
    expect(warnings.some((w) => w.rule === 'parse-error')).toBe(true);
  });
});
