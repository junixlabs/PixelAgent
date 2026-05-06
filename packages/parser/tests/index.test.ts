import { describe, it, expect } from 'vitest';
import { parse, tokenize, validate } from '../src/index.js';

describe('@pixelagent/parser exports', () => {
  it('exports parse, tokenize, validate as functions', () => {
    expect(typeof parse).toBe('function');
    expect(typeof tokenize).toBe('function');
    expect(typeof validate).toBe('function');
  });

  it('parse returns ParseResult with scene + warnings', () => {
    const out = parse('SCREEN 100 100\n');
    expect(out).toHaveProperty('scene');
    expect(out).toHaveProperty('warnings');
    expect(Array.isArray(out.warnings)).toBe(true);
  });
});
