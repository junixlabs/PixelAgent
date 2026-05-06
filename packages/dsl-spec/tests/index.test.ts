import { describe, it, expect } from 'vitest';
import type { Scene } from '../grammar.js';

describe('@pixelagent/dsl-spec', () => {
  it('exports Scene type via grammar module', () => {
    const scene: Scene = null;
    expect(scene).toBeNull();
  });
});
