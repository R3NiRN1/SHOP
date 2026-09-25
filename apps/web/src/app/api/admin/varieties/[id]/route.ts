import { serializeVariety } from '../../../../../lib/catalog';
import { adminAccess, api, json, readJson } from '../../../../../lib/commerce-http';
import { CommerceError, record } from '../../../../../lib/commerce-input';
import { serial } from '../../../../../lib/inventory';
import { parseVarietyMutation } from '../../../../../lib/variety-input';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const body = record(await readJson(request));
    const parsed = parseVarietyMutation(body);
    if (!parsed.ok) throw new CommerceError(parsed.error);
    const { id } = await params;
    const variety = await serial(async (tx) => {
      const current = await tx.variety.findUniqueOrThrow({ where: { id } });
      if ('stock' in body && parsed.value.stock !== current.stock) throw new CommerceError('Use Adjust stock to record a stock change and its reason.', 409);
      if (body.expectedUpdatedAt && body.expectedUpdatedAt !== current.updatedAt.toISOString()) throw new CommerceError('This variety changed. Refresh before saving your edit.', 409);
      const { stock: _stock, ...metadata } = parsed.value;
      void _stock;
      return tx.variety.update({ where: { id }, data: { ...metadata, species: metadata.species ?? null, description: metadata.description ?? null, ...(body.archived === false ? { archived: false } : {}), published: current.archived && body.archived !== false ? false : metadata.published } });
    });
    return json(serializeVariety(variety));
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const { id } = await params;
    await serial((tx) => tx.variety.update({ where: { id }, data: { archived: true, published: false } }));
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  });
}
