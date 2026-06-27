import 'dotenv/config';
import Fastify from 'fastify';
import { authRoutes } from './routes/auth.js';

const server = Fastify({ logger: true });

server.get('/', async () => {
  return { status: 'ok', message: 'Taskco backend is running' };
});

server.register(authRoutes);

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
