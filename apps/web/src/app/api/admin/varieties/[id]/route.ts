import { serializeVariety } from '../../../../../lib/catalog';
import { requireAdminSession } from '../../../../../lib/admin-auth';
import { getPrisma } from '../../../../../lib/prisma';
import { checkRateLimit, getClientKey } from '../../../../../lib/rate-limit';
import { parseVarietyMutation } from '../../../../../lib/variety-input';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const mutationLimit = (request: Request) =>
  checkRateLimit(`admin-write:${getClientKey(request)}`, { limit: 60, windowMs: 60_000 });

export async function PATCH(request: Request, { params }: Context) {
  const rate = mutationLimit(request);
  if (!rate.allowed) {
    return Response.json({ error: 'Too many write requests.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  }

  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = parseVarietyMutation(await request.json().catch(() => null));
  if (parsed.ok === false) return Response.json({ error: parsed.error }, { status: 400 });

  const { id } = await params;
  const prisma = getPrisma();
  const duplicate = await prisma.variety.findFirst({ where: { slug: parsed.value.slug, NOT: { id } } });
  if (duplicate) return Response.json({ error: 'Slug already exists.' }, { status: 409 });

  const existing = await prisma.variety.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Variety not found.' }, { status: 404 });

  const variety = await prisma.variety.update({ where: { id }, data: parsed.value });
  return Response.json(serializeVariety(variety));
}

export async function DELETE(request: Request, { params }: Context) {
  const rate = mutationLimit(request);
  if (!rate.allowed) {
    return Response.json({ error: 'Too many write requests.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  }

  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const prisma = getPrisma();
  const existing = await prisma.variety.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Variety not found.' }, { status: 404 });

  await prisma.variety.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
