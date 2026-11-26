import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { db, restaurantId } from '@/lib/db';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { issueToken, placeTableOrder, sessionHours, tableCode, tableOrderInput, tableOrderSelect, terminal, tokenFor } from '@/lib/table';

const id = z.string().min(1).max(100);
const tableFields = {
  number: z.string().trim().regex(/^[A-Za-z0-9-]{1,16}$/),
  name: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(60),
  enabled: z.boolean(),
};
const actionInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: id.optional(), ...tableFields }).strict(),
  z.object({ action: z.enum(['rotate', 'revoke', 'open', 'close']), id }).strict(),
  z.object({ action: z.literal('manual'), id, order: tableOrderInput }).strict(),
  z.object({ action: z.literal('request'), id, requestId: id, status: z.enum(['ACKNOWLEDGED', 'RESOLVED']) }).strict(),
  z.object({ action: z.literal('bill'), id, discount: z.number().int().min(0).max(2_147_483_647) }).strict(),
  z.object({ action: z.literal('pay'), id, method: z.enum(['CASH', 'UPI']) }).strict(),
  z.object({ action: z.literal('removeItem'), id, itemId: id }).strict(),
]);

export function GET() {
  return respond(async () => {
    await requireStaff();
    const tables = await db.restaurantTable.findMany({
      where: { restaurantId }, orderBy: { number: 'asc' },
      include: {
        qrTokens: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
        sessions: { where: { restaurantId }, orderBy: { openedAt: 'desc' }, take: 1,
          include: { orders: { where: { restaurantId }, select: tableOrderSelect, orderBy: { createdAt: 'asc' } },
            requests: { orderBy: { createdAt: 'desc' } }, bill: { include: { payments: true } } } },
      },
    });
    return tables.map(({ qrTokens, sessions, ...table }) => ({
      ...table,
      token: qrTokens[0] ? tokenFor(qrTokens[0].id) : null,
      session: sessions[0] ? { ...sessions[0], code: sessions[0].closedAt ? null : tableCode(sessions[0].id) } : null,
    }));
  });
}

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const input = actionInput.parse(await jsonBody(request));
    if (input.action === 'manual') return placeTableOrder(input.id, input.order);

    return db.$transaction(async tx => {
      if (input.action === 'save') {
        const { action: _action, id, ...fields } = input;
        const data = { ...fields, number: fields.number.toUpperCase() };
        const table = id ? await tx.restaurantTable.update({ where: { id, restaurantId }, data })
          : await tx.restaurantTable.create({ data: { ...data, restaurantId } });
        if (!id) await issueToken(tx, table.id);
        return { id: table.id };
      }
      if (input.action === 'rotate' || input.action === 'revoke' || input.action === 'open') {
        const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: input.id, restaurantId } });
        if (input.action === 'open') {
          if (!table.enabled) throw new ApiError(409, 'Enable the table first.');
          const current = await tx.diningSession.findFirst({ where: { tableId: table.id, restaurantId, closedAt: null } });
          if (current) throw new ApiError(409, 'Close the previous session first.');
          const session = await tx.diningSession.create({ data: {
            restaurantId, tableId: table.id, expiresAt: new Date(Date.now() + sessionHours * 3_600_000),
          } });
          return { code: tableCode(session.id) };
        }
        await tx.tableQrToken.updateMany({ where: { tableId: table.id, revokedAt: null }, data: { revokedAt: new Date() } });
        if (input.action === 'rotate') await issueToken(tx, table.id);
        return { ok: true };
      }

      const session = await tx.diningSession.findFirst({
        where: { id: input.id, restaurantId, closedAt: null },
        include: { orders: { where: { restaurantId }, include: { items: true } }, bill: { include: { payments: true } } },
      });
      if (!session) throw new ApiError(409, 'This visit is closed.');
      if (input.action === 'request') {
        const changed = await tx.serviceRequest.updateMany({
          where: { id: input.requestId, sessionId: session.id, status: { not: 'RESOLVED' } }, data: { status: input.status },
        });
        if (!changed.count) throw new ApiError(409, 'This request has already been resolved.');
        return { ok: true };
      }
      if (input.action === 'removeItem') {
        const order = session.orders.find(order => order.items.some(item => item.id === input.itemId));
        if (!order || session.bill || !['PLACED', 'ACCEPTED'].includes(order.status) || order.items.length < 2) {
          throw new ApiError(409, 'Remove items before preparation begins. Cancel the order if it has only one item.');
        }
        const subtotal = order.items.filter(item => item.id !== input.itemId).reduce((n, item) => n + item.quantity * item.unitPrice, 0);
        const tax = order.subtotal ? Math.round(order.tax * subtotal / order.subtotal) : 0;
        await tx.order.update({ where: { id: order.id, status: order.status }, data: {
          subtotal, tax, total: subtotal + tax, items: { delete: { id: input.itemId } },
          events: [...(Array.isArray(order.events) ? order.events : []), { status: order.status, at: new Date().toISOString(), cancelledItem: input.itemId }],
        } });
        return { ok: true };
      }
      if (input.action === 'pay') {
        if (!session.bill) throw new ApiError(409, 'Issue the bill first.');
        if (session.bill.payments.length || session.bill.total === 0) return { ok: true };
        await tx.paymentRecord.create({ data: { billId: session.bill.id, amount: session.bill.total, method: input.method } });
        return { ok: true };
      }
      if (session.orders.some(order => !terminal.some(status => status === order.status))) {
        throw new ApiError(409, 'Serve or cancel every order first.');
      }
      if (input.action === 'bill') {
        if (session.bill) return { id: session.bill.id };
        const served = session.orders.filter(order => order.status === 'COMPLETED');
        const subtotal = served.reduce((n, order) => n + order.subtotal, 0);
        const tax = served.reduce((n, order) => n + order.tax, 0);
        if (input.discount > subtotal + tax) throw new ApiError(400, 'The discount exceeds the bill amount.');
        if (subtotal + tax > 2_147_483_647) throw new ApiError(400, 'The bill exceeds the maximum total.');
        return tx.diningBill.create({ data: {
          sessionId: session.id, subtotal, tax, discount: input.discount, total: subtotal + tax - input.discount,
        }, select: { id: true } });
      }
      if (session.orders.some(order => order.status === 'COMPLETED') && !session.bill) throw new ApiError(409, 'Issue the bill before closing.');
      if (session.bill?.total && !session.bill.payments.length) throw new ApiError(409, 'Record payment before closing.');
      await tx.serviceRequest.updateMany({ where: { sessionId: session.id, status: { not: 'RESOLVED' } }, data: { status: 'RESOLVED' } });
      await tx.diningSession.update({ where: { id: session.id }, data: { closedAt: new Date() } });
      return { ok: true };
    }, { isolationLevel: 'Serializable' });
  });
}
