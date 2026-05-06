import type { FastifyPluginAsync } from 'fastify';

export const previewRoutes: FastifyPluginAsync = async (app) => {
  app.post('/preview', async (_req, reply) => {
    return reply.code(501).send({ error: 'not implemented' });
  });
};
