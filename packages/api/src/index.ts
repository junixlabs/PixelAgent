import { buildApp } from './server.js';

const port = Number(process.env.PORT ?? 3030);
const host = '0.0.0.0';

const app = buildApp();
app.listen({ port, host }).then((address) => {
  console.log(`pixelagent api listening on ${address}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
