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
  return Response.json(
    { ready, kind: 'readiness', dependencies: { database, auth: auth.enabled ? 'configured' : 'unavailable', contact: contact.configured ? 'configured' : 'unavailable' } },
    { status: ready ? 200 : 503 },
  );
}
