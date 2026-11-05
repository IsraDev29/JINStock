"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const rawDbUrl = process.env.DATABASE_URL || '';
// Optimizar límite de conexiones para concurrencia alta con Neon pooler
let dbUrl = rawDbUrl;
if (dbUrl && !dbUrl.includes('connection_limit=')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}connection_limit=20&pool_timeout=20`;
}
exports.prisma = new client_1.PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
