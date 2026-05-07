import type { FastifyPluginAsync } from 'fastify';
import { applyPatchService } from '../services/apply-patch.js';
import { dslField } from '../schemas.js';

const bodySchema = {
  type: 'object',
  required: ['dsl', 'ops'],
  additionalProperties: false,
  properties: {
    dsl: dslField,
    ops: {
      type: 'array',
      minItems: 1,
      maxItems: 32,
      items: {
        type: 'object',
        // Loose at the schema layer; the service runs the real per-node
        // validation (MODIFY_RULES + validateAddNode) and returns
        // structured warnings for ops that don't apply.
        additionalProperties: true,
      },
    },
  },
} as const;

type ApplyPatchBody = { dsl: string; ops: unknown[] };

export const applyPatchRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ApplyPatchBody }>(
    '/apply-patch',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const result = await applyPatchService({
        dsl: req.body.dsl,
        // Cast: the parser's PatchOp shape is enforced inside the service
        // by validateAddNode + MODIFY_RULES; the JSON-schema layer just
        // gates blatant garbage (non-array, empty, oversized).
        ops: req.body.ops as never,
      });
      if (!result.ok) {
        switch (result.kind) {
          case 'parse_failed':
            req.log.warn({ count: result.errors.length }, 'apply-patch parse_failed');
            return reply
              .code(422)
              .send({ error: 'parse_failed', errors: result.errors });
          case 'patch_no_op':
            req.log.warn({ errors: result.errors }, 'patch_no_op');
            return reply
              .code(422)
              .send({ error: 'patch_no_op', errors: result.errors });
          case 'patch_invalid_result':
            req.log.error({ errors: result.errors }, 'patch_invalid_result');
            return reply
              .code(422)
              .send({ error: 'patch_invalid_result', errors: result.errors });
          case 'render_failed':
            req.log.error({ message: result.message }, 'render_failed');
            return reply
              .code(500)
              .send({ error: 'render_failed', message: result.message });
        }
      }
      return reply.code(200).send({
        new_dsl: result.newDsl,
        applied: result.applied,
        png_base64: result.png.toString('base64'),
        warnings: result.applyWarnings,
      });
    },
  );
};
