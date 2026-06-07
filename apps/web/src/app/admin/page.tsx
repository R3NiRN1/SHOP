import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { hasRuntimeAuthConfig } from '../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  if (!hasRuntimeAuthConfig()) {
    return (
      <main className="section-shell page-shell">
        <p className="eyebrow">Admin</p>
        <h1>Admin unavailable</h1>
        <p className="notice">Configure AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, and DATABASE_URL to manage live stock.</p>
        <Link className="button" href="/">
          Back to storefront
        </Link>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect('/api/auth/signin');
  }

  return (
    <main className="section-shell page-shell">
      <p className="eyebrow">Admin</p>
      <h1>Admin home</h1>
      <p>Welcome, {session.user?.email}</p>
      <div className="button-row">
        <Link className="button primary" href="/admin/varieties">
          Manage varieties
        </Link>
        <Link className="button" href="/varieties">
          View catalogue
        </Link>
      </div>
    </main>
  );
}
