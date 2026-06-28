import 'dotenv/config';
import { buildApp } from './app.js';

// Fail fast — a missing or weak JWT_SECRET means any token can be forged
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET env var is missing or shorter than 32 characters. Refusing to start.');
  process.exit(1);
}

const server = buildApp({ logger: true });

const start = async () => {
  try {
    const host = process.env.HOST ?? '127.0.0.1';
    const port = Number(process.env.PORT ?? 3000);
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
