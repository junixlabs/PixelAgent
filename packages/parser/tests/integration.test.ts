import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(
  __dirname,
  '..',
  '..',
  'dsl-spec',
  'examples',
);

function read(name: string): string {
  return readFileSync(resolve(examplesDir, name), 'utf8');
}

describe('integration — example DSL files', () => {
  it('parses login.dsl with no errors', () => {
    const { scene, warnings } = parse(read('login.dsl'));
    const errors = warnings.filter((w) => w.severity === 'error');
    expect(errors).toEqual([]);
    expect(scene).not.toBeNull();
    expect(scene?.screen.w).toBe(1440);
    expect(scene?.screen.h).toBe(900);
    expect(scene?.tokens.length).toBeGreaterThan(0);
    expect(scene?.nodes.length).toBeGreaterThan(0);
  });

  it('parses dashboard-card.dsl with no errors', () => {
    const { scene, warnings } = parse(read('dashboard-card.dsl'));
    const errors = warnings.filter((w) => w.severity === 'error');
    expect(errors).toEqual([]);
    expect(scene).not.toBeNull();
    expect(scene?.screen.w).toBe(1440);
    expect(scene?.tokens.length).toBeGreaterThan(0);
    expect(scene?.nodes.length).toBeGreaterThan(0);
  });
});
