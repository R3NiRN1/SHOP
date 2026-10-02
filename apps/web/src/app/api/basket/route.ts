import { anonymousSession, api, json } from '../../../lib/commerce-http';
import { CommerceError, toPence } from '../../../lib/commerce-input';
import { getPrisma } from '../../../lib/prisma';
import { paymentAvailability } from '../../../lib/commerce-config';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return api(async () => {
    const ids = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean);
    if (ids.length > 30 || ids.some((id) => id.length > 100)) throw new CommerceError('The basket is too large.');
    const rows = await getPrisma().variety.findMany({ where: { id: { in: ids }, published: true, archived: false } });
    const response = json({ items: rows.map((item) => ({ id: item.id, name: item.name, unitPricePence: item.price === null ? null : toPence(item.price), available: item.stock === null ? null : item.stock - item.reserved })), payment: paymentAvailability() });
    response.headers.set('Set-Cookie', anonymousSession(request, true).cookie);
    return response;
  });
}
