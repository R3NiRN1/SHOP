import { Prisma, OrderStatus } from '@prisma/client';
import { adminAccess, api, json, readJson } from '../../../../lib/commerce-http';
import { createOrder } from '../../../../lib/orders';
import { getPrisma } from '../../../../lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return api(async () => {
    const auth = await adminAccess(); if (!auth.ok) return auth.response;
    const params = new URL(request.url).searchParams;
    const page = Math.min(100_000, Math.max(1, Number.parseInt(params.get('page') ?? '1') || 1));
    const status = params.get('status') ?? '';
    const q = (params.get('q') ?? '').trim().slice(0, 100);
    const number = Number(q.replace(/^SHOP-/i, ''));
    const where: Prisma.OrderWhereInput = {
      ...(Object.values(OrderStatus).includes(status as OrderStatus) ? { status: status as OrderStatus } : {}),
      ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, ...(Number.isSafeInteger(number) && number > 0 ? [{ number }] : [])] } : {}),
    };
    const [orders, total] = await getPrisma().$transaction([
      getPrisma().order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25, select: { id: true, number: true, status: true, channel: true, email: true, totalPence: true, createdAt: true, issue: true, inventoryState: true } }),
      getPrisma().order.count({ where }),
    ]);
    return json({ orders, total, page, pageSize: 25 });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    const auth = await adminAccess(request); if (!auth.ok) return auth.response;
    return json(await createOrder(await readJson(request), 'MANUAL', auth.session.user?.email ?? 'admin'), 201);
  });
}
