import { NextRequest } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const prisma = getPrisma();
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
  return Response.json(varieties);
}

export async function POST(req: NextRequest) {
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
