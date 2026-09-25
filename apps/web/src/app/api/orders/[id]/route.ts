import { anonymousSession, api, checkoutMutation, json, readJson } from '../../../../lib/commerce-http';
import { CommerceError, record } from '../../../../lib/commerce-input';
import { getOrder } from '../../../../lib/orders';
import { ensureCheckout, reconcileOrder } from '../../../../lib/payments';
type Context = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: Context) {
  return api(async () => {
    const owner = anonymousSession(request);
    const order = await getOrder((await params).id);
    if (!order || order.ownerHash !== owner.hash) throw new CommerceError('Order not found in this browser.', 404);
    return json({ id: order.id, number: order.number, status: order.status, totalPence: order.totalPence, delivery: order.delivery, items: order.items.map(({ varietyId, name, quantity, unitPricePence }) => ({ varietyId, name, quantity, unitPricePence })), expiresAt: order.expiresAt });
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    const owner = checkoutMutation(request);
    const { id } = await params;
    const order = await getOrder(id);
    if (!order || order.ownerHash !== owner.hash) throw new CommerceError('Order not found in this browser.', 404);
    const body = record(await readJson(request));
    if (body.action === 'retry') {
      const session = await ensureCheckout(id);
      return json({ url: session.status === 'open' && session.url && new URL(session.url).hostname === 'checkout.stripe.com' ? session.url : null });
    }
    if (body.action !== 'refresh' && body.action !== 'cancel') throw new CommerceError('Unknown action.');
    await reconcileOrder(id, body.action === 'cancel');
    return json({ ok: true });
  });
}
