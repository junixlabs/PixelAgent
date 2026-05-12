import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from '@pixelagent/parser';
import { mergeProjectTokens } from '../src/services/load-tokens-dsl.js';

const cleanups: string[] = [];
const originalCwd = process.cwd();

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'pa-tokens-'));
  cleanups.push(dir);
  return dir;
};

afterEach(() => {
  process.chdir(originalCwd);
});

afterAll(async () => {
  for (const dir of cleanups) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

describe('mergeProjectTokens (unit)', () => {
  it('returns userDsl unchanged when tokens.dsl is missing', async () => {
    const dir = await makeTempDir();
    const userDsl = 'SCREEN 100 100\n';
    const out = await mergeProjectTokens(userDsl, dir);
    expect(out).toBe(userDsl);
  });

  it('injects tokens.dsl lines after SCREEN when no conflict', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'tokens.dsl'), 'TOKEN brand #ff0000\n');
    const userDsl = 'SCREEN 100 100\nRECT box 0 0 10 10 bg:$brand\n';
    const out = await mergeProjectTokens(userDsl, dir);
    expect(out).toContain('SCREEN 100 100');
    expect(out).toContain('TOKEN brand #ff0000');
    const screenIdx = out.indexOf('SCREEN 100 100');
    const tokenIdx = out.indexOf('TOKEN brand #ff0000');
    const rectIdx = out.indexOf('RECT box');
    expect(screenIdx).toBeLessThan(tokenIdx);
    expect(tokenIdx).toBeLessThan(rectIdx);
  });

  it('filters tokens redefined in user DSL (user wins)', async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, 'tokens.dsl'),
      'TOKEN brand #ff0000\nTOKEN accent #00ff00\n',
    );
    const userDsl = 'SCREEN 100 100\nTOKEN brand #0000ff\n';
    const out = await mergeProjectTokens(userDsl, dir);
    expect(out).not.toContain('TOKEN brand #ff0000');
    expect(out).toContain('TOKEN brand #0000ff');
    expect(out).toContain('TOKEN accent #00ff00');
  });

  it('merged DSL parses with the injected token reflected in scene.tokens', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'tokens.dsl'), 'TOKEN brand #ff0000\n');
    const userDsl = 'SCREEN 100 100\nRECT box 0 0 10 10 bg:$brand\n';
    const merged = await mergeProjectTokens(userDsl, dir);
    const { scene, warnings } = parse(merged);
    expect(scene).not.toBeNull();
    expect(scene!.tokens.find((t) => t.id === 'brand')?.value).toBe('#ff0000');
    expect(warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });
});

describe('mergeProjectTokens (cwd-driven)', () => {
  it('uses process.cwd() by default', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'tokens.dsl'), 'TOKEN brand #ff0000\n');
    process.chdir(dir);
    const userDsl = 'SCREEN 100 100\n';
    const out = await mergeProjectTokens(userDsl);
    expect(out).toContain('TOKEN brand #ff0000');
  });

  it('no-op when tokens.dsl is absent in cwd', async () => {
    const dir = await makeTempDir();
    process.chdir(dir);
    const userDsl = 'SCREEN 100 100\n';
    const out = await mergeProjectTokens(userDsl);
    expect(out).toBe(userDsl);
  });
});
