import { describe, it, expect } from 'vitest';
import { dslToHtml, render, encodeIdBuffer } from '../src/index.js';

describe('@pixelagent/renderer', () => {
  it('exports dslToHtml, render, encodeIdBuffer as functions', () => {
    expect(typeof dslToHtml).toBe('function');
    expect(typeof render).toBe('function');
    expect(typeof encodeIdBuffer).toBe('function');
  });
});
