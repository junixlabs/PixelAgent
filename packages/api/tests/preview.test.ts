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

  it('format:"html" returns interactive HTML instead of PNG', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { dsl: loginDsl, format: 'html' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.png_base64).toBeUndefined();
    expect(typeof body.html).toBe('string');
    expect(body.html).toContain('<!doctype html');
    expect(body.html).toContain('id="pa-inspector"');
    expect(body.render_ms).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it('rejects unknown format via schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { dsl: loginDsl, format: 'svg' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /preview — multi-screen bundle', () => {
  const loginScreen =
    'SCREEN 400 300\nBUTTON to-home 10 10 120 40 "Go home" goto:home\n';
  const homeScreen =
    'SCREEN 400 300\nTEXT hi 10 10 "Welcome"\nBUTTON to-login 10 60 120 40 "Log out" goto:login\n';

  it('returns a navigable HTML bundle with one iframe per screen', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: {
        screens: { login: loginScreen, home: homeScreen },
        entry: 'login',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.html).toContain('data-screen="login"');
    expect(body.html).toContain('data-screen="home"');
    expect((body.html.match(/<iframe/g) ?? []).length).toBe(2);
    expect(body.html).toContain('show("login")');
    expect(body.warnings).toEqual([]);
  });

  it('warns when goto points at a screen missing from the bundle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { screens: { login: loginScreen }, entry: 'login' },
    });
    expect(res.statusCode).toBe(200);
    const w = res
      .json()
      .warnings.find(
        (x: { rule: string }) => x.rule === 'goto-unknown-screen',
      );
    expect(w).toBeDefined();
    expect(w.message).toContain("'home'");
  });

  it('422 bad_bundle when entry is not a screen key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: { screens: { login: loginScreen }, entry: 'nope' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('bad_bundle');
  });

  it('400 when both dsl and screens are provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: {
        dsl: loginDsl,
        screens: { login: loginScreen },
        entry: 'login',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('422 parse_failed names the offending screen', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/preview',
      payload: {
        screens: { login: loginScreen, broken: 'TOKEN x #fff\n' },
        entry: 'login',
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error).toBe('parse_failed');
    expect(body.screen).toBe('broken');
  });
});
