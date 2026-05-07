import type { FastifyPluginAsync } from 'fastify';
import { parse } from '@pixelagent/parser';
import { dslToHtml, render } from '@pixelagent/renderer';

const bodySchema = {
  type: 'object',
  required: ['dsl'],
  additionalProperties: false,
  properties: {
    dsl: { type: 'string', minLength: 1 },
    scale: { type: 'number', minimum: 0.1, maximum: 4, default: 1.0 },
  },
} as const;

type PreviewBody = { dsl: string; scale?: number };

export const previewRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PreviewBody }>(
    '/preview',
    { schema: { body: bodySchema } },
    async (req, reply) => {
      const { dsl, scale = 1.0 } = req.body;

      const { scene, warnings } = parse(dsl);
      const errors = warnings.filter((w) => w.severity === 'error');
      const warns = warnings.filter((w) => w.severity === 'warning');

      if (errors.length > 0 || scene == null) {
        return reply.code(400).send({ errors, warnings: warns });
      }

      const start = performance.now();
      try {
        const html = dslToHtml(scene);
        const png = await render(html, {
          width: scene.screen.w,
          height: scene.screen.h,
          deviceScaleFactor: scale,
        });
        const render_ms = Math.round(performance.now() - start);
        return reply.code(200).send({
          png_base64: png.toString('base64'),
          render_ms,
          errors: [],
          warnings: warns,
        });
      } catch (err) {
        req.log.error({ err }, 'render failed');
        return reply.code(500).send({
          error: 'render failed',
          message: (err as Error).message,
        });
      }
    },
  );
};
