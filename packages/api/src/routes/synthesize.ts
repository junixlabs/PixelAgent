import type { FastifyPluginAsync } from 'fastify';
import { synthesizeService } from '../services/synthesize.js';
import { dslField } from '../schemas.js';

const bodySchema = {
  type: 'object',
  required: ['dsl', 'target'],
  additionalProperties: false,
  properties: {
    dsl: dslField,
    target: { type: 'string', enum: ['react'] },
  },
} as const;

type SynthesizeBody = { dsl: string; target: 'react' };

export const synthesizeRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: SynthesizeBody }>(
    '/synthesize',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const result = await synthesizeService(req.body);
      if (!result.ok) {
        return reply
          .code(422)
          .send({ error: 'parse_failed', errors: result.errors });
      }
      return reply.code(200).send({
        code: result.code,
        warnings: result.warnings,
      });
    },
  );
};
