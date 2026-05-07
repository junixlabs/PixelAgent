import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closeRenderer } from '@pixelagent/renderer';
import { buildApp } from '../src/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(__dirname, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

const app = buildApp();

afterAll(async () => {
  await app.close();
  await closeRenderer();
});

describe('POST /preview', () => {
  it(
    'renders login.dsl to a PNG',
    async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/preview',
        payload: { dsl: loginDsl },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.png_base64).toBe('string');
      expect(body.png_base64.length).toBeGreaterThan(0);
      expect(body.render_ms).toBeGreaterThan(0);
      expect(Array.isArray(body.warnings)).toBe(true);
    },
    30_000,
  );

  it('returns 422 parse_failed when DSL has no SCREEN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { dsl: 'TOKEN primary #185FA5\n' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error).toBe('parse_failed');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
    const text = JSON.stringify(body.errors).toLowerCase();
    expect(text).toContain('screen');
    expect(body.png_base64).toBeUndefined();
  });

  it('rejects body missing dsl via schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty dsl via schema (minLength)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { dsl: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
