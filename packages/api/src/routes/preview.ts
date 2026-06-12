import type { FastifyPluginAsync } from 'fastify';
import { previewBundleService, previewService } from '../services/preview.js';
import { dslField } from '../schemas.js';

const bodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dsl: dslField,
    scale: { type: 'number', minimum: 0.1, maximum: 4, default: 1.0 },
    format: { type: 'string', enum: ['png', 'html'] },
    screens: {
      type: 'object',
      minProperties: 1,
      additionalProperties: { type: 'string', minLength: 1 },
    },
    entry: { type: 'string', minLength: 1 },
  },
  anyOf: [{ required: ['dsl'] }, { required: ['screens', 'entry'] }],
} as const;

type PreviewBody = {
  dsl?: string;
  scale?: number;
  format?: 'png' | 'html';
  screens?: Record<string, string>;
  entry?: string;
};

export const previewRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PreviewBody }>(
    '/preview',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      if (req.body.screens !== undefined) {
        if (req.body.dsl !== undefined) {
          return reply.code(400).send({
            error: 'bad_request',
            message: 'provide either dsl or screens, not both',
          });
        }
        const result = await previewBundleService({
          screens: req.body.screens,
          entry: req.body.entry as string,
          format: req.body.format ?? 'html',
          scale: req.body.scale,
        });
        if (!result.ok) {
          if (result.kind === 'parse_failed') {
            req.log.warn(
              { screen: result.screenId, count: result.errors.length },
              'bundle parse_failed',
            );
            return reply.code(422).send({
              error: 'parse_failed',
              screen: result.screenId,
              errors: result.errors,
              warnings: result.warnings,
            });
          }
          if (result.kind === 'bad_bundle') {
            return reply
              .code(422)
              .send({ error: 'bad_bundle', message: result.message });
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
          pngs_base64: Object.fromEntries(
            Object.entries(result.pngs).map(([id, png]) => [
              id,
              png.toString('base64'),
            ]),
          ),
          render_ms: result.renderMs,
          warnings: result.warnings,
        });
      }

      const result = await previewService({
        dsl: req.body.dsl as string,
        scale: req.body.scale,
        format: req.body.format,
      });
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
