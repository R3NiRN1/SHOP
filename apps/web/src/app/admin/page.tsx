import { auth } from 'next-auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const session = await auth();
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
