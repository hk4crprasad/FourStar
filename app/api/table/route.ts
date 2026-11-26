import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, restaurantId } from '@/lib/db';
import { cookieOptions, secretEqual } from '@/lib/auth';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { activeTable, placeTableOrder, requestKinds, resolveTable, signedTableClaim, tableClaim, tableCode, tableCookie, tableOrderInput, tableOrderSelect } from '@/lib/table';

const actionInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('join'), token: z.string().length(43), code: z.string().trim().min(1).max(32) }).strict(),
  z.object({ action: z.literal('order'), order: tableOrderInput }).strict(),
  z.object({ action: z.literal('request'), type: z.enum(requestKinds) }).strict(),
]);

export function GET() {
  return respond(async () => {
    const session = await activeTable(await tableClaim());
    if (!session) throw new ApiError(403, 'This table visit has ended.');
    const [orders, requests] = await Promise.all([
      db.order.findMany({ where: { restaurantId, diningSessionId: session.id }, select: tableOrderSelect, orderBy: { createdAt: 'desc' } }),
      db.serviceRequest.findMany({ where: { sessionId: session.id, status: { not: 'RESOLVED' } }, select: { type: true, status: true } }),
    ]);
    return { table: session.table.number, orders, requests, billed: Boolean(session.bill) };
  });
}

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const input = actionInput.parse(await jsonBody(request));
    if (input.action === 'join') {
      const qr = await resolveTable(input.token);
      if (!qr) throw new ApiError(404, 'This table QR is unavailable.');
      const session = await db.diningSession.findFirst({
        where: { tableId: qr.tableId, restaurantId, closedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!session || !secretEqual(input.code, tableCode(session.id))) throw new ApiError(403, 'Ask staff for the current visit code.');
      const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(tableCookie, signedTableClaim(session.id, qr.id), {
        ...cookieOptions(request), expires: session.expiresAt,
      });
      return response;
    }
    const claim = await tableClaim();
    if (!claim) throw new ApiError(403, 'Join your table before ordering.');
    if (input.action === 'order') return placeTableOrder(claim.sessionId, input.order, claim);
    // A double-tap sends two identical requests; the loser fails serialisation, then sees the winner's row on retry.
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(async tx => {
          const session = await activeTable(claim, tx);
          if (!session) throw new ApiError(403, 'This table visit has ended.');
          const duplicate = await tx.serviceRequest.findFirst({ where: { sessionId: session.id, type: input.type, status: { not: 'RESOLVED' } } });
          if (duplicate) return { ok: true };
          const recent = await tx.serviceRequest.count({ where: { sessionId: session.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
          if (recent >= 3) throw new ApiError(429, 'Please wait a minute before sending another request.');
          await tx.serviceRequest.create({ data: { sessionId: session.id, type: input.type } });
          return { ok: true };
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (attempt >= 3 || !(typeof error === 'object' && error && 'code' in error && error.code === 'P2034')) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  });
}
