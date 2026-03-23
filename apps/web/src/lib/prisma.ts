import { PrismaClient } from '@prisma/client';
import { env } from '../env';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
