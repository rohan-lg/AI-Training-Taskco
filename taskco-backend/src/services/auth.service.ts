import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signJwt } from '../lib/auth.js';
import type { RegisterInput, LoginInput } from '../lib/validations/auth.schema.js';

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return null;
  }

  const { passwordHash: _, ...safeUser } = user;
  const token = await signJwt({ userId: safeUser.id, email: safeUser.email });

  return { token, user: safeUser };
}

export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const token = await signJwt({ userId: user.id, email: user.email });

  return { token, user };
}
