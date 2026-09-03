import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../lib/auth-options';
import { authRuntimeState } from '../../lib/runtime-env';
import { isAdminSession } from '../../lib/security';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  if (!authRuntimeState().enabled) {
    return (
      <main className="section-shell page-shell">
        <p className="eyebrow">Admin</p><h1>Admin unavailable</h1>
        <p className="notice">Complete the required authentication and database configuration before catalogue management is enabled.</p>
        <Link className="button" href="/">Back to storefront</Link>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) redirect('/api/auth/signin?callbackUrl=%2Fadmin');
  if (!isAdminSession(session)) return <main className="section-shell page-shell"><h1>Access denied</h1><p>Administrator access is required.</p></main>;

  return (
    <main className="section-shell page-shell">
      <p className="eyebrow">Admin</p><h1>Admin home</h1><p>Signed in as {session.user?.email}</p>
      <div className="button-row"><Link className="button primary" href="/admin/varieties">Manage varieties</Link><Link className="button" href="/varieties">View catalogue</Link></div>
    </main>
  );
}
