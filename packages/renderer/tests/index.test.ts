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

  it('REPEAT suffixes ids per iteration to avoid duplicates', () => {
    const dsl = `SCREEN 800 600\nREPEAT row 3 direction:column gap:8\n  RECT cell 0 0 200 40 bg:#eee\nEND\n`;
    const { scene } = parse(dsl);
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    // First iter keeps original id, subsequent get suffixed
    expect(html).toContain('id="cell"');
    expect(html).toContain('id="cell-1"');
    expect(html).toContain('id="cell-2"');
    // No id collision: each id appears in at most one element-opening position
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
  });

  it('REPEAT applies direction + gap as flex layout (regression)', () => {
    const dsl = `SCREEN 800 600\nREPEAT row 3 direction:column gap:8\n  RECT cell 0 0 200 40 bg:#eee\nEND\n`;
    const { scene } = parse(dsl);
    const html = dslToHtml(scene!);
    // Wrapper is a flex container so iterations stack instead of overlapping.
    expect(html).toMatch(
      /<div id="row" class="pa-flow pa-stack" style="flex-direction:column;gap:8px"/,
    );
  });

  it('REPEAT defaults direction to column when not specified', () => {
    const dsl = `SCREEN 800 600\nREPEAT row 2\n  RECT cell 0 0 200 40 bg:#eee\nEND\n`;
    const { scene } = parse(dsl);
    const html = dslToHtml(scene!);
    expect(html).toMatch(/style="flex-direction:column"/);
  });

  it('injects Google Fonts (Inter) link and sets Inter as the default font-family', () => {
    const { scene } = parse(loadDsl('login.dsl'));
    const html = dslToHtml(scene!);
    expect(html).toContain(
      'fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700',
    );
    expect(html).toMatch(/font-family:\s*Inter,/i);
  });

  it('emits <img src> for IMAGE nodes with a real URL (no grey placeholder bg)', () => {
    const dsl = `SCREEN 400 300\nIMAGE hero 0 0 400 300 "https://picsum.photos/400/300" fit:cover\n`;
    const { scene } = parse(dsl);
    const html = dslToHtml(scene!);
    expect(html).toMatch(
      /<img id="hero"[^>]*src="https:\/\/picsum\.photos\/400\/300"[^>]*>/,
    );
    // Should NOT carry the placeholder grey background on the real-src branch
    const heroFragment = /<img id="hero"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(heroFragment).not.toContain('#e5e7eb');
    expect(heroFragment).toContain('object-fit:cover');
  });

  it('falls back to grey placeholder <div> when IMAGE has empty src', () => {
    const dsl = `SCREEN 400 300\nIMAGE empty 0 0 400 300 "placeholder.png"\n`;
    const { scene } = parse(dsl);
    // Simulate empty/missing src to exercise placeholder branch
    const img = scene!.nodes.find((n) => n.type === 'image');
    if (img && img.type === 'image') img.src = '';
    const html = dslToHtml(scene!);
    expect(html).toMatch(/<div id="empty"[^>]*background:#e5e7eb"/);
    expect(html).not.toMatch(/<img id="empty"/);
  });

  it('TEXT align:center without maxWidth gets width:100% (auto-wrap)', () => {
    const dsl =
      `SCREEN 800 600\nLAYER l 0 0 400 100\n  TEXT t 0 0 "some longer headline that should wrap" align:center\nEND\n`;
    const { scene } = parse(dsl);
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    const spanStyle = /<span id="t"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(spanStyle).toContain('text-align:center');
    expect(spanStyle).toContain('width:100%');
  });

  it('TEXT with explicit max-width keeps fixed width (regression)', () => {
    const dsl =
      `SCREEN 800 600\nLAYER l 0 0 400 100\n  TEXT t 0 0 "headline" align:center max-width:300\nEND\n`;
    const { scene } = parse(dsl);
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    const spanStyle = /<span id="t"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(spanStyle).toContain('width:300px');
    expect(spanStyle).not.toContain('width:100%');
  });

  it('TEXT align:left without maxWidth does NOT get width style', () => {
    const dsl =
      `SCREEN 800 600\nLAYER l 0 0 400 100\n  TEXT t 0 0 "left text" align:left\nEND\n`;
    const { scene } = parse(dsl);
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    const spanStyle = /<span id="t"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(spanStyle).not.toMatch(/width:/);
  });

  it('theme:dark sets canvas bg/fg on .pa-screen and ghost inherits foreground', () => {
    const dsl = `SCREEN 800 600 theme:dark\nBUTTON g 10 10 120 40 "Ghost" variant:ghost\n`;
    const { scene } = parse(dsl);
    expect(scene).not.toBeNull();
    const html = dslToHtml(scene!);
    expect(html).toContain('.pa-screen { background:#111827; color:#E5E7EB; }');
    expect(html).toMatch(/\.pa-btn-ghost\s*\{[^}]*color:\s*inherit/);
  });

  it('theme:light emits no dark canvas block (regression)', () => {
    const { scene } = parse(loadDsl('login.dsl'));
    const html = dslToHtml(scene!);
    expect(html).not.toContain('#111827');
  });

  it('goto elements carry data-goto and the cursor CSS exists', () => {
    const dsl = `SCREEN 800 600\nBUTTON go 10 10 120 40 "Home" goto:home\n`;
    const { scene } = parse(dsl);
    const html = dslToHtml(scene!);
    expect(html).toMatch(/<button id="go"[^>]*data-goto="home"/);
    expect(html).toContain('[data-goto] { cursor: pointer; }');
    // navigation script only with the option
    expect(html).not.toContain('paGoto');
  });

  it('navigation option injects the postMessage script', () => {
    const dsl = `SCREEN 800 600\nBUTTON go 10 10 120 40 "Home" goto:home\n`;
    const { scene } = parse(dsl);
    const html = dslToHtml(scene!, { navigation: true });
    expect(html).toContain("closest('[data-goto]')");
    expect(html).toContain('paGoto');
  });

  it('omits the inspector overlay by default (PNG path stays byte-stable)', () => {
    const { scene } = parse(loadDsl('login.dsl'));
    const html = dslToHtml(scene!);
    expect(html).not.toContain('pa-inspector');
  });

  it('inspector option appends the click-to-id overlay after the screen div', () => {
    const { scene } = parse(loadDsl('login.dsl'));
    const html = dslToHtml(scene!, { inspector: true });
    expect(html).toContain('id="pa-inspector"');
    expect(html).toContain("closest('[id]')");
    expect(html.indexOf('id="pa-inspector"')).toBeGreaterThan(
      html.indexOf('class="pa-screen"'),
    );
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
