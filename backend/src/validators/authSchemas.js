
import { z } from "zod";

export const registerSchema = z.strictObject({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name is too long"),

  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name is too long"),

  email: z
    .email("Invalid email address")
    .max(255, "Email is too long")
    .transform((email) => email.toLowerCase()),

  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password is too long")
});

