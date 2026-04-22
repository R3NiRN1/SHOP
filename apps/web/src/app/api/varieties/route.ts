import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { getPrisma } from '../../../lib/prisma';
import { authOptions } from '../auth/[...nextauth]/route';
import { authRuntimeState, hasRuntimeAuthConfig } from '../../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const prisma = getPrisma();
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
  return Response.json(varieties);
}

export async function POST(req: NextRequest) {
  if (!hasRuntimeAuthConfig()) {
    return Response.json(
      {
        error: 'Admin auth is not configured for runtime use.',
        reason: authRuntimeState().reason,
      },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if ((session as any).role !== 'ADMIN') {
    return Response.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const prisma = getPrisma();
  const data = await req.json();
  const { name, species, description, price, stock } = data;

  if (!name) {
    return new Response('Name is required', { status: 400 });
  }

  const variety = await prisma.variety.create({
    data: {
      name,
      species: species || undefined,
      description: description || undefined,
      price: price != null ? parseFloat(price) : undefined,
      stock: stock != null ? parseInt(stock) : undefined,
    },
  });

  return Response.json(variety);
}
