import type { FastifyPluginAsync } from 'fastify';
import { applyPatch, parse, serialize } from '@pixelagent/parser';
import { dslToHtml, render } from '@pixelagent/renderer';
import {
  LlmInvalidOutputError,
  MissingApiKeyError,
  generatePatchOps,
} from '../services/anthropic-patch.js';

const bodySchema = {
  type: 'object',
  required: ['dsl', 'instruction'],
  additionalProperties: false,
  properties: {
    dsl: { type: 'string', minLength: 1 },
    instruction: { type: 'string', minLength: 1, maxLength: 2000 },
  },
} as const;

type PatchBody = { dsl: string; instruction: string };

export const patchRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PatchBody }>(
    '/patch',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const { dsl, instruction } = req.body;

      const { scene, warnings } = parse(dsl);
      const errors = warnings.filter((w) => w.severity === 'error');
      if (errors.length > 0 || scene == null) {
        return reply
          .code(422)
          .send({ error: 'parse_failed', details: errors });
      }

      let ops;
      let tokensUsed = 0;
      try {
        const out = await generatePatchOps({ scene, instruction });
        ops = out.ops;
        tokensUsed = out.tokensUsed;
      } catch (err) {
        if (err instanceof MissingApiKeyError) {
          return reply.code(503).send({ error: 'anthropic_api_key_missing' });
        }
        if (err instanceof LlmInvalidOutputError) {
          return reply
            .code(502)
            .send({ error: 'llm_invalid_output', message: err.message });
        }
        req.log.error({ err }, 'anthropic call failed');
        return reply
          .code(502)
          .send({ error: 'llm_call_failed', message: (err as Error).message });
      }

      const result = applyPatch(scene, ops);
      if (result.applied.length === 0 && result.errors.length > 0) {
        return reply
          .code(422)
          .send({ error: 'patch_no_op', details: result.errors });
      }

      const newDsl = serialize(result.scene);

      // Defensive re-parse: catches AST corruption from a `modify` writing an
      // illegal field or an `add` injecting a malformed node, before we render.
      const reparsed = parse(newDsl);
      const reparseErrors = reparsed.warnings.filter(
        (w) => w.severity === 'error',
      );
      if (reparseErrors.length > 0 || reparsed.scene == null) {
        return reply
          .code(422)
          .send({ error: 'patch_invalid_result', details: reparseErrors });
      }

      try {
        const html = dslToHtml(reparsed.scene);
        const png = await render(html, {
          width: reparsed.scene.screen.w,
          height: reparsed.scene.screen.h,
        });
        return reply.code(200).send({
          new_dsl: newDsl,
          patch: result.applied,
          diff_png_base64: png.toString('base64'),
          tokens_used: tokensUsed,
          warnings: result.errors,
        });
      } catch (err) {
        req.log.error({ err }, 'render failed');
        return reply.code(500).send({
          error: 'render_failed',
          message: (err as Error).message,
        });
      }
    },
  );
};
