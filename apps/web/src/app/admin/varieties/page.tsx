import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../../lib/auth-options';
import { authRuntimeState } from '../../../lib/runtime-env';
import { isAdminSession } from '../../../lib/security';
import { VarietiesManager } from './varieties-manager';

export const dynamic = 'force-dynamic';

export default async function AdminVarietiesPage() {
  const runtime = authRuntimeState();
  if (!runtime.enabled) {
    return (
      <main className="section-shell page-shell">
        <p className="eyebrow">Admin</p>
        <h1>Admin unavailable</h1>
        <p className="notice">Complete the required authentication and database configuration before catalogue management is enabled.</p>
        <Link className="button" href="/">Back to storefront</Link>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) redirect('/api/auth/signin');
  if (!isAdminSession(session)) {
    return <main className="section-shell page-shell"><h1>Access denied</h1><p>Administrator access is required.</p></main>;
  }

  return <VarietiesManager />;
}
