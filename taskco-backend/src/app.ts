import Fastify, { type FastifyServerOptions } from 'fastify';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, ...opts });

  app.get('/', async () => {
    return { status: 'ok', message: 'Taskco backend is running' };
  });

  app.register(authRoutes);
  app.register(projectRoutes);

  return app;
}
