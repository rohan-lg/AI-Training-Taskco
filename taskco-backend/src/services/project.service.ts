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
  });
  if (!project) return null;
  // taskCount will use _count.tasks once Task model is added
  return { ...project, taskCount: 0 };
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
