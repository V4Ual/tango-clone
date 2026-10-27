import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createStreamSchema = z.object({
  title: z
    .string()
    .min(3, "Stream title must be at least 3 characters")
    .max(100, "Stream title must not exceed 100 characters"),
});

export const sendGiftSchema = z.object({
  streamId: z.string().uuid("Invalid stream ID"),
  giftId: z.string().uuid("Invalid gift ID"),
  quantity: z.number().int().positive().default(1),
});
