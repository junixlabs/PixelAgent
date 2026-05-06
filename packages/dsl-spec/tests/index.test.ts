import { describe, it, expect } from 'vitest';
import type { Node, Scene } from '../src/index.js';

describe('@pixelagent/dsl-spec', () => {
  it('Scene exposes a typed screen + flat nodes body', () => {
    const scene: Scene = {
      screen: { type: 'screen', w: 1440, h: 900, theme: 'light' },
      tokens: [{ type: 'token', id: 'primary', value: '#185FA5' }],
      nodes: [],
    };

    expect(scene.screen.type).toBe('screen');
    expect(scene.tokens[0]?.id).toBe('primary');
  });

  it('Node union narrows on discriminator', () => {
    const button: Node = {
      type: 'button',
      id: 'login-btn',
      x: 32,
      y: 224,
      w: 376,
      h: 48,
      label: 'Sign in',
      variant: 'primary',
    };

    if (button.type === 'button') {
      expect(button.label).toBe('Sign in');
    }
  });
});
