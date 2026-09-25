import { Prisma, type Variety } from '@prisma/client';
import { getPrisma } from './prisma';

export type CatalogueQuery = { q?: string; page?: string; visibility?: string; stock?: string; sort?: string };
export async function queryVarieties(query: CatalogueQuery = {}, admin = false, pageSize = admin ? 25 : 24) {
  const q = (query.q ?? '').trim().slice(0, 100);
  const page = Math.min(100_000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1));
  const filters: Prisma.Sql[] = [];
  if (!admin) filters.push(Prisma.sql`"published" = true AND "archived" = false`);
  else if (query.visibility === 'archived') filters.push(Prisma.sql`"archived" = true`);
  else {
    filters.push(Prisma.sql`"archived" = false`);
    if (query.visibility === 'published') filters.push(Prisma.sql`"published" = true`);
    if (query.visibility === 'draft') filters.push(Prisma.sql`"published" = false`);
  }
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    filters.push(Prisma.sql`("name" ILIKE ${pattern} OR "species" ILIKE ${pattern})`);
  }
  if (query.stock === 'low') filters.push(Prisma.sql`("stock" - "reserved") BETWEEN 1 AND 5`);
  if (query.stock === 'out') filters.push(Prisma.sql`"stock" = "reserved"`);
  if (query.stock === 'unknown') filters.push(Prisma.sql`"stock" IS NULL`);
  const where = Prisma.join(filters, ' AND ');
  const sort = query.sort === 'newest' ? Prisma.sql`"createdAt" DESC, "id"` : query.sort === 'stock' ? Prisma.sql`("stock" - "reserved") ASC NULLS LAST, "name", "id"` : Prisma.sql`"name" ASC, "id"`;
  const prisma = getPrisma();
  const [rows, count] = await prisma.$transaction([
    prisma.$queryRaw<Variety[]>(Prisma.sql`SELECT * FROM "Variety" WHERE ${where} ORDER BY ${sort} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) FROM "Variety" WHERE ${where}`),
  ]);
  return { rows, total: Number(count[0].count), page, pageSize };
}
