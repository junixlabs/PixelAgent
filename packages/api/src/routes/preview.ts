import type { FastifyPluginAsync } from 'fastify';
import { previewService } from '../services/preview.js';
import { dslField } from '../schemas.js';

const bodySchema = {
  type: 'object',
  required: ['dsl'],
  additionalProperties: false,
  properties: {
    dsl: dslField,
    scale: { type: 'number', minimum: 0.1, maximum: 4, default: 1.0 },
    format: { type: 'string', enum: ['png', 'html'], default: 'png' },
  },
} as const;

type PreviewBody = { dsl: string; scale?: number; format?: 'png' | 'html' };

export const previewRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PreviewBody }>(
    '/preview',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const result = await previewService(req.body);
      if (!result.ok) {
        if (result.kind === 'parse_failed') {
          req.log.warn({ count: result.errors.length }, 'preview parse_failed');
          return reply.code(422).send({
            error: 'parse_failed',
            errors: result.errors,
            warnings: result.warnings,
          });
        }
        req.log.error({ message: result.message }, 'render_failed');
        return reply
          .code(500)
          .send({ error: 'render_failed', message: result.message });
      }
      if (result.format === 'html') {
        return reply.code(200).send({
          html: result.html,
          render_ms: result.renderMs,
          warnings: result.warnings,
        });
      }
      return reply.code(200).send({
        png_base64: result.png.toString('base64'),
        render_ms: result.renderMs,
        warnings: result.warnings,
      });
    },
  );
};
