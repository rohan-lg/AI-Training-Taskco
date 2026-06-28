import type { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/authenticate.js';
import { ok, fail } from '../lib/api-response.js';
import { createProjectSchema, updateProjectSchema } from '../lib/validations/project.schema.js';
import {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../services/project.service.js';

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.post('/projects', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
    }
    try {
      const project = await createProject(request.user.userId, parsed.data);
      return ok(reply, { project }, 201);
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to create project', 500);
    }
  });

  fastify.get('/projects', { preHandler: authenticate }, async (request, reply) => {
    try {
      const projects = await listProjects(request.user.userId);
      return ok(reply, { projects });
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to list projects', 500);
    }
  });

  fastify.get('/projects/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const project = await getProjectById(id, request.user.userId);
      if (!project) return fail(reply, 'NOT_FOUND', 'Project not found', 404);
      return ok(reply, { project });
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to get project', 500);
    }
  });

  fastify.patch('/projects/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
    }
    try {
      const project = await updateProject(id, request.user.userId, parsed.data);
      if (!project) return fail(reply, 'NOT_FOUND', 'Project not found', 404);
      return ok(reply, { project });
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to update project', 500);
    }
  });

  fastify.delete('/projects/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await deleteProject(id, request.user.userId);
      if (!result) return fail(reply, 'NOT_FOUND', 'Project not found', 404);
      return ok(reply, null, 204);
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to delete project', 500);
    }
  });
}
