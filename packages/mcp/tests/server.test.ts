import { afterAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const tmpPng = () => join(tmpdir(), `pa-${randomUUID()}.png`);

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

  it('preview writes PNG to outPath when provided', async () => {
    const server = buildMcpServer();
    const outPath = tmpPng();
    try {
      const result = await callTool(server, 'pixelagent_preview', {
        dsl: loginDsl,
        outPath,
      });
      expect(result.isError).toBeFalsy();
      const image = result.content.find(
        (c: { type: string }) => c.type === 'image',
      );
      expect(image.mimeType).toBe('image/png');
      const text = result.content.find(
        (c: { type: string }) => c.type === 'text',
      );
      expect(text.text).toContain(`Wrote PNG to ${outPath}`);
      const bytes = readFileSync(outPath);
      expect(Array.from(bytes.subarray(0, 8))).toEqual(PNG_MAGIC);
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath);
    }
  });

  it('apply_patch writes PNG to outPath when provided', async () => {
    const server = buildMcpServer();
    const outPath = tmpPng();
    try {
      const result = await callTool(server, 'pixelagent_apply_patch', {
        dsl: loginDsl,
        ops: [
          { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
        ],
        outPath,
      });
      expect(result.isError).toBeFalsy();
      const image = result.content.find(
        (c: { type: string }) => c.type === 'image',
      );
      expect(image.mimeType).toBe('image/png');
      const text = result.content.find(
        (c: { type: string }) => c.type === 'text',
      );
      expect(text.text).toContain(`Wrote PNG to ${outPath}`);
      const bytes = readFileSync(outPath);
      expect(Array.from(bytes.subarray(0, 8))).toEqual(PNG_MAGIC);
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath);
    }
  });

  it.each([
    { label: 'relative path', outPath: './foo.png', expect: 'must be absolute' },
    { label: 'parent traversal', outPath: '/tmp/../etc/foo.png', expect: '..' },
    { label: 'wrong extension', outPath: '/tmp/foo.jpg', expect: '.png' },
  ])('preview rejects invalid outPath ($label)', async ({ outPath, expect: needle }) => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      dsl: loginDsl,
      outPath,
    });
    expect(result.isError).toBe(true);
    const text = result.content.find(
      (c: { type: string }) => c.type === 'text',
    );
    expect(text.text).toContain('outPath_failed');
    expect(text.text).toContain(needle);
    expect(existsSync(outPath)).toBe(false);
  });

  it.runIf(process.platform !== 'win32')(
    'preview surfaces FS error when parent dir cannot be created',
    async () => {
      const server = buildMcpServer();
      const outPath = '/dev/null/sub/foo.png';
      const result = await callTool(server, 'pixelagent_preview', {
        dsl: loginDsl,
        outPath,
      });
      expect(result.isError).toBe(true);
      const text = result.content.find(
        (c: { type: string }) => c.type === 'text',
      );
      expect(text.text).toContain('outPath_failed');
      expect(existsSync(outPath)).toBe(false);
    },
  );

  it('preview outPath .html writes interactive HTML and returns text-only content', async () => {
    const server = buildMcpServer();
    const outPath = join(tmpdir(), `pa-${randomUUID()}.html`);
    try {
      const result = await callTool(server, 'pixelagent_preview', {
        dsl: loginDsl,
        outPath,
      });
      expect(result.isError).toBeFalsy();
      const html = readFileSync(outPath, 'utf-8');
      expect(html).toContain('<!doctype html');
      expect(html).toContain('id="pa-inspector"');
      // HTML mode skips Chrome — no image block, text only.
      const types = result.content.map((c: { type: string }) => c.type);
      expect(types).toEqual(['text']);
      expect(result.content[0].text).toContain(
        `Wrote interactive HTML preview to ${outPath}`,
      );
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath);
    }
  });

  it('preview rejects relative .html outPath', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      dsl: loginDsl,
      outPath: './foo.html',
    });
    expect(result.isError).toBe(true);
    const text = result.content.find(
      (c: { type: string }) => c.type === 'text',
    );
    expect(text.text).toContain('outPath_failed');
    expect(text.text).toContain('must be absolute');
  });

  it('preview screens bundle writes navigable HTML to outPath', async () => {
    const server = buildMcpServer();
    const outPath = join(tmpdir(), `pa-${randomUUID()}.html`);
    try {
      const result = await callTool(server, 'pixelagent_preview', {
        screens: {
          login: 'SCREEN 400 300\nBUTTON to-home 10 10 120 40 "Go" goto:home\n',
          home: 'SCREEN 400 300\nTEXT hi 10 10 "Welcome"\n',
        },
        entry: 'login',
        outPath,
      });
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('2-screen bundle');
      const html = readFileSync(outPath, 'utf-8');
      expect(html).toContain('data-screen="login"');
      expect(html).toContain('data-screen="home"');
    } finally {
      if (existsSync(outPath)) unlinkSync(outPath);
    }
  });

  it('preview screens bundle requires an .html outPath', async () => {
    const server = buildMcpServer();
    const result = await callTool(server, 'pixelagent_preview', {
      screens: { login: 'SCREEN 400 300\nTEXT t 10 10 "hi"\n' },
      entry: 'login',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('.html');
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
