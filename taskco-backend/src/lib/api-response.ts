import type { FastifyReply } from 'fastify';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export function ok<T>(reply: FastifyReply, data: T, status = 200) {
  return reply.status(status).send({ data });
}

export function fail(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: { error: { code: ErrorCode; message: string; details?: unknown } } = {
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  return reply.status(status).send(body);
}
