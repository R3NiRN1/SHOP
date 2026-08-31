import { getPrisma } from '../../../lib/prisma';
import { authRuntimeState, contactRuntimeState, hasRuntimeDatabaseUrl } from '../../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = authRuntimeState();
  const contact = contactRuntimeState();
  let database: 'ok' | 'unconfigured' | 'unavailable' = hasRuntimeDatabaseUrl() ? 'unavailable' : 'unconfigured';

  if (hasRuntimeDatabaseUrl()) {
    try {
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch (error) {
      console.error('Readiness database check failed', error);
      database = 'unavailable';
    }
  }

  const ready = database === 'ok' && auth.enabled && contact.configured;
  const body = process.env.READINESS_DETAILS === 'true'
    ? {
        ready,
        kind: 'readiness',
        dependencies: {
          database,
          auth: auth.enabled ? 'configured' : 'unavailable',
          contact: contact.configured ? 'configured' : 'unavailable',
        },
      }
    : { ready, kind: 'readiness' };

  return Response.json(body, {
    status: ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
