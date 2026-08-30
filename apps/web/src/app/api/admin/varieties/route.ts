import { serializeVariety } from '../../../../lib/catalog';
import { requireAdminSession } from '../../../../lib/admin-auth';
import { getPrisma } from '../../../../lib/prisma';
import { checkRateLimit, getClientKey } from '../../../../lib/rate-limit';
import { parseVarietyMutation } from '../../../../lib/variety-input';

export const dynamic = 'force-dynamic';

const mutationLimit = (request: Request) =>
  checkRateLimit(`admin-write:${getClientKey(request)}`, { limit: 60, windowMs: 60_000 });

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const prisma = getPrisma();
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
  return Response.json({ varieties: varieties.map(serializeVariety) });
}

export async function POST(request: Request) {
  const rate = mutationLimit(request);
  if (!rate.allowed) {
    return Response.json({ error: 'Too many write requests.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  }

  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = parseVarietyMutation(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const prisma = getPrisma();
  const duplicate = await prisma.variety.findUnique({ where: { slug: parsed.value.slug } });
  if (duplicate) return Response.json({ error: 'Slug already exists.' }, { status: 409 });

  const variety = await prisma.variety.create({ data: parsed.value });
  return Response.json(serializeVariety(variety), { status: 201 });
}
