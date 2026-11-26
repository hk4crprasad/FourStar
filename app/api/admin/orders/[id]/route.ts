import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { db, restaurantId } from '@/lib/db';
import { isOrderId, nextStatuses, statuses, type Event } from '@/lib/domain';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';

export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const { id } = await params;
    if (!isOrderId(id)) throw new ApiError(404, 'Order not found.');
    const { status } = z.object({ status: z.enum(statuses) }).strict().parse(await jsonBody(request));
    const order = await db.order.findFirst({ where: { id, restaurantId, paymentVerified: true } });
    if (!order) throw new ApiError(404, 'Order not found.');
    if (order.status === status) return { ok: true };
    if (!nextStatuses(order.type, order.status).includes(status)) throw new ApiError(409, 'This order has changed. Refresh its status and try again.');
    const events = [...order.events as Event[], { status, at: new Date().toISOString() }];
    const updated = await db.order.updateMany({ where: { id, status: order.status }, data: { status, events } });
    if (!updated.count) throw new ApiError(409, 'Another staff member just updated this order.');
    return { ok: true };
  });
}
