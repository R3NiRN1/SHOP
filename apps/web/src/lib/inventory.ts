import { Prisma } from '@prisma/client';
import { getPrisma } from './prisma';
import { CommerceError, integer, record, requestKey, text } from './commerce-input';

export type Transaction = Prisma.TransactionClient;

// Every stock/order transition is a serializable transaction. Retrying the whole
// transaction rechecks the stock and state after concurrent writes have committed.
export async function serial<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await getPrisma().$transaction(work, { isolationLevel: 'Serializable', timeout: 15_000, maxWait: 5000 }); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (attempt >= 4 || (code !== 'P2034' && code !== 'P2002')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

type Movement = { varietyId: string; orderId?: string; operationKey: string; kind: string; stockDelta: number; reservedDelta?: number; setStock?: number; actor: string; reason: string };

export async function moveStock(tx: Transaction, input: Movement) {
  const variety = await tx.variety.findUnique({ where: { id: input.varietyId } });
  if (!variety) throw new CommerceError('Variety not found.', 404);
  if (variety.stock === null && input.setStock === undefined) throw new CommerceError(`Set the stock count for ${variety.name} first.`, 409);
  const stock = input.setStock ?? (variety.stock ?? 0) + input.stockDelta;
  const reserved = variety.reserved + (input.reservedDelta ?? 0);
  if (stock < reserved || stock < 0 || reserved < 0 || stock > 1_000_000) throw new CommerceError(`Not enough available stock for ${variety.name}.`, 409);
  const updated = await tx.variety.update({ where: { id: variety.id }, data: { stock, reserved, inventoryVersion: { increment: 1 } } });
  await tx.stockMovement.create({ data: {
    varietyId: variety.id, orderId: input.orderId, operationKey: input.operationKey, kind: input.kind,
    stockDelta: stock - (variety.stock ?? 0), reservedDelta: reserved - variety.reserved,
    stockAfter: stock, reservedAfter: reserved, actor: input.actor, reason: input.reason,
  } });
  return updated;
}

export async function adjustStock(varietyId: string, body: unknown, actor: string) {
  const data = record(body);
  const key = requestKey(data.requestKey);
  const reason = text(data.reason, 'Reason', 500);
  const mode = data.mode;
  if (mode !== 'delta' && mode !== 'count') throw new CommerceError('Choose an adjustment or a stock count.');
  const quantity = integer(data.quantity, 'Quantity', mode === 'count' ? 0 : -1_000_000, 1_000_000);
  const version = mode === 'count' ? integer(data.version, 'Inventory version', 0, 2_000_000_000) : null;
  return serial(async (tx) => {
    const previous = await tx.stockMovement.findUnique({ where: { varietyId_operationKey: { varietyId, operationKey: key } } });
    if (previous) {
      if (previous.reason !== reason || previous.kind !== mode || (mode === 'count' ? previous.stockAfter !== quantity : previous.stockDelta !== quantity) || previous.actor !== actor) throw new CommerceError('This request key was already used for a different adjustment.', 409);
      return tx.variety.findUniqueOrThrow({ where: { id: varietyId } });
    }
    const variety = await tx.variety.findUnique({ where: { id: varietyId } });
    if (!variety) throw new CommerceError('Variety not found.', 404);
    if (version !== null && variety.inventoryVersion !== version) throw new CommerceError('Stock changed while you were counting. Refresh the list and check the count again.', 409);
    return moveStock(tx, { varietyId, operationKey: key, kind: mode, stockDelta: mode === 'delta' ? quantity : 0,
      setStock: mode === 'count' ? quantity : undefined, actor, reason });
  });
}
