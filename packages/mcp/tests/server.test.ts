import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

vi.mock('@pixelagent/renderer', async (orig) => {
  const actual = await orig<typeof import('@pixelagent/renderer')>();
  return {
    ...actual,
    render: vi.fn(async () =>
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
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

const { buildMcpServer } = await import('../src/server.js');

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

const callTool = async (
  server: ReturnType<typeof buildMcpServer>,
  name: string,
  args: Record<string, unknown>,
) => {
  // McpServer has a private `_registeredTools` map keyed by tool name; reach
  // into it for unit-testing tool handlers without spinning up a full stdio
  // transport. Tests assert on the same shape the SDK delivers.
  const tools = (server as unknown as {
    _registeredTools: Record<string, { handler: Function }>;
  })._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`tool ${name} not registered`);
  return tool.handler(args, {});
};

describe('MCP server', () => {
  beforeEach(() => {
    messagesCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('registers pixelagent_preview and pixelagent_patch', () => {
    const server = buildMcpServer();
    const tools = (server as unknown as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools;
    expect(Object.keys(tools).sort()).toEqual([
      'pixelagent_patch',
      'pixelagent_preview',
    ]);
  });

  it('preview returns image content for valid DSL', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      dsl: loginDsl,
    });
    expect(result.isError).toBeFalsy();
    expect(Array.isArray(result.content)).toBe(true);
    const image = result.content.find((c: { type: string }) => c.type === 'image');
    expect(image).toBeDefined();
    expect(image.mimeType).toBe('image/png');
    expect(typeof image.data).toBe('string');
    expect(image.data.length).toBeGreaterThan(0);
  });

  it('preview returns isError for parse failure', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      dsl: 'TOKEN primary #185FA5\n',
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('parse_failed');
  });

  it('patch returns isError when LLM returns malformed JSON', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_patch', {
      dsl: loginDsl,
      instruction: 'whatever',
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('llm_invalid_output');
  });

  it('patch happy path returns image + new_dsl in text', async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
          ]),
        },
      ],
      usage: { input_tokens: 20, output_tokens: 8 },
    });
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_patch', {
      dsl: loginDsl,
      instruction: 'make Sign in destructive',
    });
    expect(result.isError).toBeFalsy();
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('variant:destructive');
    expect(text.text).toContain('28 tokens used');
  });

  it('patch returns isError when ANTHROPIC_API_KEY unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_patch', {
      dsl: loginDsl,
      instruction: 'whatever',
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('anthropic_api_key_missing');
  });
});
