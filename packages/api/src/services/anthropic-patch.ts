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

const PatchOpSchema: z.ZodType<PatchOp> = z.union([
  z.object({
    op: z.literal('modify'),
    id: z.string(),
    field: z.string(),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({
    op: z.literal('remove'),
    id: z.string(),
  }),
  z.object({
    op: z.literal('add'),
    parentId: z.string().optional(),
    node: z.unknown(),
  }) as z.ZodType<PatchOp>,
]);

const PatchOpsSchema = z.array(PatchOpSchema);

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

const extractText = (
  response: Anthropic.Messages.Message,
): string => {
  const parts = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text);
  return parts.join('').trim();
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
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
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
