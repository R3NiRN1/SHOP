import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

vi.mock('../lib/admin-auth', () => ({
  requireAdminSession: vi.fn(async () => ({
    ok: true as const,
    session: { user: { email: 'admin@shop.test' }, role: 'ADMIN' },
  })),
}));

import { DELETE, PATCH } from '../app/api/admin/varieties/[id]/route';
import { GET as getAdminVarieties, POST } from '../app/api/admin/varieties/route';
import { GET as getReady } from '../app/api/ready/route';
import { GET as getPublicVarieties } from '../app/api/varieties/route';
import { authOptions } from '../lib/auth-options';
import { adjustStock } from '../lib/inventory';
import { createOrder, manualOrderAction } from '../lib/orders';
import { gateway, reconcileRefund, refundOrder, syncSession } from '../lib/payments';
import { getPrisma } from '../lib/prisma';

const integration = process.env.RUN_POSTGRES_INTEGRATION === 'true' ? describe : describe.skip;

const sameOriginRequest = (path: string, method: string, body?: unknown) =>
  new Request(`http://shop.test${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'http://shop.test',
      'sec-fetch-site': 'same-origin',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const context = (id: string) => ({ params: Promise.resolve({ id }) });

function assertDisposableDatabase() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');

  const databaseUrl = new URL(configuredUrl);
  const isLocal = databaseUrl.hostname === '127.0.0.1' || databaseUrl.hostname === 'localhost';
  if (!isLocal || databaseUrl.pathname !== '/shop_test' || databaseUrl.username !== 'shop_test') {
    throw new Error('Refusing to run destructive integration-test cleanup outside the local shop_test database.');
  }
}

integration('PostgreSQL application integration', () => {
  let prisma: ReturnType<typeof getPrisma>;

  beforeAll(async () => {
    assertDisposableDatabase();
    prisma = getPrisma();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.paymentEvent.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.orderEvent.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.story.deleteMany();
    await prisma.variety.deleteMany();
    await prisma.grower.deleteMany();
    await prisma.subscriber.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects through the Prisma PostgreSQL adapter and reports ready', async () => {
    const result = await prisma.$queryRaw<Array<{ value: number }>>`SELECT 1::int AS value`;
    expect(result).toEqual([{ value: 1 }]);

    const response = await getReady();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ready: true, kind: 'readiness' });
  });

  it('returns published catalogue records while excluding unpublished records', async () => {
    await prisma.variety.createMany({
      data: [
        { slug: 'published-bean', name: 'Published bean', price: '3.25', stock: 12, published: true },
        { slug: 'private-bean', name: 'Private bean', price: '4.50', stock: 8, published: false },
      ],
    });

    const response = await getPublicVarieties();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: 'database',
      varieties: [{ slug: 'published-bean', name: 'Published bean', price: 3.25, published: true }],
    });
  });

  it('persists admin create, read, update and archive operations', async () => {
    const createResponse = await POST(
      sameOriginRequest('/api/admin/varieties', 'POST', {
        slug: 'decimal-bean',
        name: 'Decimal bean',
        species: 'Phaseolus vulgaris',
        price: '9876.54',
        stock: 7,
        published: false,
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string; price: number };
    expect(created.price).toBe(9876.54);

    const persisted = await prisma.variety.findUniqueOrThrow({ where: { id: created.id } });
    expect(persisted.price?.toString()).toBe('9876.54');

    const listResponse = await getAdminVarieties();
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({ varieties: [{ id: created.id }] });

    const updateResponse = await PATCH(
      sameOriginRequest(`/api/admin/varieties/${created.id}`, 'PATCH', {
        slug: 'decimal-bean-updated',
        name: 'Decimal bean updated',
        price: '0.01',
        published: true,
      }),
      context(created.id),
    );
    expect(updateResponse.status).toBe(200);
    expect(await prisma.variety.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      slug: 'decimal-bean-updated',
      name: 'Decimal bean updated',
      stock: 7,
      published: true,
    });

    const deleteResponse = await DELETE(
      sameOriginRequest(`/api/admin/varieties/${created.id}`, 'DELETE'),
      context(created.id),
    );
    expect(deleteResponse.status).toBe(204);
    expect(await prisma.variety.findUnique({ where: { id: created.id } })).toMatchObject({ archived: true, published: false });
  });

  it('records stock counts, rejects stale counts, and confirms a manual sale once', async () => {
    const variety = await prisma.variety.create({ data: { slug: 'sale-bean', name: 'Sale bean', price: '3.25', stock: 5, published: true } });
    const count = await adjustStock(variety.id, { requestKey: 'stock-count-first-001', mode: 'count', quantity: 6, version: 0, reason: 'Physical count' }, 'admin');
    expect(count.stock).toBe(6);
    await expect(adjustStock(variety.id, { requestKey: 'stock-count-stale-01', mode: 'count', quantity: 3, version: 0, reason: 'Stale count' }, 'admin')).rejects.toMatchObject({ status: 409 });
    const order = await createOrder({ requestKey: 'manual-order-first-001', email: 'buyer@example.test', items: [{ varietyId: variety.id, quantity: 2 }] }, 'MANUAL', 'admin');
    expect(order.status).toBe('DRAFT');
    const [first, second] = await Promise.all([manualOrderAction(order.id, 'confirm', 'admin'), manualOrderAction(order.id, 'confirm', 'admin')]);
    expect([first.status, second.status]).toEqual(['CONFIRMED', 'CONFIRMED']);
    expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 4, reserved: 0 });
    expect(await prisma.stockMovement.count({ where: { varietyId: variety.id, kind: 'sell' } })).toBe(1);
    await manualOrderAction(order.id, 'cancel', 'admin', 'Offline refund recorded');
    expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 6, reserved: 0 });
  });

  it('reserves stock atomically and prevents concurrent overselling', async () => {
    const old = { enabled: process.env.PAYMENTS_ENABLED, secret: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET, url: process.env.NEXTAUTH_URL, delivery: process.env.SHOP_DELIVERY };
    try {
      process.env.PAYMENTS_ENABLED = 'true'; process.env.STRIPE_SECRET_KEY = 'sk_test_123456789abcdef';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123456789abcdef'; process.env.NEXTAUTH_URL = 'http://localhost:3001'; process.env.SHOP_DELIVERY = 'collection';
      const variety = await prisma.variety.create({ data: { slug: 'last-bean', name: 'Last bean', price: '2.00', stock: 1, published: true } });
      const body = (key: string) => ({ requestKey: key, email: 'buyer@example.test', items: [{ varietyId: variety.id, quantity: 1 }] });
      const results = await Promise.allSettled([createOrder(body('checkout-first-0001'), 'STRIPE', 'owner-a'), createOrder(body('checkout-second-001'), 'STRIPE', 'owner-b')]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 1, reserved: 1 });
    } finally {
      for (const [key, value] of Object.entries({ PAYMENTS_ENABLED: old.enabled, STRIPE_SECRET_KEY: old.secret, STRIPE_WEBHOOK_SECRET: old.webhook, NEXTAUTH_URL: old.url, SHOP_DELIVERY: old.delivery })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('processes a paid session once and does not release sold stock on a replayed expiry', async () => {
    const old = { enabled: process.env.PAYMENTS_ENABLED, secret: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET, url: process.env.NEXTAUTH_URL, delivery: process.env.SHOP_DELIVERY };
    try {
      process.env.PAYMENTS_ENABLED = 'true'; process.env.STRIPE_SECRET_KEY = 'sk_test_123456789abcdef';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123456789abcdef'; process.env.NEXTAUTH_URL = 'http://localhost:3001'; process.env.SHOP_DELIVERY = 'collection';
      const variety = await prisma.variety.create({ data: { slug: 'paid-bean', name: 'Paid bean', price: '3.25', stock: 3, published: true } });
      const order = await createOrder({ requestKey: 'checkout-payment-0001', email: 'buyer@example.test', items: [{ varietyId: variety.id, quantity: 2 }] }, 'STRIPE', 'owner-a');
      const paid = { id: 'cs_test_example', client_reference_id: order.id, metadata: { orderId: order.id }, livemode: false, currency: 'gbp', amount_total: 650, status: 'complete', payment_status: 'paid', payment_intent: 'pi_test_example' } as unknown as Stripe.Checkout.Session;
      await syncSession(paid, { id: 'evt_paid_1', type: 'checkout.session.completed' });
      await syncSession(paid, { id: 'evt_paid_1', type: 'checkout.session.completed' });
      await syncSession({ ...paid, status: 'expired', payment_status: 'unpaid' } as Stripe.Checkout.Session, { id: 'evt_expired_1', type: 'checkout.session.expired' });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'CONFIRMED', inventoryState: 'SOLD' });
      expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 1, reserved: 0 });
      expect(await prisma.stockMovement.count({ where: { orderId: order.id, kind: 'sell' } })).toBe(1);
    } finally {
      for (const [key, value] of Object.entries({ PAYMENTS_ENABLED: old.enabled, STRIPE_SECRET_KEY: old.secret, STRIPE_WEBHOOK_SECRET: old.webhook, NEXTAUTH_URL: old.url, SHOP_DELIVERY: old.delivery })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('protects reserved packets from a physical count and releases an expired checkout once', async () => {
    const old = { enabled: process.env.PAYMENTS_ENABLED, secret: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET, url: process.env.NEXTAUTH_URL, delivery: process.env.SHOP_DELIVERY };
    try {
      process.env.PAYMENTS_ENABLED = 'true'; process.env.STRIPE_SECRET_KEY = 'sk_test_123456789abcdef';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123456789abcdef'; process.env.NEXTAUTH_URL = 'http://localhost:3001'; process.env.SHOP_DELIVERY = 'collection';
      const variety = await prisma.variety.create({ data: { slug: 'held-bean', name: 'Held bean', price: '4.00', stock: 2, published: true } });
      const order = await createOrder({ requestKey: 'checkout-expiry-00001', email: 'buyer@example.test', items: [{ varietyId: variety.id, quantity: 2 }] }, 'STRIPE', 'owner-a');
      await expect(adjustStock(variety.id, { requestKey: 'count-below-hold-001', mode: 'count', quantity: 1, version: 1, reason: 'Counted one' }, 'admin')).rejects.toMatchObject({ status: 409 });
      expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 2, reserved: 2 });
      const expired = { id: 'cs_test_expired', client_reference_id: order.id, metadata: { orderId: order.id }, livemode: false, currency: 'gbp', amount_total: 800, status: 'expired', payment_status: 'unpaid' } as unknown as Stripe.Checkout.Session;
      await syncSession(expired, { id: 'evt_expired_2', type: 'checkout.session.expired' });
      await syncSession(expired, { id: 'evt_expired_2', type: 'checkout.session.expired' });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'CANCELLED', inventoryState: 'RELEASED' });
      expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 2, reserved: 0 });
      expect(await prisma.stockMovement.count({ where: { orderId: order.id, kind: 'release' } })).toBe(1);
    } finally {
      for (const [key, value] of Object.entries({ PAYMENTS_ENABLED: old.enabled, STRIPE_SECRET_KEY: old.secret, STRIPE_WEBHOOK_SECRET: old.webhook, NEXTAUTH_URL: old.url, SHOP_DELIVERY: old.delivery })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('reconciles a succeeded refund after the charge summary catches up, then restocks once', async () => {
    const old = { enabled: process.env.PAYMENTS_ENABLED, secret: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET, url: process.env.NEXTAUTH_URL, delivery: process.env.SHOP_DELIVERY };
    try {
      process.env.PAYMENTS_ENABLED = 'true'; process.env.STRIPE_SECRET_KEY = 'sk_test_123456789abcdef';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123456789abcdef'; process.env.NEXTAUTH_URL = 'http://localhost:3001'; process.env.SHOP_DELIVERY = 'collection';
      const variety = await prisma.variety.create({ data: { slug: 'refunded-bean', name: 'Refunded bean', price: '3.25', stock: 2, published: true } });
      const order = await createOrder({ requestKey: 'checkout-refund-0001', email: 'buyer@example.test', items: [{ varietyId: variety.id, quantity: 1 }] }, 'STRIPE', 'owner-a');
      await syncSession({ id: 'cs_test_refund', client_reference_id: order.id, metadata: { orderId: order.id }, livemode: false, currency: 'gbp', amount_total: 325, status: 'complete', payment_status: 'paid', payment_intent: 'pi_test_refund' } as unknown as Stripe.Checkout.Session);
      const remoteRefund = (metadata: unknown) => ({ id: 're_test_refund', amount: 325, payment_intent: 'pi_test_refund', charge: 'ch_test_refund', metadata: metadata ?? {}, status: 'succeeded' } as Awaited<ReturnType<typeof gateway.createRefund>>);
      vi.spyOn(gateway, 'createRefund').mockImplementation(async (params) => remoteRefund(params.metadata));
      vi.spyOn(gateway, 'retrieveRefund').mockImplementation(async () => remoteRefund({ refundId: (await prisma.refund.findFirstOrThrow({ where: { orderId: order.id } })).id, orderId: order.id }));
      const charge = (amount_refunded: number) => ({ id: 'ch_test_refund', amount: 325, amount_refunded, currency: 'gbp', livemode: false, payment_intent: 'pi_test_refund' } as Awaited<ReturnType<typeof gateway.retrieveCharge>>);
      vi.spyOn(gateway, 'retrieveCharge').mockResolvedValueOnce(charge(0)).mockResolvedValue(charge(325));
      await refundOrder(order.id, { requestKey: 'refund-request-000001', reason: 'Customer returned unopened packets', restock: true }, 'admin');
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'REFUND_PENDING', inventoryState: 'SOLD', refundedPence: 0 });
      await reconcileRefund(order.id);
      await expect(reconcileRefund(order.id)).rejects.toMatchObject({ status: 409 });
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'REFUNDED', inventoryState: 'RESTOCKED', refundedPence: 325 });
      expect(await prisma.variety.findUniqueOrThrow({ where: { id: variety.id } })).toMatchObject({ stock: 2, reserved: 0 });
      expect(await prisma.stockMovement.count({ where: { orderId: order.id, kind: 'restock' } })).toBe(1);
    } finally {
      vi.restoreAllMocks();
      for (const [key, value] of Object.entries({ PAYMENTS_ENABLED: old.enabled, STRIPE_SECRET_KEY: old.secret, STRIPE_WEBHOOK_SECRET: old.webhook, NEXTAUTH_URL: old.url, SHOP_DELIVERY: old.delivery })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('maps duplicate slugs and missing records to conflict and not-found responses', async () => {
    const payload = { slug: 'unique-bean', name: 'Unique bean', price: '2.00', stock: 1, published: false };
    expect((await POST(sameOriginRequest('/api/admin/varieties', 'POST', payload))).status).toBe(201);
    expect((await POST(sameOriginRequest('/api/admin/varieties', 'POST', payload))).status).toBe(409);

    const missingId = 'missing-variety-id';
    const updateResponse = await PATCH(
      sameOriginRequest(`/api/admin/varieties/${missingId}`, 'PATCH', payload),
      context(missingId),
    );
    expect(updateResponse.status).toBe(404);
    expect((await DELETE(sameOriginRequest(`/api/admin/varieties/${missingId}`, 'DELETE'), context(missingId))).status).toBe(404);
  });

  it('round-trips valid decimal money and enforces database price and stock constraints', async () => {
    const exact = await prisma.variety.create({
      data: { slug: 'exact-price', name: 'Exact price', price: '1234.56', stock: 1 },
    });
    const reloaded = await prisma.variety.findUniqueOrThrow({ where: { id: exact.id } });
    expect(reloaded.price?.toString()).toBe('1234.56');

    await expect(
      prisma.variety.create({ data: { slug: 'negative-price', name: 'Negative price', price: '-0.01' } }),
    ).rejects.toThrow();
    await expect(
      prisma.variety.create({ data: { slug: 'negative-stock', name: 'Negative stock', stock: -1 } }),
    ).rejects.toThrow();
    expect(await prisma.variety.count({ where: { slug: { in: ['negative-price', 'negative-stock'] } } })).toBe(0);
  });

  it('authenticates the configured administrator and persists the ADMIN database role', async () => {
    const provider = authOptions.providers.find((candidate) => candidate.id === 'credentials') as
      | {
          options?: {
            authorize?: (credentials: Record<string, string>, request: Record<string, unknown>) => Promise<unknown>;
          };
        }
      | undefined;
    expect(provider?.options?.authorize).toBeTypeOf('function');

    const user = await provider?.options?.authorize?.(
      { email: 'ADMIN@SHOP.TEST', password: 'integration-admin-password' },
      { headers: {}, body: {}, query: {}, method: 'POST' },
    );
    expect(user).toMatchObject({ email: 'admin@shop.test', role: 'ADMIN' });
    expect(await prisma.user.findUnique({ where: { email: 'admin@shop.test' } })).toMatchObject({ role: 'ADMIN' });

    await expect(
      provider?.options?.authorize?.(
        { email: 'admin@shop.test', password: 'incorrect-password' },
        { headers: {}, body: {}, query: {}, method: 'POST' },
      ),
    ).resolves.toBeNull();
  });
});
