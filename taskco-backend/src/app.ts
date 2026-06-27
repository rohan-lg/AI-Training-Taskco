import Fastify, { type FastifyServerOptions } from 'fastify';
import { authRoutes } from './routes/auth.js';

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...opts });

  app.get('/', async () => {
    return { status: 'ok', message: 'Taskco backend is running' };
  });

  app.register(authRoutes);

  return app;
}
