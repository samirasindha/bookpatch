import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  GOOGLE_BOOKS_API_KEY: z.string().optional().default(""),
  ISBNDB_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Bookpatch <onboarding@resend.dev>"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5174"),
  ALLOW_DEMO_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
