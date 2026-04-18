"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("../config/env");
const globalForPrisma = global;
function createPrismaClient() {
    const pool = new pg_1.Pool({
        connectionString: env_1.env.DATABASE_URL,
        max: 10, // Max connections in the pool (Neon free tier: 20)
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({
        adapter,
        log: env_1.env.NODE_ENV === 'production'
            ? ['warn', 'error']
            : ['query', 'info', 'warn', 'error'],
    });
}
// Singleton — always cache to prevent multiple pools on hot-reload AND in production
exports.prisma = globalForPrisma.prisma || createPrismaClient();
globalForPrisma.prisma = exports.prisma;
