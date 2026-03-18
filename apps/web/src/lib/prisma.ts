import { PrismaClient } from '@prisma/client';

const accelerateUrl =
  process.env.PRISMA_ACCELERATE_URL ?? 'prisma+postgres://localhost:5432/ci?api_key=ci';

const prisma = globalThis.prisma ?? new PrismaClient({ accelerateUrl });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;

declare global {
  var prisma: PrismaClient | undefined;
}
