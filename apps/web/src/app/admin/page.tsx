import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { hasRuntimeAuthConfig } from '../../lib/runtime-env';

export default async function AdminHomePage() {
  if (!hasRuntimeAuthConfig()) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Admin Home</h1>
        <p>Admin auth is unavailable until real auth environment variables are configured.</p>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect('/api/auth/signin');
  }
  return (
    <main style={{ padding: 24 }}>
      <h1>Admin Home</h1>
      <p>Welcome, {session.user?.email}</p>
    </main>
  );
}
