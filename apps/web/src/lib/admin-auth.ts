import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { hasRuntimeAuthConfig } from './runtime-env';
import { isAdminSession } from './security';

export async function requireAdminSession() {
  if (!hasRuntimeAuthConfig()) {
    return {
      ok: false as const,
      response: Response.json({ error: 'Admin services are not configured.' }, { status: 503 }),
    };
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      ok: false as const,
      response: Response.json({ error: 'Sign in is required.' }, { status: 401 }),
    };
  }

  if (!isAdminSession(session)) {
    return {
      ok: false as const,
      response: Response.json({ error: 'Administrator access is required.' }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}
