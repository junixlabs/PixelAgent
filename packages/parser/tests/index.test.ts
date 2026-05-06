import { describe, it, expect } from 'vitest';
import { parse, tokenize, validate } from '../src/index.js';

describe('@pixelagent/parser', () => {
  it('exports parse, tokenize, validate as functions', () => {
    expect(typeof parse).toBe('function');
    expect(typeof tokenize).toBe('function');
    expect(typeof validate).toBe('function');
  });
});
