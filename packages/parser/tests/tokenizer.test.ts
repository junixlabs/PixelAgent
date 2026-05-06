import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenizer.js';

function tokens(input: string) {
  return tokenize(input).tokens.filter((t) => t.kind !== 'newline');
}

describe('tokenizer', () => {
  it('skips comment-only lines and blank lines', () => {
    const r = tokenize('# a comment\n\n# another\n');
    expect(r.tokens).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  it('emits command kind for known head idents (case-insensitive)', () => {
    const t = tokens('SCREEN 100 200\n');
    expect(t[0]).toMatchObject({ kind: 'command', value: 'SCREEN' });
    expect(t[1]).toMatchObject({ kind: 'number', value: 100 });
    expect(t[2]).toMatchObject({ kind: 'number', value: 200 });
  });

  it('emits end token for END keyword', () => {
    const t = tokens('LAYER a 0 0 10 10\nEND\n');
    expect(t[t.length - 1]).toMatchObject({ kind: 'end' });
  });

  it('parses quoted strings (with spaces)', () => {
    const t = tokens('TEXT t 0 0 "Sign in"\n');
    expect(t[4]).toMatchObject({ kind: 'string', value: 'Sign in' });
  });

  it('emits error for unterminated string', () => {
    const r = tokenize('TEXT t 0 0 "oops\n');
    expect(r.errors.some((e) => e.rule === 'lex-error')).toBe(true);
  });

  it('parses kvinline pair without spaces', () => {
    const t = tokens('SCREEN 100 100 theme:dark\n');
    expect(t[3]).toMatchObject({ kind: 'kvinline', key: 'theme', raw: 'dark' });
  });

  it('parses kvinline with quoted value preserving quotes', () => {
    const t = tokens('INPUT i 0 0 100 50 placeholder:"Email address"\n');
    const kv = t.find((x) => x.kind === 'kvinline');
    expect(kv).toMatchObject({ key: 'placeholder', raw: '"Email address"' });
  });

  it('parses kvinline with token reference value', () => {
    const t = tokens('LAYER a 0 0 10 10 bg:$primary\n');
    const kv = t.find((x) => x.kind === 'kvinline' && x.key === 'bg');
    expect(kv).toMatchObject({ raw: '$primary' });
  });

  it('splits border:1 #ccc into kvinline + color (parser later merges)', () => {
    const t = tokens('RECT r 0 0 10 10 border:1 #ccc\n');
    const kv = t.find((x) => x.kind === 'kvinline' && x.key === 'border');
    expect(kv).toMatchObject({ raw: '1' });
    expect(t.some((x) => x.kind === 'color' && x.value === '#ccc')).toBe(true);
  });

  it('parses kvspaced for STATE body (key: value with space)', () => {
    const t = tokens('STATE btn hover\n  bg: #0C447C\nEND\n');
    const kv = t.find((x) => x.kind === 'kvspaced');
    expect(kv).toMatchObject({ key: 'bg', raw: '#0C447C' });
  });

  it('emits tokenref for $name', () => {
    const t = tokens('TOKEN x #fff\nLAYER a 0 0 10 10 bg:$x\n');
    expect(t.some((x) => x.kind === 'kvinline' && x.raw === '$x')).toBe(true);
  });

  it('rejects decimal numbers', () => {
    const r = tokenize('SCREEN 100.5 200\n');
    expect(r.errors.some((e) => /decimal/.test(e.message))).toBe(true);
  });

  it('accepts 3, 6, and 8 hex digit colors', () => {
    const t3 = tokens('TOKEN a #abc\n');
    const t6 = tokens('TOKEN a #aabbcc\n');
    const t8 = tokens('TOKEN a #aabbccdd\n');
    expect(t3.some((x) => x.kind === 'color' && x.value === '#abc')).toBe(true);
    expect(
      t6.some((x) => x.kind === 'color' && x.value === '#aabbcc'),
    ).toBe(true);
    expect(
      t8.some((x) => x.kind === 'color' && x.value === '#aabbccdd'),
    ).toBe(true);
  });

  it('rejects invalid color literal', () => {
    const r = tokenize('TOKEN a #zzzz\n');
    expect(r.errors.some((e) => /invalid color/.test(e.message))).toBe(true);
  });

  it('tracks 1-based line and column', () => {
    const t = tokens('SCREEN 100 100\nLAYER a 0 0 10 10\n');
    const layer = t.find((x) => x.kind === 'command' && x.value === 'LAYER');
    expect(layer?.line).toBe(2);
    expect(layer?.column).toBe(1);
  });
});
