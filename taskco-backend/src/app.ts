import Fastify, { type FastifyServerOptions } from 'fastify';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ logger: false, bodyLimit: 65_536, ...opts });

  app.get('/', async () => {
    return { status: 'ok', message: 'Taskco backend is running' };
  });

  app.register(authRoutes);
  app.register(projectRoutes);
  app.register(taskRoutes);

  return app;
}
