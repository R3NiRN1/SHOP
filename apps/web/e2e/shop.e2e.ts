import { expect, test, type Page } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma';

const prisma = getPrisma();

function assertDisposableDatabase() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required for browser tests.');

  const databaseUrl = new URL(configuredUrl);
  const isLocal = databaseUrl.hostname === '127.0.0.1' || databaseUrl.hostname === 'localhost';
  if (!isLocal || databaseUrl.pathname !== '/shop_test' || databaseUrl.username !== 'shop_test') {
    throw new Error('Refusing to run destructive browser-test cleanup outside the local shop_test database.');
  }
}

async function signIn(page: Page, password = 'browser-test-admin-password') {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/api\/auth\/signin/);
  await page.locator('input[name="email"]').fill('admin@shop.test');
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

test.beforeAll(async () => {
  assertDisposableDatabase();
  await prisma.$connect();
});

test.beforeEach(async () => {
  await prisma.story.deleteMany();
  await prisma.variety.deleteMany();
  await prisma.grower.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.user.deleteMany();
  await prisma.variety.createMany({
    data: [
      {
        slug: 'browser-published-bean',
        name: 'Browser Published Bean',
        description: 'Visible browser test record.',
        price: '3.25',
        stock: 12,
        published: true,
      },
      {
        slug: 'browser-private-bean',
        name: 'Browser Private Bean',
        description: 'Unpublished browser test record.',
        price: '4.50',
        stock: 8,
        published: false,
      },
    ],
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('renders only published catalogue entries and presents no checkout flow', async ({ page }) => {
  await page.goto('/varieties');
  await expect(page.getByRole('heading', { name: 'Seed varieties' })).toBeVisible();
  await expect(page.getByText('Browser Published Bean')).toBeVisible();
  await expect(page.getByText('Browser Private Bean')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Enquire about this seed' })).toBeVisible();
  await expect(page.getByRole('button', { name: /checkout|buy|cart/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /checkout|buy|cart/i })).toHaveCount(0);

  const readiness = await page.request.get('/api/ready');
  expect(readiness.status()).toBe(200);
  await expect(readiness.json()).resolves.toEqual({ ready: true, kind: 'readiness' });
});

test('rejects failed login and unauthenticated admin writes', async ({ page, request }) => {
  const unauthenticatedWrite = await request.post('/api/admin/varieties', {
    data: { slug: 'unauthorized', name: 'Unauthorized', published: true },
  });
  expect(unauthenticatedWrite.status()).toBe(401);

  await signIn(page, 'incorrect-password');
  await expect(page).toHaveURL(/error=CredentialsSignin/);
  const session = await page.request.get('/api/auth/session');
  expect(session.status()).toBe(200);
  await expect(session.json()).resolves.toEqual({});
});

test('persists admin create, edit and delete through the browser UI', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin home' })).toBeVisible();

  await page.getByRole('link', { name: 'Manage varieties' }).click();
  await page.getByLabel('Name').fill('Browser CRUD Bean');
  await page.getByLabel('Slug').fill('browser-crud-bean');
  await page.getByLabel('Species').fill('Phaseolus vulgaris');
  await page.getByLabel('Description').fill('Created through Playwright.');
  await page.getByLabel('Price (£)').fill('12.34');
  await page.getByLabel('Stock').fill('9');
  await page.getByLabel('Published').check();
  await page.getByRole('button', { name: 'Create variety' }).click();

  let record = page.locator('article').filter({ hasText: 'Browser CRUD Bean' });
  await expect(record).toContainText('Published');
  await expect(
    prisma.variety.findUnique({ where: { slug: 'browser-crud-bean' } }),
  ).resolves.toMatchObject({ name: 'Browser CRUD Bean', stock: 9, published: true });

  await record.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('Browser CRUD Bean Updated');
  await page.getByLabel('Price (£)').fill('0.01');
  await page.getByLabel('Stock').fill('0');
  await page.getByRole('button', { name: 'Update variety' }).click();

  record = page.locator('article').filter({ hasText: 'Browser CRUD Bean Updated' });
  await expect(record).toContainText('0 packets');
  const updated = await prisma.variety.findUniqueOrThrow({ where: { slug: 'browser-crud-bean' } });
  expect(updated.price?.toString()).toBe('0.01');
  expect(updated.stock).toBe(0);

  const crossOriginWrite = await page.request.post('/api/admin/varieties', {
    headers: {
      origin: 'https://attacker.test',
      'sec-fetch-site': 'cross-site',
    },
    data: { slug: 'cross-origin', name: 'Cross origin', published: true },
  });
  expect(crossOriginWrite.status()).toBe(403);

  page.once('dialog', (dialog) => dialog.accept());
  await record.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Browser CRUD Bean Updated')).toHaveCount(0);
  await expect(prisma.variety.findUnique({ where: { slug: 'browser-crud-bean' } })).resolves.toBeNull();
});
