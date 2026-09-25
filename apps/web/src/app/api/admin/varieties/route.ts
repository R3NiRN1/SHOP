import { serializeVariety } from '../../../../lib/catalog';
import { queryVarieties } from '../../../../lib/catalog-query';
import { adminAccess, api, json, readJson } from '../../../../lib/commerce-http';
import { CommerceError } from '../../../../lib/commerce-input';
import { serial } from '../../../../lib/inventory';
import { parseVarietyMutation } from '../../../../lib/variety-input';
export const dynamic = 'force-dynamic';
export async function GET(request?: Request) {
  return api(async () => {
    const auth = await adminAccess(); if (!auth.ok) return auth.response;
    const query = request ? Object.fromEntries(new URL(request.url).searchParams) : {};
    const { rows, ...pagination } = await queryVarieties(query, true);
    return json({ varieties: rows.map(serializeVariety), ...pagination });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const parsed = parseVarietyMutation(await readJson(request));
    if (!parsed.ok) throw new CommerceError(parsed.error);
    const variety = await serial(async (tx) => {
      const created = await tx.variety.create({ data: parsed.value });
      await tx.stockMovement.create({ data: { varietyId: created.id, operationKey: `opening:${created.id}`, kind: 'opening', stockDelta: created.stock ?? 0, stockAfter: created.stock, reservedAfter: 0, actor: auth.session.user?.email ?? 'admin', reason: 'Opening stock' } });
      return created;
    });
    return json(serializeVariety(variety), 201);
  });
}
