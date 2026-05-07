import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '@pixelagent/parser';
import { toReact, toHtml, toSwiftUI } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(here, '../../dsl-spec/examples/login.dsl'),
  'utf8',
);

describe('@pixelagent/codegen', () => {
  it('exports toReact, toHtml, toSwiftUI as functions', () => {
    expect(typeof toReact).toBe('function');
    expect(typeof toHtml).toBe('function');
    expect(typeof toSwiftUI).toBe('function');
  });

  describe('toReact(login.dsl)', () => {
    const { scene, warnings } = parse(loginDsl);
    if (!scene) throw new Error(`login.dsl failed to parse: ${JSON.stringify(warnings)}`);
    const code = toReact(scene);

    it('emits a single default-exported functional component', () => {
      expect(code).toMatch(/export default function \w+\s*\(\s*\)\s*\{/);
      expect(code.match(/export default function/g)?.length).toBe(1);
      expect(code).toContain('return (');
    });

    it('uses absolute positioning for top-level nodes', () => {
      expect(code).toContain('absolute');
      expect(code).toContain(`w-[1440px]`);
      expect(code).toContain(`h-[900px]`);
    });

    it('includes the resolved primary color token (#185FA5) on the primary button', () => {
      expect(code).toContain('#185FA5');
      expect(code).toMatch(/bg-\[#185FA5\][^"]*">Sign in/);
    });

    it('includes the resolved surface color token (#ffffff) on the login card', () => {
      expect(code).toContain('#ffffff');
    });

    it('includes the radius token literal (12) on the login card', () => {
      expect(code).toContain('rounded-[12px]');
      expect(code).toContain('rounded-[6px]');
    });

    it('renders the "Sign in" button label and an :hover bg from STATE', () => {
      expect(code).toContain('>Sign in</button>');
      expect(code).toContain('hover:bg-[#0C447C]');
    });

    it('renders the inputs with their labels', () => {
      expect(code).toContain('>Email</label>');
      expect(code).toContain('>Password</label>');
      expect(code).toContain('type="email"');
      expect(code).toContain('type="password"');
    });

    it('produces no source containing the literal "any"-type annotation', () => {
      expect(code).not.toMatch(/:\s*any\b/);
    });
  });
});
