import type { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/authenticate.js';
import { ok, fail } from '../lib/api-response.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFiltersSchema,
} from '../lib/validations/task.schema.js';
import { listTasks, createTask, updateTask, deleteTask } from '../services/task.service.js';

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/projects/:id/tasks', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = taskFiltersSchema.safeParse(request.query);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Invalid filters', 400, parsed.error.flatten());
    }
    try {
      const tasks = await listTasks(id, request.user.userId, parsed.data);
      if (tasks === null) return fail(reply, 'NOT_FOUND', 'Project not found', 404);
      return ok(reply, { tasks });
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to list tasks', 500);
    }
  });

  fastify.post('/projects/:id/tasks', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
    }
    try {
      const task = await createTask(id, request.user.userId, parsed.data);
      if (task === null) return fail(reply, 'NOT_FOUND', 'Project not found', 404);
      return ok(reply, { task }, 201);
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to create task', 500);
    }
  });

  fastify.patch('/tasks/:taskId', { preHandler: authenticate }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const parsed = updateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
    }
    try {
      const task = await updateTask(taskId, request.user.userId, parsed.data);
      if (task === null) return fail(reply, 'NOT_FOUND', 'Task not found', 404);
      return ok(reply, { task });
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to update task', 500);
    }
  });

  fastify.delete('/tasks/:taskId', { preHandler: authenticate }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    try {
      const result = await deleteTask(taskId, request.user.userId);
      if (result === null) return fail(reply, 'NOT_FOUND', 'Task not found', 404);
      return ok(reply, null, 204);
    } catch {
      return fail(reply, 'INTERNAL', 'Failed to delete task', 500);
    }
  });
}
