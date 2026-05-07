import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closeRenderer } from '@pixelagent/renderer';
import { parse } from '@pixelagent/parser';
import { buildApp } from '../src/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(__dirname, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const app = buildApp();

afterAll(async () => {
  await app.close();
  await closeRenderer();
});

describe('POST /patch (e2e — real Anthropic)', () => {
  it.skipIf(!hasKey)(
    'modifies the Sign in button with token budget < 200',
    async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/patch',
        payload: {
          dsl: loginDsl,
          instruction: 'Change the Sign in button label to "Log in"',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.new_dsl).toBe('string');
      expect(body.new_dsl).not.toEqual(loginDsl);
      expect(body.tokens_used).toBeLessThan(200);
      const parsed = parse(body.new_dsl);
      expect(parsed.scene).not.toBeNull();
    },
    60_000,
  );
});
