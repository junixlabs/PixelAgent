import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '@pixelagent/parser';
import { dslToHtml, render, closeRenderer } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const loadDsl = (name: string): string =>
  readFileSync(resolve(here, '../../dsl-spec/examples', name), 'utf8');

afterAll(async () => {
  await closeRenderer();
});

describe('dslToHtml', () => {
  it('produces a self-contained HTML doc with token vars and node ids', () => {
    const { scene } = parse(loadDsl('login.dsl'));
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    expect(html).toContain('<!doctype html');
    expect(html).toContain('--primary: #185FA5');
    expect(html).toContain('id="login-card"');
    expect(html).toContain('id="email-input"');
    expect(html).toContain('id="login-btn"');
    expect(html).toContain('Sign in');
    expect(html).toMatch(/#login-btn:hover\s*\{[^}]*background:\s*#0C447C/i);
    expect(html).toContain('width:1440px;height:900px');
  });

  it('renders dashboard-card.dsl tokens and grid wrapper', () => {
    const { scene } = parse(loadDsl('dashboard-card.dsl'));
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    expect(html).toContain('--surface: #ffffff');
    expect(html).toContain('id="kpis"');
    expect(html).toContain('grid-template-columns:repeat(3,1fr)');
    expect(html).toContain('id="card-revenue"');
    expect(html).toMatch(/#card-revenue\s*\{[^}]*box-shadow/);
  });
});

describe('render', () => {
  it('renders login.dsl to a PNG Buffer >1KB', async () => {
    const { scene } = parse(loadDsl('login.dsl'));
    const html = dslToHtml(scene!);
    const png = await render(html, { width: scene!.screen.w, height: scene!.screen.h });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(1024);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }, 60_000);

  it('renders dashboard-card.dsl to a PNG Buffer >1KB', async () => {
    const { scene } = parse(loadDsl('dashboard-card.dsl'));
    const html = dslToHtml(scene!);
    const png = await render(html, { width: scene!.screen.w, height: scene!.screen.h });
    expect(png.length).toBeGreaterThan(1024);
  }, 60_000);
});
