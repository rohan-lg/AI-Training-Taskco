import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  // 128-char max: bcrypt silently truncates at 72 bytes, so very long passwords give a false sense of strength
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
