import type { FastifyPluginAsync } from 'fastify';
import { patchService } from '../services/patch.js';
import { dslField, instructionField } from '../schemas.js';

const bodySchema = {
  type: 'object',
  required: ['dsl', 'instruction'],
  additionalProperties: false,
  properties: {
    dsl: dslField,
    instruction: instructionField,
  },
} as const;

type PatchBody = { dsl: string; instruction: string };

export const patchRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PatchBody }>(
    '/patch',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const result = await patchService(req.body);
      if (!result.ok) {
        switch (result.kind) {
          case 'parse_failed':
            req.log.warn({ count: result.details.length }, 'patch parse_failed');
            return reply
              .code(422)
              .send({ error: 'parse_failed', details: result.details });
          case 'anthropic_api_key_missing':
            req.log.error('anthropic_api_key_missing');
            return reply.code(503).send({ error: 'anthropic_api_key_missing' });
          case 'llm_invalid_output':
            req.log.error({ message: result.message }, 'llm_invalid_output');
            return reply
              .code(502)
              .send({ error: 'llm_invalid_output', message: result.message });
          case 'llm_call_failed':
            req.log.error({ message: result.message }, 'llm_call_failed');
            return reply
              .code(502)
              .send({ error: 'llm_call_failed', message: result.message });
          case 'patch_no_op':
            req.log.warn({ errors: result.details }, 'patch_no_op');
            return reply
              .code(422)
              .send({ error: 'patch_no_op', details: result.details });
          case 'patch_invalid_result':
            req.log.error({ errors: result.details }, 'patch_invalid_result');
            return reply
              .code(422)
              .send({ error: 'patch_invalid_result', details: result.details });
          case 'render_failed':
            req.log.error({ message: result.message }, 'render_failed');
            return reply
              .code(500)
              .send({ error: 'render_failed', message: result.message });
        }
      }
      return reply.code(200).send({
        new_dsl: result.newDsl,
        patch: result.applied,
        diff_png_base64: result.png.toString('base64'),
        tokens_used: result.tokensUsed,
        warnings: result.applyWarnings,
      });
    },
  );
};
