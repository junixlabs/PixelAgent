import { describe, it, expect } from 'vitest';
import { toReact, toHtml, toSwiftUI } from '../src/index.js';

describe('@pixelagent/codegen', () => {
  it('exports toReact, toHtml, toSwiftUI as functions', () => {
    expect(typeof toReact).toBe('function');
    expect(typeof toHtml).toBe('function');
    expect(typeof toSwiftUI).toBe('function');
  });
});
