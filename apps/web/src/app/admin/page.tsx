import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';

export default async function AdminHomePage() {
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
