import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  PORT: z.string().optional().default('5000'),
  CLIENT_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "Cloudinary cloud name missing"),
  CLOUDINARY_API_KEY: z.string().min(1, "Cloudinary API key missing"),
  CLOUDINARY_SECRET: z.string().min(1, "Cloudinary secret missing"),
  LOG_INCLUDE_IP: z.string().optional().transform(v => v === 'true').default(false),
  TRUST_PROXY: z.string().optional().default('1'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;
