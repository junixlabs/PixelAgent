import type { FastifyPluginAsync } from 'fastify';

export const synthesizeRoutes: FastifyPluginAsync = async (app) => {
  app.post('/synthesize', async (_req, reply) => {
    return reply.code(501).send({ error: 'not implemented' });
  });
};
