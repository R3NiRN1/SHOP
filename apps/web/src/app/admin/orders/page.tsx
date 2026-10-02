import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../../lib/auth-options';
import { authRuntimeState } from '../../../lib/runtime-env';
import { isAdminSession } from '../../../lib/security';
import { OrdersManager } from './orders-manager';
export const dynamic = 'force-dynamic';
export default async function AdminOrdersPage() {
  if (!authRuntimeState().enabled) return <main className="section-shell page-shell"><h1>Admin unavailable</h1><p>Configure authentication and the database before managing orders.</p></main>;
  const session = await getServerSession(authOptions);
  if (!session) redirect('/api/auth/signin?callbackUrl=%2Fadmin%2Forders');
  if (!isAdminSession(session)) return <main className="section-shell page-shell"><h1>Access denied</h1></main>;
  return <main className="section-shell page-shell admin-shell"><div className="section-heading"><div><p className="eyebrow">Admin</p><h1>Orders and sales</h1></div><Link className="button" href="/admin/varieties">Manage varieties</Link></div><OrdersManager /></main>;
}
