import { buildApp } from './server.js';

const port = Number(process.env.PORT ?? 3030);
const host = '0.0.0.0';

const app = buildApp();

const shutdown = async (signal: string) => {
  console.log(`received ${signal}, shutting down`);
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  const address = await app.listen({ port, host });
  console.log(`pixelagent api listening on ${address}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
