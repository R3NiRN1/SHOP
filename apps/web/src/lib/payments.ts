import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { paymentConfig } from './commerce-config';
import { CommerceError, record, requestKey, text } from './commerce-input';
import { getPrisma } from './prisma';
import { serial, type Transaction } from './inventory';
import { changeOrderStock, orderEvent, orderInclude, type OrderWithItems } from './orders';

export const stripeClient = () => new Stripe(paymentConfig().secret, { maxNetworkRetries: 2, timeout: 10_000 });
export const gateway = {
  createSession: (params: Stripe.Checkout.SessionCreateParams, key: string) => stripeClient().checkout.sessions.create(params, { idempotencyKey: key }),
  retrieveSession: (id: string) => stripeClient().checkout.sessions.retrieve(id),
  expireSession: (id: string) => stripeClient().checkout.sessions.expire(id),
  listSessions: (params: Stripe.Checkout.SessionListParams) => stripeClient().checkout.sessions.list(params),
  createRefund: (params: Stripe.RefundCreateParams, key: string) => stripeClient().refunds.create(params, { idempotencyKey: key }),
  retrieveRefund: (id: string) => stripeClient().refunds.retrieve(id),
  listRefunds: (params: Stripe.RefundListParams) => stripeClient().refunds.list(params),
  retrieveCharge: (id: string) => stripeClient().charges.retrieve(id),
  retrieveIntent: (id: string) => stripeClient().paymentIntents.retrieve(id),
};
const objectId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id ?? null;

function sessionParams(order: OrderWithItems): Stripe.Checkout.SessionCreateParams {
  if (!order.checkoutOrigin || !order.expiresAt) throw new CommerceError('Order checkout settings are missing.', 409);
  return {
    mode: 'payment', payment_method_types: ['card'], client_reference_id: order.id,
    metadata: { orderId: order.id }, payment_intent_data: { metadata: { orderId: order.id } },
    customer_email: order.email, expires_at: Math.floor(order.expiresAt.getTime() / 1000),
    success_url: `${order.checkoutOrigin}/orders/${order.id}`,
    cancel_url: `${order.checkoutOrigin}/orders/${order.id}?returned=1`,
    line_items: order.items.map((item) => ({ quantity: item.quantity, price_data: {
      currency: order.currency, unit_amount: item.unitPricePence, product_data: { name: item.name },
    } })),
    ...(order.delivery === 'shipping' ? {
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: order.shippingPence, currency: order.currency }, display_name: 'UK delivery' } }],
    } : { custom_text: { submit: { message: 'Collection order. We will contact you to arrange collection.' } } }),
  };
}

async function review(tx: Transaction, order: OrderWithItems, issue: string) {
  await tx.order.update({ where: { id: order.id }, data: { status: 'REVIEW', issue } });
  if (order.issue !== issue) await orderEvent(tx, order.id, 'payments', issue);
}

async function applySession(tx: Transaction, session: Stripe.Checkout.Session) {
  const id = session.client_reference_id;
  if (!id) return;
  const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
  if (!order || order.channel !== 'STRIPE') return;
  if (session.metadata?.orderId !== id || session.livemode !== paymentConfig().live || (order.stripeSessionId && order.stripeSessionId !== session.id)) {
    await review(tx, order, 'Payment session identity does not match this order.'); return;
  }
  const intent = objectId(session.payment_intent);
  await tx.order.update({ where: { id }, data: { stripeSessionId: session.id, ...(intent ? { stripeIntentId: intent } : {}) } });
  if (session.currency !== order.currency || session.amount_total !== order.totalPence) {
    await review(tx, order, 'Payment total or currency does not match the order. Stock remains protected.'); return;
  }
  if (session.status === 'complete' && session.payment_status === 'paid') {
    if (['REFUNDED', 'REFUND_PENDING', 'FULFILLED'].includes(order.status)) return;
    if (order.refundedPence > 0) { await review(tx, order, 'A partial refund needs review before fulfilment.'); return; }
    if (order.inventoryState === 'SOLD') return;
    if (order.inventoryState !== 'HELD') { await review(tx, order, 'Payment arrived after stock was released. Refund or resolve this order before fulfilment.'); return; }
    await changeOrderStock(tx, order, 'sell', 'stripe');
    const address = session.collected_information?.shipping_details ?? null;
    await tx.order.update({ where: { id }, data: {
      status: 'CONFIRMED', issue: null, paidAt: new Date(), checkoutUrl: null,
      customerName: session.customer_details?.name ?? order.customerName,
      ...(address ? { shippingAddress: address as unknown as Prisma.InputJsonValue } : {}),
    } });
    await orderEvent(tx, id, 'stripe', 'Payment confirmed; reserved stock sold.');
  } else if (session.status === 'expired' && session.payment_status === 'unpaid' && order.inventoryState === 'HELD') {
    await changeOrderStock(tx, order, 'release', 'stripe');
    await tx.order.update({ where: { id }, data: { status: 'CANCELLED', checkoutUrl: null, issue: null } });
    await orderEvent(tx, id, 'stripe', 'Checkout expired; reserved stock released.');
  }
}

export async function syncSession(session: Stripe.Checkout.Session, event?: { id: string; type: string }) {
  await serial(async (tx) => {
    if (event && await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
    await applySession(tx, session);
    if (event) await tx.paymentEvent.create({ data: event });
  });
}

export async function ensureCheckout(id: string) {
  const order = await getPrisma().order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  if (order.channel !== 'STRIPE') throw new CommerceError('This is an offline order.', 409);
  if (order.stripeSessionId) {
    const session = await gateway.retrieveSession(order.stripeSessionId);
    await syncSession(session);
    return session;
  }
  if (order.status !== 'AWAITING_PAYMENT') throw new CommerceError('This checkout is no longer open.', 409);
  // Creation parameters and the provider idempotency key are immutable. An
  // uncertain network response keeps the hold; reconciliation recovers it.
  if (!order.expiresAt || Date.now() >= order.expiresAt.getTime() - 60_000 || Date.now() - order.createdAt.getTime() > 23 * 60 * 60_000) throw new CommerceError('This checkout needs reconciliation before retrying.', 409);
  const session = await gateway.createSession(sessionParams(order), `checkout:${order.id}`);
  await syncSession(session);
  if (session.url && new URL(session.url).hostname === 'checkout.stripe.com') {
    await getPrisma().order.updateMany({ where: { id, status: 'AWAITING_PAYMENT' }, data: { checkoutUrl: session.url } });
  }
  return session;
}

export async function reconcileOrder(id: string, cancel = false) {
  const order = await getPrisma().order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  if (order.channel !== 'STRIPE') throw new CommerceError('This is an offline order.', 409);
  let sessionId = order.stripeSessionId;
  if (!sessionId) {
    // Recover a provider success followed by a lost response/database outage.
    // Exhaust the bounded creation window before concluding no session exists.
    let startingAfter: string | undefined;
    let exhausted = false;
    for (let page = 0; page < 20; page++) {
      const result = await gateway.listSessions({ limit: 100, starting_after: startingAfter,
        created: { gte: Math.floor(order.createdAt.getTime() / 1000) - 60, lte: Math.ceil((order.expiresAt ?? order.createdAt).getTime() / 1000) } });
      const match = result.data.find((session) => session.client_reference_id === id && session.metadata?.orderId === id);
      if (match) { sessionId = match.id; break; }
      if (!result.has_more) { exhausted = true; break; }
      startingAfter = result.data.at(-1)?.id;
    }
    if (!sessionId) {
      if (!exhausted) throw new CommerceError('Provider search needs further review; stock remains reserved.', 409);
      if (!order.expiresAt || Date.now() < order.expiresAt.getTime() + 60_000) throw new CommerceError('Checkout creation is still recoverable. Retry checkout or reconcile after its expiry.', 409);
      await serial(async (tx) => {
        const current = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
        if (current.stripeSessionId) throw new CommerceError('Payment state changed. Reconcile again.', 409);
        if (current.inventoryState === 'HELD' && current.status === 'AWAITING_PAYMENT') {
          await changeOrderStock(tx, current, 'release', 'reconciliation');
          await tx.order.update({ where: { id }, data: { status: 'CANCELLED', issue: null } });
          await orderEvent(tx, id, 'reconciliation', 'No provider session exists after the creation window; stock released.');
        }
      });
      return;
    }
  }
  let session = await gateway.retrieveSession(sessionId);
  if (cancel && session.status === 'open') {
    try { session = await gateway.expireSession(sessionId); }
    catch { session = await gateway.retrieveSession(sessionId); } // Payment may have won the race.
  }
  await syncSession(session);
  const intentId = objectId(session.payment_intent);
  if (intentId && session.payment_status === 'paid') {
    const intent = await gateway.retrieveIntent(intentId);
    const chargeId = objectId(intent.latest_charge);
    if (chargeId) await syncCharge(await gateway.retrieveCharge(chargeId));
  }
}

async function chargeOrderId(charge: Stripe.Charge) {
  const intentId = objectId(charge.payment_intent);
  if (!intentId) return null;
  const order = await getPrisma().order.findUnique({ where: { stripeIntentId: intentId }, select: { id: true } });
  return order?.id ?? (await gateway.retrieveIntent(intentId)).metadata.orderId ?? null;
}

export async function syncCharge(charge: Stripe.Charge, event?: { id: string; type: string }) {
  const id = await chargeOrderId(charge);
  await serial(async (tx) => {
    if (event && await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
    const order = id ? await tx.order.findUnique({ where: { id }, include: orderInclude }) : null;
    if (order && order.channel === 'STRIPE') {
      if (charge.currency !== order.currency || charge.amount !== order.totalPence || charge.livemode !== paymentConfig().live || (order.stripeIntentId && objectId(charge.payment_intent) !== order.stripeIntentId)) {
        await review(tx, order, 'Refund amount, currency or payment mode needs review.');
      } else if (charge.amount_refunded > order.totalPence) {
        await review(tx, order, 'Refund total exceeds the recorded order amount.');
      } else if (charge.amount_refunded > 0 && charge.amount_refunded >= order.refundedPence) {
        await tx.order.update({ where: { id: order.id }, data: { stripeIntentId: objectId(charge.payment_intent), refundedPence: charge.amount_refunded } });
        if (charge.amount_refunded === order.totalPence) {
          if (order.inventoryState === 'HELD') await changeOrderStock(tx, order, 'release', 'stripe-refund');
          const requested = await tx.refund.findFirst({ where: { orderId: order.id, restock: true, status: { in: ['pending', 'succeeded'] } } });
          if (requested && order.inventoryState === 'SOLD') await changeOrderStock(tx, order, 'restock', requested.actor);
          await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED', issue: null, checkoutUrl: null } });
          if (order.status !== 'REFUNDED') await orderEvent(tx, order.id, 'stripe', 'Full refund confirmed. Stock returned only when explicitly requested or still reserved.');
        } else { await review(tx, order, 'Partial refund recorded. Review this order before fulfilment; stock has not been returned.'); }
      }
    }
    if (event) await tx.paymentEvent.create({ data: event });
  });
}

export async function syncRefund(refund: Stripe.Refund, event?: { id: string; type: string }) {
  const localId = refund.metadata?.refundId;
  await serial(async (tx) => {
    const local = localId ? await tx.refund.findUnique({ where: { id: localId } }) : null;
    if (!local) return;
    if (objectId(refund.payment_intent) !== (await tx.order.findUniqueOrThrow({ where: { id: local.orderId } })).stripeIntentId || refund.amount !== local.amountPence) throw new CommerceError('Refund identity mismatch.', 409);
    await tx.refund.update({ where: { id: local.id }, data: { stripeId: refund.id, status: refund.status ?? 'pending' } });
    if (refund.status === 'failed' || refund.status === 'canceled') {
      await tx.order.updateMany({ where: { id: local.orderId, status: 'REFUND_PENDING' }, data: { status: local.previousStatus, issue: 'Refund failed. No stock has been returned; review the payment before retrying.' } });
    }
  });
  let chargeId = objectId(refund.charge);
  if (!chargeId && refund.payment_intent) {
    chargeId = objectId((await gateway.retrieveIntent(objectId(refund.payment_intent)!)).latest_charge);
  }
  if (!chargeId) throw new CommerceError('Refund needs payment reconciliation; retry later.', 503);
  await syncCharge(await gateway.retrieveCharge(chargeId), event);
}

export async function reconcileRefund(id: string) {
  const order = await getPrisma().order.findUniqueOrThrow({ where: { id }, include: { refunds: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  const refund = order.refunds[0];
  if (order.channel !== 'STRIPE' || !refund || !order.stripeIntentId || refund.status !== 'pending') throw new CommerceError('No pending refund to reconcile.', 409);
  if (refund.stripeId) { await syncRefund(await gateway.retrieveRefund(refund.stripeId)); return; }
  let startingAfter: string | undefined;
  let exhausted = false;
  for (let page = 0; page < 20; page++) {
    const list = await gateway.listRefunds({ payment_intent: order.stripeIntentId, limit: 100, starting_after: startingAfter });
    const found = list.data.find((candidate) => candidate.metadata?.refundId === refund.id);
    if (found) { await syncRefund(await gateway.retrieveRefund(found.id)); return; }
    if (!list.has_more) { exhausted = true; break; }
    startingAfter = list.data.at(-1)?.id;
  }
  if (!exhausted) throw new CommerceError('Refund search needs further review; stock remains unchanged.', 409);
  if (Date.now() - refund.createdAt.getTime() < 23 * 60 * 60_000) {
    await syncRefund(await gateway.createRefund({ payment_intent: order.stripeIntentId, amount: refund.amountPence, metadata: { refundId: refund.id, orderId: id } }, `refund:${refund.id}`));
    return;
  }
  const intent = await gateway.retrieveIntent(order.stripeIntentId);
  const charge = objectId(intent.latest_charge);
  if (charge) await syncCharge(await gateway.retrieveCharge(charge));
  const latest = await getPrisma().order.findUniqueOrThrow({ where: { id } });
  if (latest.refundedPence > 0) throw new CommerceError('An external refund was found; review this order before changing stock.', 409);
  await serial(async (tx) => {
    const current = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
    if (current.status !== 'pending') return;
    await tx.refund.update({ where: { id: refund.id }, data: { status: 'failed' } });
    await tx.order.updateMany({ where: { id, status: 'REFUND_PENDING' }, data: { status: current.previousStatus, issue: 'No refund found after provider search. Check Stripe before retrying.' } });
    await orderEvent(tx, id, 'reconciliation', 'No provider refund found after the idempotency window; request marked failed.');
  });
}

export async function refundOrder(id: string, body: unknown, actor: string) {
  const data = record(body);
  const key = requestKey(data.requestKey);
  const reason = text(data.reason, 'Refund reason', 500);
  const restock = data.restock === true;
  const refund = await serial(async (tx) => {
    const previous = await tx.refund.findUnique({ where: { requestKey: key } });
    if (previous) {
      if (previous.orderId !== id || previous.reason !== reason || previous.restock !== restock) throw new CommerceError('Request key already used.', 409);
      return previous;
    }
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new CommerceError('Order not found.', 404);
    if (order.channel !== 'STRIPE' || !order.stripeIntentId || !['CONFIRMED', 'FULFILLED', 'REVIEW'].includes(order.status) || order.refundedPence > 0) throw new CommerceError('This order cannot be fully refunded here. Reconcile it or review it in Stripe.', 409);
    const result = await tx.refund.create({ data: { orderId: id, requestKey: key, amountPence: order.totalPence, reason, restock, actor, previousStatus: order.status } });
    await tx.order.update({ where: { id }, data: { status: 'REFUND_PENDING' } });
    await orderEvent(tx, id, actor, `Full refund requested: ${reason}${restock ? '; restock authorised after success' : '; no restock'}.`);
    return result;
  });
  const order = await getPrisma().order.findUniqueOrThrow({ where: { id } });
  const remote = refund.stripeId ? await gateway.retrieveRefund(refund.stripeId) : await gateway.createRefund({ payment_intent: order.stripeIntentId!, amount: refund.amountPence, metadata: { refundId: refund.id, orderId: id } }, `refund:${refund.id}`);
  await syncRefund(remote);
}

export async function handlePaymentEvent(event: Stripe.Event) {
  if (event.livemode !== paymentConfig().live) throw new CommerceError('Payment mode mismatch.', 400);
  if (await getPrisma().paymentEvent.findUnique({ where: { id: event.id } })) return;
  const marker = { id: event.id, type: event.type };
  if (['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'].includes(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    await syncSession(await gateway.retrieveSession(session.id), marker);
  } else if (event.type === 'charge.refunded') {
    await syncCharge(await gateway.retrieveCharge((event.data.object as Stripe.Charge).id), marker);
  } else if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    await syncRefund(await gateway.retrieveRefund((event.data.object as Stripe.Refund).id), marker);
  }
}
