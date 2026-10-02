import { adminAccess, api, json, readJson } from '../../../../../../lib/commerce-http';
import { adjustStock } from '../../../../../../lib/inventory';
import { getPrisma } from '../../../../../../lib/prisma';
import { serializeVariety } from '../../../../../../lib/catalog';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(); if (!auth.ok) return auth.response;
    const { id } = await params;
    return json({ movements: await getPrisma().stockMovement.findMany({ where: { varietyId: id }, orderBy: { createdAt: 'desc' }, take: 100 }) });
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const { id } = await params;
    return json(serializeVariety(await adjustStock(id, await readJson(request), auth.session.user?.email ?? 'admin')));
  });
}
