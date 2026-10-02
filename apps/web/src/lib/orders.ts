import { createHash } from 'node:crypto';
import type { Order, OrderItem } from '@prisma/client';
import { getPrisma } from './prisma';
import { paymentConfig } from './commerce-config';
import { CommerceError, integer, parseOrder, record, text, toPence } from './commerce-input';
import { moveStock, serial, type Transaction } from './inventory';

export type OrderWithItems = Order & { items: OrderItem[] };
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const orderInclude = { items: { orderBy: { varietyId: 'asc' as const } } };
export const reference = (number: number) => `SHOP-${String(number).padStart(6, '0')}`;

export async function orderEvent(tx: Transaction, orderId: string, actor: string, message: string) {
  await tx.orderEvent.create({ data: { orderId, actor, message } });
}

export async function changeOrderStock(tx: Transaction, order: OrderWithItems, action: 'reserve' | 'sell' | 'release' | 'restock', actor: string) {
  const expected = action === 'reserve' ? 'NONE' : action === 'release' ? 'HELD' : action === 'restock' ? 'SOLD' : order.channel === 'STRIPE' ? 'HELD' : 'NONE';
  if (order.inventoryState !== expected) throw new CommerceError('Inventory state does not permit this action.', 409);
  for (const item of [...order.items].sort((a, b) => a.varietyId.localeCompare(b.varietyId))) {
    await moveStock(tx, { varietyId: item.varietyId, orderId: order.id, operationKey: `${action}:${order.id}`,
      kind: action, stockDelta: action === 'sell' ? -item.quantity : action === 'restock' ? item.quantity : 0,
      reservedDelta: action === 'reserve' ? item.quantity : action === 'release' || (action === 'sell' && order.inventoryState === 'HELD') ? -item.quantity : 0,
      actor, reason: `${action} ${reference(order.number)}` });
  }
  await tx.order.update({ where: { id: order.id }, data: { inventoryState: action === 'reserve' ? 'HELD' : action === 'sell' ? 'SOLD' : action === 'release' ? 'RELEASED' : 'RESTOCKED' } });
}

export async function createOrder(body: unknown, channel: 'MANUAL' | 'STRIPE', actorOrOwner: string) {
  const input = parseOrder(body);
  const data = record(body);
  const config = channel === 'STRIPE' ? paymentConfig() : null;
  if (channel === 'MANUAL' && data.delivery !== undefined && data.delivery !== 'shipping' && data.delivery !== 'collection') throw new CommerceError('Choose collection or shipping.');
  const delivery = config?.delivery ?? (data.delivery === 'shipping' ? 'shipping' : 'collection');
  const shippingPence = config?.shippingPence ?? integer(data.shippingPence ?? 0, 'Postage', 0, 999_999);
  if (delivery === 'collection' && shippingPence !== 0) throw new CommerceError('Collection has no postage charge.');
  const address = channel === 'MANUAL' && delivery === 'shipping' ? text(data.address, 'Delivery address', 1000) : null;
  const requestHash = digest(JSON.stringify({ ...input, requestKey: undefined, ...(channel === 'MANUAL' ? { delivery, shippingPence, address } : {}) }));
  return serial(async (tx) => {
    const previous = await tx.order.findUnique({ where: { requestKey: input.requestKey }, include: orderInclude });
    if (previous) {
      if (previous.channel !== channel || previous.requestHash !== requestHash || (channel === 'STRIPE' && previous.ownerHash !== actorOrOwner)) throw new CommerceError('That request key belongs to a different order.', 409);
      return previous;
    }
    const varieties = await tx.variety.findMany({ where: { id: { in: input.items.map((item) => item.varietyId) } } });
    const items = input.items.map((item) => {
      const variety = varieties.find((candidate) => candidate.id === item.varietyId);
      if (!variety || variety.archived || (channel === 'STRIPE' && !variety.published)) throw new CommerceError('An item is no longer available. Refresh your basket.', 409);
      if (variety.price === null) throw new CommerceError(`Set a price for ${variety.name} before ordering.`, 409);
      const unitPricePence = toPence(variety.price);
      if (channel === 'STRIPE' && unitPricePence === 0) throw new CommerceError(`Set a nonzero price for ${variety.name} before online checkout.`, 409);
      return { ...item, name: variety.name, unitPricePence };
    });
    const subtotalPence = items.reduce((sum, item) => sum + item.unitPricePence * item.quantity, 0);
    const totalPence = integer(subtotalPence + shippingPence, 'Order total (pence)', channel === 'STRIPE' ? 30 : 0, 99_999_999);
    const order = await tx.order.create({ data: {
      channel, requestKey: input.requestKey, requestHash, ownerHash: channel === 'STRIPE' ? actorOrOwner : null,
      email: input.email, customerName: input.customerName || null, notes: input.notes,
      delivery, shippingPence, subtotalPence, totalPence,
      ...(address ? { shippingAddress: { text: address } } : {}),
      checkoutOrigin: config?.origin, expiresAt: config ? new Date(Date.now() + 35 * 60_000) : null,
      status: channel === 'STRIPE' ? 'AWAITING_PAYMENT' : 'DRAFT', items: { create: items },
    }, include: orderInclude });
    if (channel === 'STRIPE') await changeOrderStock(tx, order, 'reserve', 'checkout');
    await orderEvent(tx, order.id, channel === 'STRIPE' ? 'checkout' : actorOrOwner, channel === 'STRIPE' ? 'Checkout started; stock reserved.' : 'Draft order created; stock unchanged.');
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });
}

export async function manualOrderAction(id: string, action: string, actor: string, reason = '') {
  return serial(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new CommerceError('Order not found.', 404);
    if (action === 'confirm') {
      if (order.channel !== 'MANUAL') throw new CommerceError('Online orders are confirmed by the payment provider.', 409);
      if (order.status === 'CONFIRMED' || order.status === 'FULFILLED') return order;
      if (order.status !== 'DRAFT') throw new CommerceError('Only a draft order can be confirmed.', 409);
      await changeOrderStock(tx, order, 'sell', actor);
      await tx.order.update({ where: { id }, data: { status: 'CONFIRMED', paidAt: new Date() } });
    } else if (action === 'fulfil') {
      if (order.status === 'FULFILLED') return order;
      if (order.status !== 'CONFIRMED' || order.inventoryState !== 'SOLD') throw new CommerceError('Confirm payment before marking an order fulfilled.', 409);
      await tx.order.update({ where: { id }, data: { status: 'FULFILLED', fulfilledAt: new Date() } });
    } else if (action === 'cancel') {
      if (order.channel !== 'MANUAL') throw new CommerceError('Use payment reconciliation or refund for an online order.', 409);
      if (order.status === 'CANCELLED') return order;
      if (!['DRAFT', 'CONFIRMED'].includes(order.status)) throw new CommerceError('This order cannot be cancelled.', 409);
      if (!reason) throw new CommerceError('Record the reason and any offline refund.');
      if (order.inventoryState === 'SOLD') await changeOrderStock(tx, order, 'restock', actor);
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
    } else if (action === 'restock') {
      if (order.inventoryState === 'RESTOCKED') return order;
      if (order.status !== 'REFUNDED' || !reason) throw new CommerceError('Refund the order and record why its items can be resold.', 409);
      await changeOrderStock(tx, order, 'restock', actor);
    } else { throw new CommerceError('Unknown order action.'); }
    await orderEvent(tx, id, actor, `${action}${reason ? `: ${reason}` : ''}`);
    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  });
}

export function getOrder(id: string) {
  return getPrisma().order.findUnique({ where: { id }, include: { ...orderInclude, events: { orderBy: { createdAt: 'desc' }, take: 100 }, refunds: { orderBy: { createdAt: 'desc' } } } });
}
