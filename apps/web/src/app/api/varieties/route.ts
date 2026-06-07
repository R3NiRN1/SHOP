import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/route';
import { getCatalogVarieties } from '../../../lib/catalog';
import { getPrisma } from '../../../lib/prisma';
import { hasRuntimeAuthConfig, hasRuntimeDatabaseUrl } from '../../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { varieties, source } = await getCatalogVarieties();
  return Response.json({ varieties, source });
}

export async function POST(req: NextRequest) {
  if (!hasRuntimeAuthConfig()) {
    return Response.json({ error: 'Admin auth is not configured.' }, { status: 503 });
  }

  if (!hasRuntimeDatabaseUrl()) {
    return Response.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  }

  const data = await req.json();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const species = typeof data.species === 'string' ? data.species.trim() : '';
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const price = data.price === '' || data.price == null ? null : Number(data.price);
  const stock = data.stock === '' || data.stock == null ? null : Number(data.stock);

  if (!name) {
    return Response.json({ error: 'Name is required.' }, { status: 400 });
  }

  if (price != null && (!Number.isFinite(price) || price < 0)) {
    return Response.json({ error: 'Price must be a positive number.' }, { status: 400 });
  }

  if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
    return Response.json({ error: 'Stock must be a positive whole number.' }, { status: 400 });
  }

  const prisma = getPrisma();
  const variety = await prisma.variety.create({
    data: {
      name,
      species: species || undefined,
      description: description || undefined,
      price: price ?? undefined,
      stock: stock ?? undefined,
    },
  });

  return Response.json(variety, { status: 201 });
}
