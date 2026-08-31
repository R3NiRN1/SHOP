import { serializeVariety } from '../../../../lib/catalog';
import { requireAdminSession } from '../../../../lib/admin-auth';
import { getPrisma } from '../../../../lib/prisma';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { isSameOriginMutation } from '../../../../lib/security';
import { parseVarietyMutation } from '../../../../lib/variety-input';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const prismaErrorCode = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : null;

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const prisma = getPrisma();
    const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
    return Response.json({ varieties: varieties.map(serializeVariety) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Admin catalogue read failed', error);
    return Response.json({ error: 'Catalogue database is unavailable.' }, { status: 503, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: 'Cross-origin writes are not allowed.' }, { status: 403, headers: noStoreHeaders });
  }

  const adminKey = auth.session.user?.email ?? 'admin-session';
  const rate = checkRateLimit(`admin-write:${adminKey}`, { limit: 60, windowMs: 60_000 });
  if (!rate.allowed) {
    return Response.json(
      { error: 'Too many write requests.' },
      { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  const parsed = parseVarietyMutation(await request.json().catch(() => null));
  if (parsed.ok === false) return Response.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders });

  try {
    const prisma = getPrisma();
    const variety = await prisma.variety.create({ data: parsed.value });
    return Response.json(serializeVariety(variety), { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      return Response.json({ error: 'Slug already exists.' }, { status: 409, headers: noStoreHeaders });
    }
    console.error('Admin catalogue create failed', error);
    return Response.json({ error: 'Catalogue database is unavailable.' }, { status: 503, headers: noStoreHeaders });
  }
}
