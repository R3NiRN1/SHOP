import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('persists admin create, read, update and delete operations', async () => {
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
        stock: 0,
        published: true,
      }),
      context(created.id),
    );
    expect(updateResponse.status).toBe(200);
    expect(await prisma.variety.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      slug: 'decimal-bean-updated',
      name: 'Decimal bean updated',
      stock: 0,
      published: true,
    });

    const deleteResponse = await DELETE(
      sameOriginRequest(`/api/admin/varieties/${created.id}`, 'DELETE'),
      context(created.id),
    );
    expect(deleteResponse.status).toBe(204);
    expect(await prisma.variety.findUnique({ where: { id: created.id } })).toBeNull();
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
      | { authorize?: (credentials: Record<string, string>, request: Record<string, unknown>) => Promise<unknown> }
      | undefined;
    expect(provider?.authorize).toBeTypeOf('function');

    const user = await provider?.authorize?.(
      { email: 'ADMIN@SHOP.TEST', password: 'integration-admin-password' },
      { headers: {}, body: {}, query: {}, method: 'POST' },
    );
    expect(user).toMatchObject({ email: 'admin@shop.test', role: 'ADMIN' });
    expect(await prisma.user.findUnique({ where: { email: 'admin@shop.test' } })).toMatchObject({ role: 'ADMIN' });

    await expect(
      provider?.authorize?.(
        { email: 'admin@shop.test', password: 'incorrect-password' },
        { headers: {}, body: {}, query: {}, method: 'POST' },
      ),
    ).resolves.toBeNull();
  });
});
