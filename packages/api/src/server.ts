import Fastify, { type FastifyInstance } from 'fastify';
import { closeRenderer } from '@pixelagent/renderer';
import { previewRoutes } from './routes/preview.js';
import { patchRoutes } from './routes/patch.js';
import { applyPatchRoutes } from './routes/apply-patch.js';
import { synthesizeRoutes } from './routes/synthesize.js';

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(previewRoutes);
  app.register(patchRoutes);
  app.register(applyPatchRoutes);
  app.register(synthesizeRoutes);

  app.addHook('onClose', async () => {
    await closeRenderer();
  });

  return app;
};
