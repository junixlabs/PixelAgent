import Anthropic from '@anthropic-ai/sdk';
import { walkNodes, type PatchOp, type Scene } from '@pixelagent/parser';
import { z } from 'zod';

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured');
    this.name = 'MissingApiKeyError';
  }
}

export class LlmInvalidOutputError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'LlmInvalidOutputError';
  }
}

// Schema is structural-only — semantic validation (does the field exist on
// this node type? is the value in the enum?) happens in `applyPatch`, which
// owns the per-node-type rule table.
const NodeShapeSchema = z
  .object({ type: z.string(), id: z.string().optional(), targetId: z.string().optional() })
  .passthrough();

const PatchOpSchema: z.ZodType<PatchOp> = z.union([
  z.object({
    op: z.literal('modify'),
    id: z.string().min(1),
    field: z.string().min(1),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({
    op: z.literal('remove'),
    id: z.string().min(1),
  }),
  z.object({
    op: z.literal('add'),
    parentId: z.string().min(1).optional(),
    node: NodeShapeSchema,
  }) as unknown as z.ZodType<PatchOp>,
]);

const PatchOpsSchema = z.array(PatchOpSchema).max(32);

const SYSTEM_PROMPT =
  "You output ONLY a JSON array of patch ops. Schema: " +
  '{"op":"modify","id":"<id>","field":"<field>","value":<string|number>} ' +
  '| {"op":"add","parentId":"<id>","node":<AstNode>} ' +
  '| {"op":"remove","id":"<id>"}. ' +
  "Common fields: bg, color, label, text, variant, size, weight, x, y, w, h, r. " +
  "Colors are hex like #10B981. No prose, no code fences, no explanation.";

const summarizeScene = (scene: Scene): string => {
  const lines: string[] = [];
  walkNodes(scene.nodes, (n) => {
    if (n.type === 'fill' || n.type === 'state' || n.type === 'effect') return;
    const { type, id, ...rest } = n as { type: string; id: string } & Record<string, unknown>;
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (k === 'children') continue;
      props[k] = v;
    }
    lines.push(`- ${type} ${id} ${JSON.stringify(props)}`);
  });
  return lines.join('\n');
};

export interface GeneratePatchInput {
  scene: Scene;
  instruction: string;
  client?: Anthropic;
  apiKey?: string;
  model?: string;
}

export interface GeneratePatchOutput {
  ops: PatchOp[];
  tokensUsed: number;
}

const MAX_LLM_OUTPUT_CHARS = 8000;

const extractText = (response: Anthropic.Messages.Message): string => {
  const nonText = response.content.filter((b) => b.type !== 'text').length;
  if (nonText > 0 && response.content.every((b) => b.type !== 'text')) {
    throw new LlmInvalidOutputError(
      `LLM returned no text blocks (${nonText} non-text blocks)`,
      '',
    );
  }
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (text.length > MAX_LLM_OUTPUT_CHARS) {
    throw new LlmInvalidOutputError(
      `LLM output exceeds ${MAX_LLM_OUTPUT_CHARS} chars (${text.length})`,
      text.slice(0, 200),
    );
  }
  return text;
};

const stripFences = (s: string): string => {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return s;
};

export const generatePatchOps = async (
  input: GeneratePatchInput,
): Promise<GeneratePatchOutput> => {
  const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const client = input.client ?? (apiKey ? new Anthropic({ apiKey }) : null);
  if (!client) throw new MissingApiKeyError();

  const summary = summarizeScene(input.scene);
  const userMessage =
    `Instruction: ${input.instruction}\n\nCurrent screen elements:\n${summary}`;

  const response = await client.messages.create({
    model: input.model ?? 'claude-sonnet-4-6',
    max_tokens: 256,
    // Prompt cache requires ≥1024 tokens of cached content; SYSTEM_PROMPT is
    // ~80 tokens, so cache_control would not activate. Plain string system.
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = stripFences(extractText(response));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmInvalidOutputError('LLM did not return valid JSON', text);
  }
  const validation = PatchOpsSchema.safeParse(parsed);
  if (!validation.success) {
    throw new LlmInvalidOutputError(
      `LLM output failed schema validation: ${validation.error.message}`,
      text,
    );
  }

  const u = response.usage;
  const tokensUsed =
    (u?.input_tokens ?? 0) +
    (u?.output_tokens ?? 0) +
    (u?.cache_creation_input_tokens ?? 0) +
    (u?.cache_read_input_tokens ?? 0);

  return { ops: validation.data, tokensUsed };
};
