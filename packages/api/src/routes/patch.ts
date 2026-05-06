import type { FastifyPluginAsync } from 'fastify';

export const patchRoutes: FastifyPluginAsync = async (app) => {
  app.post('/patch', async (_req, reply) => {
    return reply.code(501).send({ error: 'not implemented' });
  });
};
