"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url("DATABASE_URL must be a valid URL"),
    JWT_SECRET: zod_1.z.string().min(1, "JWT_SECRET is required"),
    ADMIN_EMAIL: zod_1.z.string().email("ADMIN_EMAIL must be a valid email"),
    PORT: zod_1.z.string().optional().default('5000'),
    CLIENT_URL: zod_1.z.string().url().optional(),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development')
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}
exports.env = _env.data;
