import { PrismaClient } from '@prisma/client';

const rawDbUrl = process.env.DATABASE_URL || '';
// Optimizar límite de conexiones para concurrencia alta con Neon pooler
let dbUrl = rawDbUrl;
if (dbUrl && !dbUrl.includes('connection_limit=')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}connection_limit=20&pool_timeout=20`;
}

export const prisma = new PrismaClient(
  dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined
);

