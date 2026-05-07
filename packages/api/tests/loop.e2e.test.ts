/**
 * End-to-end loop: /preview → /apply-patch → /synthesize on login.dsl,
 * exercising the path Claude Code's MCP client uses. The server is
 * LLM-free — the host-side agent supplies the ops, the server validates
 * and renders.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closeRenderer } from '@pixelagent/renderer';
import { buildApp } from '../src/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(here, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

const app = buildApp();

afterAll(async () => {
  await app.close();
  await closeRenderer();
});

describe('e2e: preview → apply-patch → synthesize', () => {
  it(
    'renders, surgically patches, re-renders, then synthesizes React reflecting the patch',
    async () => {
      // 1) Initial preview
      const previewRes = await app.inject({
        method: 'POST',
        url: '/preview',
        payload: { dsl: loginDsl },
      });
      expect(previewRes.statusCode).toBe(200);
      const previewBody = previewRes.json() as {
        png_base64: string;
        render_ms: number;
        warnings: unknown[];
      };
      expect(previewBody.png_base64.length).toBeGreaterThan(1000);
      const initialPng = previewBody.png_base64;

      // 2) Surgical patch — flip the primary button to destructive
      const patchRes = await app.inject({
        method: 'POST',
        url: '/apply-patch',
        payload: {
          dsl: loginDsl,
          ops: [
            {
              op: 'modify',
              id: 'login-btn',
              field: 'variant',
              value: 'destructive',
            },
          ],
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patchBody = patchRes.json() as {
        new_dsl: string;
        applied: Array<{ op: string; id: string; field: string; value: string }>;
        png_base64: string;
        warnings: unknown[];
      };
      expect(patchBody.applied).toHaveLength(1);
      expect(patchBody.applied[0]).toMatchObject({
        op: 'modify',
        id: 'login-btn',
        field: 'variant',
        value: 'destructive',
      });
      expect(patchBody.new_dsl).toContain('variant:destructive');
      expect(patchBody.png_base64.length).toBeGreaterThan(1000);
      // The patched PNG must visually differ from the initial one.
      expect(patchBody.png_base64).not.toBe(initialPng);

      // 3) Synthesize React from the patched DSL
      const synthRes = await app.inject({
        method: 'POST',
        url: '/synthesize',
        payload: { dsl: patchBody.new_dsl, target: 'react' },
      });
      expect(synthRes.statusCode).toBe(200);
      const synthBody = synthRes.json() as {
        code: string;
        warnings: unknown[];
      };
      expect(synthBody.code).toContain('export default function');
      expect(synthBody.code).toContain('>Sign in</button>');
      // Destructive variant maps to bg-red-600 in our codegen.
      expect(synthBody.code).toContain('bg-red-600');
      // The original primary token color must NOT appear on the button now.
      expect(synthBody.code).not.toMatch(
        /bg-\[#185FA5\][^"]*">Sign in</,
      );
    },
    60_000,
  );
});
