import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { secretEqual, signature } from './auth';
import { db, restaurantId } from './db';
import { acceptingOrders, itemPrice, totals, type Option } from './domain';
import { ApiError } from './http';
import { id } from './validation';

export const tableCookie = 'phirmy_table';
export const sessionHours = 4;
export const terminal = ['COMPLETED', 'REJECTED'] as const;
export const requestKinds = ['WAITER', 'WATER', 'BILL'] as const;
export const tableOrderInput = z.object({
  requestId: z.uuid(),
  instructions: z.string().trim().max(350).default(''),
  items: z.array(z.object({
    menuItemId: id,
    quantity: z.number().int().min(1).max(50),
    picks: z.array(z.string().trim().min(1).max(45)).max(15),
  }).strict()).min(1).max(50).refine(items => items.reduce((n, item) => n + item.quantity, 0) <= 100, 'Choose at most 100 items.'),
}).strict();

type Tx = Prisma.TransactionClient;
export type TableClaim = { sessionId: string; tokenId: string };
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const tokenFor = (id: string) => signature(`table-qr:${id}`);
export const tableCode = (id: string) => signature(`table-visit:${id}`).slice(0, 8);
export const signedTableClaim = (sessionId: string, tokenId: string) => {
  const payload = `${sessionId}.${tokenId}`;
  return `${payload}.${signature(`table-cookie:${payload}`)}`;
};

export async function tableClaim(): Promise<TableClaim | null> {
  const [sessionId, tokenId, mac, extra] = (await cookies()).get(tableCookie)?.value.split('.') ?? [];
  if (!sessionId || !tokenId || !mac || extra || !secretEqual(mac, signature(`table-cookie:${sessionId}.${tokenId}`))) return null;
  return { sessionId, tokenId };
}

export function resolveTable(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return null;
  return db.tableQrToken.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null, table: { restaurantId, enabled: true } },
    include: { table: true },
  });
}

export async function activeTable(claim: TableClaim | null, tx: Tx = db) {
  if (!claim) return null;
  const token = await tx.tableQrToken.findFirst({ where: { id: claim.tokenId, revokedAt: null, table: { enabled: true, restaurantId } } });
  if (!token) return null;
  return tx.diningSession.findFirst({
    where: { id: claim.sessionId, restaurantId, tableId: token.tableId, closedAt: null, expiresAt: { gt: new Date() } },
    include: { table: true, bill: true },
  });
}

export const tableOrderSelect = {
  id: true, diningSessionId: true, tableNumber: true, status: true, instructions: true, createdAt: true,
  updatedAt: true, subtotal: true, tax: true, total: true, events: true,
  items: { select: { id: true, name: true, quantity: true, unitPrice: true, options: true } },
} as const;

export async function placeTableOrder(sessionId: string, input: z.infer<typeof tableOrderInput>, claim?: TableClaim) {
  const existing = () => db.order.findFirst({ where: { requestId: input.requestId, diningSessionId: sessionId, restaurantId }, select: { id: true } });
  try {
    return await db.$transaction(async tx => {
      const session = claim ? await activeTable(claim, tx) : await tx.diningSession.findFirst({
        where: { id: sessionId, restaurantId, closedAt: null, expiresAt: { gt: new Date() }, table: { enabled: true } },
        include: { table: true, bill: true },
      });
      if (!session) throw new ApiError(403, 'This table visit has ended. Ask staff to open a new session.');
      const duplicate = await tx.order.findFirst({ where: { requestId: input.requestId, diningSessionId: session.id }, select: { id: true } });
      if (duplicate) return duplicate;
      if (session.bill) throw new ApiError(409, 'The bill has already been issued. Please ask staff for assistance.');
      const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      if (!acceptingOrders(restaurant)) throw new ApiError(409, 'The kitchen is closed.');
      const recent = await tx.order.count({ where: { diningSessionId: session.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
      if (recent >= 5) throw new ApiError(429, 'Please wait a minute before placing another order.');
      const menu = await tx.menuItem.findMany({ where: { restaurantId, id: { in: input.items.map(item => item.menuItemId) }, inStock: true } });
      const lines = input.items.map(line => {
        const item = menu.find(item => item.id === line.menuItemId);
        if (!item) throw new ApiError(409, 'An item is unavailable. Please update your cart.');
        const options = item.options as Option[];
        if (new Set(line.picks).size !== line.picks.length || line.picks.some(pick => !options.some(option => option.label === pick))) {
          throw new ApiError(400, 'An item option is invalid.');
        }
        return { menuItemId: item.id, name: item.name, quantity: line.quantity, options: line.picks, unitPrice: itemPrice({ price: item.price, options }, line.picks) };
      });
      const amount = totals(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), 'DINE_IN', restaurant.taxBps, 0);
      if (amount.total > 2_147_483_647) throw new ApiError(400, 'This order exceeds the maximum total.');
      const customer = await tx.customer.upsert({
        where: { mobile: 'table-guest' }, update: {}, create: { mobile: 'table-guest' },
      });
      return tx.order.create({
        data: {
          id: `FS-${randomBytes(10).toString('hex').toUpperCase()}`, requestId: input.requestId, restaurantId,
          type: 'DINE_IN', payment: 'CASH', customerId: customer.id, customerName: 'Table guest',
          tableNumber: session.table.number, diningSessionId: session.id, instructions: input.instructions,
          events: [{ status: 'PLACED', at: new Date().toISOString() }],
          ...amount, items: { create: lines },
        }, select: { id: true },
      });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (claim && !await activeTable(claim)) throw new ApiError(403, 'This table visit has ended.');
    const duplicate = await existing();
    if (duplicate) return duplicate;
    throw error;
  }
}

export function issueToken(tx: Tx, tableId: string) {
  const id = randomUUID();
  return tx.tableQrToken.create({ data: { id, tableId, tokenHash: hashToken(tokenFor(id)) } });
}
