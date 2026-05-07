#!/usr/bin/env node
/**
 * Simulates a real MCP host (Claude Code, Cursor) talking to PixelAgent's
 * stdio MCP server. Spawns the server, connects via the MCP SDK client,
 * runs a 1-draft-+-2-edit UI session, and saves every rendered PNG plus
 * the synthesized React code so you can flip through the artifacts.
 *
 * No ANTHROPIC_API_KEY needed — the host-side LLM (would-be Claude Code)
 * is the one composing ops; this walkthrough hard-codes them so the test
 * is fully deterministic and free.
 *
 * Run from repo root:
 *   node scripts/mcp-walkthrough.mjs
 *
 * Outputs land in `./.mcp-walkthrough/` (gitignored).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..');
const OUT = resolve(REPO, '.mcp-walkthrough');
mkdirSync(OUT, { recursive: true });

const log = (...args) => console.log('[agent]', ...args);
const banner = (s) => console.log(`\n=== ${s} ===`);

const extractText = (result) =>
  (result.content ?? []).find((c) => c.type === 'text')?.text ?? '';
const extractImage = (result) =>
  (result.content ?? []).find((c) => c.type === 'image');

const savePng = (name, image) => {
  if (!image) return null;
  const path = resolve(OUT, name);
  writeFileSync(path, Buffer.from(image.data, 'base64'));
  return path;
};

const main = async () => {
  banner('1. Spawn MCP server and connect (like Claude Code does)');
  const transport = new StdioClientTransport({
    command: resolve(REPO, 'node_modules/.bin/tsx'),
    args: [resolve(REPO, 'packages/mcp/src/index.ts')],
    cwd: REPO,
    env: process.env,
  });
  const client = new Client(
    { name: 'mcp-walkthrough', version: '0.0.1' },
    { capabilities: {} },
  );
  await client.connect(transport);
  log('connected');

  banner('2. List tools (agent discovers what it can do)');
  const { tools } = await client.listTools();
  for (const t of tools) {
    log(`  • ${t.name} — ${(t.description ?? '').slice(0, 80)}…`);
  }

  banner('3. Read the grammar resource (agent reads the spec)');
  const grammar = await client.readResource({ uri: 'pixelagent://grammar' });
  log(
    'grammar text length:',
    grammar.contents[0].text.length,
    'chars (head):',
    grammar.contents[0].text.split('\n').slice(0, 3).join(' / '),
  );

  banner('4. Initial preview — agent emits DSL for a login screen');
  const loginDsl = readFileSync(
    resolve(REPO, 'packages/dsl-spec/examples/login.dsl'),
    'utf-8',
  );
  const t0 = Date.now();
  const preview = await client.callTool({
    name: 'pixelagent_preview',
    arguments: { dsl: loginDsl },
  });
  if (preview.isError) {
    console.error('PREVIEW FAILED:', extractText(preview));
    process.exit(1);
  }
  log(`render took ${Date.now() - t0}ms (${extractText(preview)})`);
  log('PNG saved →', savePng('step1-initial.png', extractImage(preview)));

  banner('5. User: "make Sign in red" — agent emits 1 patch op');
  const op1 = [
    { op: 'modify', id: 'login-btn', field: 'variant', value: 'destructive' },
  ];
  const tokensFor = (obj) => JSON.stringify(obj).length / 4;
  log(`op (~${tokensFor(op1).toFixed(0)} tokens):`, JSON.stringify(op1));
  const t1 = Date.now();
  const patch1 = await client.callTool({
    name: 'pixelagent_apply_patch',
    arguments: { dsl: loginDsl, ops: op1 },
  });
  if (patch1.isError) {
    console.error('PATCH 1 FAILED:', extractText(patch1));
    process.exit(1);
  }
  const patch1Text = extractText(patch1);
  const newDslAfter1 = patch1Text.split('New DSL:\n')[1];
  log(`patch+rerender: ${Date.now() - t1}ms — ${patch1Text.split('\n')[0]}`);
  log('PNG saved →', savePng('step2-destructive.png', extractImage(patch1)));

  banner('6. User: "forgot link + bigger radius" — agent emits 2 ops');
  const op2 = [
    {
      op: 'add',
      parentId: 'login-card',
      node: {
        type: 'text',
        id: 'forgot-link',
        x: 32,
        y: 290,
        text: 'Forgot password?',
        size: 12,
        color: '$primary',
        align: 'left',
        maxWidth: 376,
      },
    },
    { op: 'modify', id: 'login-card', field: 'r', value: 20 },
  ];
  log(`ops (~${tokensFor(op2).toFixed(0)} tokens)`);
  const t2 = Date.now();
  const patch2 = await client.callTool({
    name: 'pixelagent_apply_patch',
    arguments: { dsl: newDslAfter1, ops: op2 },
  });
  if (patch2.isError) {
    console.error('PATCH 2 FAILED:', extractText(patch2));
    process.exit(1);
  }
  const patch2Text = extractText(patch2);
  const newDslAfter2 = patch2Text.split('New DSL:\n')[1];
  log(`patch+rerender: ${Date.now() - t2}ms — ${patch2Text.split('\n')[0]}`);
  log(
    'PNG saved →',
    savePng('step3-with-forgot-link.png', extractImage(patch2)),
  );
  writeFileSync(resolve(OUT, 'final.dsl'), newDslAfter2);

  banner('7. User approves — agent calls pixelagent_synthesize for code');
  const t3 = Date.now();
  const synth = await client.callTool({
    name: 'pixelagent_synthesize',
    arguments: { dsl: newDslAfter2, target: 'react' },
  });
  if (synth.isError) {
    console.error('SYNTHESIZE FAILED:', extractText(synth));
    process.exit(1);
  }
  const synthText = extractText(synth);
  const code = synthText.split('\n\n').slice(1).join('\n\n');
  writeFileSync(resolve(OUT, 'GeneratedScreen.tsx'), code);
  log(`synthesize: ${Date.now() - t3}ms — ${synthText.split('\n')[0]}`);
  log('TSX saved →', resolve(OUT, 'GeneratedScreen.tsx'));

  banner('8. Negative test — agent emits a bad op (unknown id)');
  const badPatch = await client.callTool({
    name: 'pixelagent_apply_patch',
    arguments: {
      dsl: newDslAfter2,
      ops: [{ op: 'modify', id: 'nope', field: 'bg', value: '#000000' }],
    },
  });
  log('isError:', badPatch.isError);
  log('server text:', extractText(badPatch).split('\n').slice(0, 3).join(' | '));

  banner('9. Token-cost recap (this session)');
  const initialDslTokens = loginDsl.length / 4;
  const reactPerEmit = 400;
  const op1Tokens = tokensFor(op1);
  const op2Tokens = tokensFor(op2);
  const totalDsl = initialDslTokens + op1Tokens + op2Tokens;
  const totalReact = reactPerEmit * 3;
  console.log(
    `  initial draft:  DSL ~${initialDslTokens.toFixed(0)} tok   vs   React ~${reactPerEmit} tok`,
  );
  console.log(
    `  edit 1:         op  ~${op1Tokens.toFixed(0)} tok    vs   React re-emit ~${reactPerEmit} tok`,
  );
  console.log(
    `  edit 2:         ops ~${op2Tokens.toFixed(0)} tok   vs   React re-emit ~${reactPerEmit} tok`,
  );
  console.log(
    `  session total:  DSL+ops ~${totalDsl.toFixed(0)} tok   vs   React ~${totalReact} tok   ` +
      `→ saved ${(((totalReact - totalDsl) / totalReact) * 100).toFixed(0)}%`,
  );

  banner('10. Cleanup');
  await client.close();
  log('artifacts in', OUT);
};

main().catch((err) => {
  console.error('walkthrough failed:', err);
  process.exit(1);
});
