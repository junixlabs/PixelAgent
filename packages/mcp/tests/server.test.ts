import { afterAll, describe, expect, it, vi } from 'vitest';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginDsl = readFileSync(
  resolve(__dirname, '../../dsl-spec/examples/login.dsl'),
  'utf-8',
);

const { buildMcpServer } = await import('../src/server.js');

afterAll(() => {});

const callTool = async (
  server: ReturnType<typeof buildMcpServer>,
  name: string,
  args: Record<string, unknown>,
) => {
  // Reach into McpServer's internal tool map for unit testing without
  // spinning up a stdio transport. Same response shape as the SDK delivers.
  const tools = (server as unknown as {
    _registeredTools: Record<string, { handler: Function }>;
  })._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`tool ${name} not registered`);
  return tool.handler(args, {});
};

const readResource = async (
  server: ReturnType<typeof buildMcpServer>,
  uri: string,
) => {
  const resources = (server as unknown as {
    _registeredResources: Record<string, { readCallback: Function }>;
  })._registeredResources;
  const resource = resources[uri];
  if (!resource) throw new Error(`resource ${uri} not registered`);
  return resource.readCallback(new URL(uri), {});
};

describe('MCP server — primitive tools (no LLM)', () => {
  it('registers preview + apply_patch + synthesize tools and grammar resource', () => {
    const server = buildMcpServer();
    const tools = (server as unknown as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools;
    expect(Object.keys(tools).sort()).toEqual([
      'pixelagent_apply_patch',
      'pixelagent_preview',
      'pixelagent_synthesize',
    ]);
    const resources = (server as unknown as {
      _registeredResources: Record<string, unknown>;
    })._registeredResources;
    expect(Object.keys(resources)).toContain('pixelagent://grammar');
  });

  it('grammar resource returns the DSL reference', async () => {
    const server = buildMcpServer();
    const result = await readResource(server, 'pixelagent://grammar');
    expect(Array.isArray(result.contents)).toBe(true);
    expect(result.contents[0].mimeType).toBe('text/markdown');
    expect(result.contents[0].text).toContain('PixelAgent DSL');
    expect(result.contents[0].text).toContain('pixelagent_apply_patch');
  });

  it('preview returns image content for valid DSL', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      dsl: loginDsl,
    });
    expect(result.isError).toBeFalsy();
    const image = result.content.find((c: { type: string }) => c.type === 'image');
    expect(image.mimeType).toBe('image/png');
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

  it('apply_patch happy path: modify variant', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_apply_patch', {
      dsl: loginDsl,
      ops: [
        { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
      ],
    });
    expect(result.isError).toBeFalsy();
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('Applied 1 op');
    expect(text.text).toContain('variant:destructive');
    const image = result.content.find((c: { type: string }) => c.type === 'image');
    expect(image.mimeType).toBe('image/png');
  });

  it('apply_patch returns isError when all ops reference unknown ids', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_apply_patch', {
      dsl: loginDsl,
      ops: [
        { op: 'modify', id: 'ghost', field: 'bg', value: '#ff0000' },
      ],
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('patch_no_op');
  });

  it('apply_patch returns isError when DSL fails to parse', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_apply_patch', {
      dsl: 'TOKEN x #fff\n',
      ops: [{ op: 'modify', id: 'x', field: 'value', value: '#000' }],
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('parse_failed');
  });

  it('synthesize emits React code from valid DSL', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_synthesize', {
      dsl: loginDsl,
    });
    expect(result.isError).toBeFalsy();
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('Synthesized');
    expect(text.text).toContain('export default function');
    expect(text.text).toContain('>Sign in</button>');
    expect(text.text).toContain('bg-[#185FA5]');
  });

  it('synthesize defaults target to "react" when omitted', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_synthesize', {
      dsl: loginDsl,
    });
    expect(result.isError).toBeFalsy();
  });

  it('synthesize returns isError for parse failure', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_synthesize', {
      dsl: 'TOKEN x #fff\n',
    });
    expect(result.isError).toBe(true);
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('parse_failed');
  });

  it('apply_patch supports remove + add ops', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_apply_patch', {
      dsl: loginDsl,
      ops: [
        { op: 'remove', id: 'pwd-input' },
        {
          op: 'add',
          parentId: 'login-card',
          node: {
            type: 'text',
            id: 'forgot',
            x: 32,
            y: 320,
            text: 'Forgot password?',
            size: 12,
          },
        },
      ],
    });
    expect(result.isError).toBeFalsy();
    const text = result.content.find((c: { type: string }) => c.type === 'text');
    expect(text.text).toContain('Applied 2 op');
    expect(text.text).toContain('forgot');
    expect(text.text).not.toContain('pwd-input');
  });
});
