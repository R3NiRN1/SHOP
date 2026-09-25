import { randomBytes } from 'node:crypto';
import { requireAdminSession } from './admin-auth';
import { CommerceError } from './commerce-input';
import { checkRateLimit, getClientKey } from './rate-limit';
import { isSameOriginMutation } from './security';
import { digest } from './orders';

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function api(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    if (error instanceof CommerceError) return json({ error: error.message }, error.status);
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'P2002') return json({ error: 'This identifier already exists.' }, 409);
    if (code === 'P2025') return json({ error: 'Record not found.' }, 404);
    console.error('Shop operation failed', { name: error instanceof Error ? error.name : 'UnknownError', code });
    return json({ error: 'The operation could not be completed. Refresh before retrying; an order or payment may still be processing.' }, 503);
  }
}

export async function readText(request: Request, limit = 16_384) {
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new CommerceError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new CommerceError('Request is too large.', 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function readJson(request: Request) {
  const body = await readText(request);
  try { return JSON.parse(body) as unknown; } catch { throw new CommerceError('Invalid JSON.'); }
}

export function mutation(request: Request, key: string, limit = 60) {
  if (!isSameOriginMutation(request)) throw new CommerceError('Cross-origin writes are not allowed.', 403);
  if (!checkRateLimit(key, { limit, windowMs: 60_000 }).allowed) throw new CommerceError('Too many requests. Please wait a minute.', 429);
}

export async function adminAccess(request?: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth;
  if (request && request.method !== 'GET') mutation(request, `admin-write:${auth.session.user?.email ?? 'admin'}`);
  return auth;
}

export function anonymousSession(request: Request, create = false) {
  let token = /(?:^|;\s*)shop_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (!token && create) token = randomBytes(32).toString('hex');
  if (!token) throw new CommerceError('Refresh the basket before checkout.', 401);
  return { hash: digest(token), cookie: `shop_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NEXTAUTH_URL?.startsWith('https://') ? '; Secure' : ''}` };
}

export function checkoutMutation(request: Request) {
  const owner = anonymousSession(request);
  mutation(request, `checkout:${getClientKey(request)}:${owner.hash}`, 10);
  if (!checkRateLimit(`checkout-ip:${getClientKey(request)}`, { limit: 100, windowMs: 60_000 }).allowed) throw new CommerceError('Checkout is busy. Please try again shortly.', 429);
  return owner;
}
