import { prisma } from '../lib/db.js';
import type { CreateProjectInput, UpdateProjectInput } from '../lib/validations/project.schema.js';

export async function createProject(ownerId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: { ...input, ownerId },
  });
}

export async function listProjects(ownerId: string) {
  return prisma.project.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProjectById(id: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!project) return null;
  const { _count, ...rest } = project;
  return { ...rest, taskCount: _count.tasks };
}

export async function updateProject(id: string, ownerId: string, input: UpdateProjectInput) {
  const existing = await prisma.project.findFirst({ where: { id, ownerId } });
  if (!existing) return null;
  return prisma.project.update({ where: { id }, data: input });
}

export async function deleteProject(id: string, ownerId: string) {
  const existing = await prisma.project.findFirst({ where: { id, ownerId } });
  if (!existing) return null;
  // will also delete tasks here once Task model is added (prisma.task.deleteMany)
  await prisma.project.delete({ where: { id } });
  return true;
}
