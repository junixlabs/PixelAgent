import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildApp } from '../src/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(here, '../../dsl-spec/examples/login.dsl'),
  'utf8',
);

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('POST /synthesize', () => {
  it('returns React code for valid DSL with target=react', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize',
      payload: { dsl: loginDsl, target: 'react' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { code: string; warnings: unknown[] };
    expect(typeof body.code).toBe('string');
    expect(body.code).toContain('export default function');
    expect(body.code).toContain('Sign in');
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it('rejects missing target', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize',
      payload: { dsl: loginDsl },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unknown target', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize',
      payload: { dsl: loginDsl, target: 'vue' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 422 with parse_failed for invalid DSL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/synthesize',
      payload: { dsl: 'NOT_A_REAL_COMMAND 1 2 3', target: 'react' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'parse_failed' });
  });
});
