import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './env';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const getPrisma = () => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
};
