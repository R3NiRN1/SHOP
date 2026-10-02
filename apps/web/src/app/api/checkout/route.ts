import { api, checkoutMutation, json, readJson } from '../../../lib/commerce-http';
import { createOrder } from '../../../lib/orders';
import { ensureCheckout } from '../../../lib/payments';
export async function POST(request: Request) {
  return api(async () => {
    const owner = checkoutMutation(request);
    const order = await createOrder(await readJson(request), 'STRIPE', owner.hash);
    try {
      const session = await ensureCheckout(order.id);
      const url = session.status === 'open' && session.url && new URL(session.url).hostname === 'checkout.stripe.com' ? session.url : `/orders/${order.id}`;
      return json({ orderId: order.id, url });
    } catch {
      return json({ orderId: order.id, url: `/orders/${order.id}` });
    }
  });
}
