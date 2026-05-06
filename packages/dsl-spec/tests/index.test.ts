import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/index.js';

describe('@pixelagent/dsl-spec', () => {
  it('exports Scene type', () => {
    const scene: Scene = null;
    expect(scene).toBeNull();
  });
});
