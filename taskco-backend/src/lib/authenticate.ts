import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './auth.js';
import { fail } from './api-response.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return fail(reply, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    request.user = await verifyJwt(token);
  } catch {
    return fail(reply, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }
}
