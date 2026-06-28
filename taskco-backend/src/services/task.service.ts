import { prisma } from '../lib/db.js';
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from '../lib/validations/task.schema.js';

async function assertProjectOwnership(projectId: string, ownerId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId } });
}

async function getTaskWithOwnership(taskId: string, ownerId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: { project: { select: { ownerId: true } } },
  });
  if (!task || task.project.ownerId !== ownerId) return null;
  return task;
}

export async function listTasks(projectId: string, ownerId: string, filters: TaskFilters) {
  const project = await assertProjectOwnership(projectId, ownerId);
  if (!project) return null;

  return prisma.task.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTask(projectId: string, ownerId: string, input: CreateTaskInput) {
  const project = await assertProjectOwnership(projectId, ownerId);
  if (!project) return null;

  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      projectId,
    },
  });
}

export async function updateTask(taskId: string, ownerId: string, input: UpdateTaskInput) {
  const task = await getTaskWithOwnership(taskId, ownerId);
  if (!task) return null;

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
  });
}

export async function deleteTask(taskId: string, ownerId: string) {
  const task = await getTaskWithOwnership(taskId, ownerId);
  if (!task) return null;
  await prisma.task.delete({ where: { id: taskId } });
  return true;
}
