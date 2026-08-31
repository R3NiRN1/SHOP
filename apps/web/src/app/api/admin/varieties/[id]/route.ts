import { serializeVariety } from '../../../../../lib/catalog';
import { requireAdminSession } from '../../../../../lib/admin-auth';
import { getPrisma } from '../../../../../lib/prisma';
import { checkRateLimit } from '../../../../../lib/rate-limit';
import { isSameOriginMutation } from '../../../../../lib/security';
import { parseVarietyMutation } from '../../../../../lib/variety-input';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const prismaErrorCode = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : null;

const requireMutationAccess = async (request: Request) => {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth;
  if (!isSameOriginMutation(request)) {
    return {
      ok: false as const,
      response: Response.json(
        { error: 'Cross-origin writes are not allowed.' },
        { status: 403, headers: noStoreHeaders },
      ),
    };
  }

  const adminKey = auth.session.user?.email ?? 'admin-session';
  const rate = checkRateLimit(`admin-write:${adminKey}`, { limit: 60, windowMs: 60_000 });
  if (!rate.allowed) {
    return {
      ok: false as const,
      response: Response.json(
        { error: 'Too many write requests.' },
        { status: 429, headers: { ...noStoreHeaders, 'Retry-After': String(rate.retryAfterSeconds) } },
      ),
    };
  }

  return auth;
};

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireMutationAccess(request);
  if (!auth.ok) return auth.response;

  const parsed = parseVarietyMutation(await request.json().catch(() => null));
  if (parsed.ok === false) return Response.json({ error: parsed.error }, { status: 400, headers: noStoreHeaders });

  const { id } = await params;
  try {
    const prisma = getPrisma();
    const variety = await prisma.variety.update({ where: { id }, data: parsed.value });
    return Response.json(serializeVariety(variety), { headers: noStoreHeaders });
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === 'P2002') {
      return Response.json({ error: 'Slug already exists.' }, { status: 409, headers: noStoreHeaders });
    }
    if (code === 'P2025') {
      return Response.json({ error: 'Variety not found.' }, { status: 404, headers: noStoreHeaders });
    }
    console.error('Admin catalogue update failed', error);
    return Response.json({ error: 'Catalogue database is unavailable.' }, { status: 503, headers: noStoreHeaders });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireMutationAccess(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const prisma = getPrisma();
    await prisma.variety.delete({ where: { id } });
    return new Response(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') {
      return Response.json({ error: 'Variety not found.' }, { status: 404, headers: noStoreHeaders });
    }
    console.error('Admin catalogue delete failed', error);
    return Response.json({ error: 'Catalogue database is unavailable.' }, { status: 503, headers: noStoreHeaders });
  }
}
