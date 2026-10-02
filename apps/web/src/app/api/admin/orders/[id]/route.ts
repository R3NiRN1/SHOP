import { adminAccess, api, json, readJson } from '../../../../../lib/commerce-http';
import { CommerceError, record, text } from '../../../../../lib/commerce-input';
import { getOrder, manualOrderAction } from '../../../../../lib/orders';
import { reconcileOrder, reconcileRefund, refundOrder } from '../../../../../lib/payments';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(); if (!auth.ok) return auth.response;
    const order = await getOrder((await params).id);
    if (!order) throw new CommerceError('Order not found.', 404);
    return json(order);
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    const body = record(await readJson(request));
    const { id } = await params;
    const actor = auth.session.user?.email ?? 'admin';
    if (body.action === 'reconcile' || body.action === 'cancel-checkout') await reconcileOrder(id, body.action === 'cancel-checkout');
    else if (body.action === 'reconcile-refund') await reconcileRefund(id);
    else if (body.action === 'refund') await refundOrder(id, body, actor);
    else await manualOrderAction(id, text(body.action, 'Action', 30), actor, text(body.reason ?? '', 'Reason', 500, false));
    return json(await getOrder(id));
  });
}
