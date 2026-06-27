import { prisma } from '../lib/db.js';
import { hashPassword, signJwt } from '../lib/auth.js';
import type { RegisterInput } from '../lib/validations/auth.schema.js';

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
