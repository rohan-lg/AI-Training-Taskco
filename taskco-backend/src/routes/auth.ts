import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from '../lib/validations/auth.schema.js';
import { registerUser, loginUser } from '../services/auth.service.js';
import { ok, fail } from '../lib/api-response.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    try {
      const result = await registerUser(parsed.data);
      return ok(reply, result, 201);
    } catch (err: unknown) {
      if (isPrismaUniqueViolation(err)) {
        return fail(reply, 'CONFLICT', 'Email already exists', 409);
      }
      fastify.log.error(err);
      return fail(reply, 'INTERNAL', 'Internal server error', 500);
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    try {
      const result = await loginUser(parsed.data);
      if (!result) {
        return fail(reply, 'UNAUTHORIZED', 'Invalid email or password', 401);
      }
      return ok(reply, result);
    } catch (err: unknown) {
      fastify.log.error(err);
      return fail(reply, 'INTERNAL', 'Internal server error', 500);
    }
  });
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}
