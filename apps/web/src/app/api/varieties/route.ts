import { getCatalogVarieties } from '../../../lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  const { varieties, source, ...pagination } = await getCatalogVarieties(request ? Object.fromEntries(new URL(request.url).searchParams) : {});
  if (source === 'unavailable') {
    return Response.json(
      { varieties: [], source, error: 'Catalogue temporarily unavailable.' },
      { status: 503 },
    );
  }
  return Response.json({ varieties, source, ...pagination }, { headers: { 'Cache-Control': 'no-store' } });
}
