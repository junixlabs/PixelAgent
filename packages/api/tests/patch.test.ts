import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

vi.mock('@pixelagent/renderer', async (orig) => {
  const actual = await orig<typeof import('@pixelagent/renderer')>();
  return {
    ...actual,
    render: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    closeRenderer: vi.fn(async () => undefined),
  };
});

const messagesCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: { create: messagesCreate },
  }));
  return { default: Anthropic };
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(__dirname, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

const { buildApp } = await import('../src/server.js');
const app = buildApp();

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

afterAll(async () => {
  await app.close();
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

const llmReturns = (text: string, usage = { input_tokens: 20, output_tokens: 8 }) => {
  messagesCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
    usage,
  });
};

describe('POST /patch', () => {
  beforeEach(() => {
    messagesCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('happy path: modify button bg → new_dsl contains new color', async () => {
    llmReturns(
      JSON.stringify([
        { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
      ]),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { dsl: loginDsl, instruction: 'make Sign in destructive' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.new_dsl).toContain('variant:destructive');
    expect(body.patch).toHaveLength(1);
    expect(body.patch[0].op).toBe('modify');
    expect(typeof body.tokens_used).toBe('number');
    expect(body.tokens_used).toBe(28);
    expect(typeof body.diff_png_base64).toBe('string');
    expect(body.diff_png_base64.length).toBeGreaterThan(0);
  });

  it('returns 400 when body missing dsl', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { instruction: 'do something' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 422 parse_failed when DSL has no SCREEN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { dsl: 'TOKEN primary #185FA5\n', instruction: 'change color' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('parse_failed');
  });

  it('returns 502 llm_invalid_output when LLM returns malformed JSON', async () => {
    llmReturns('not json at all');
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { dsl: loginDsl, instruction: 'whatever' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('llm_invalid_output');
  });

  it('returns 503 when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { dsl: loginDsl, instruction: 'whatever' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('anthropic_api_key_missing');
  });

  it('returns 422 patch_no_op when all ops reference unknown ids', async () => {
    llmReturns(
      JSON.stringify([
        { op: 'modify', id: 'ghost-node', field: 'bg', value: '#10B981' },
      ]),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/patch',
      payload: { dsl: loginDsl, instruction: 'change ghost' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('patch_no_op');
  });
});
