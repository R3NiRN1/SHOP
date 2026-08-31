import { getCatalogVarieties } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { varieties, source } = await getCatalogVarieties();
  if (source === 'unavailable') {
    return Response.json(
      { varieties: [], source, error: 'Catalogue temporarily unavailable.' },
      { status: 503 },
    );
  }
  return Response.json({ varieties, source });
}
