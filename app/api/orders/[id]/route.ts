import { isOrderId } from '@/lib/domain';
import { db, restaurantId } from '@/lib/db';
import { ApiError, respond } from '@/lib/http';

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    if (!isOrderId(id)) throw new ApiError(404, 'Order not found. Check your order ID.');
    const order = await db.order.findFirst({
      where: { id, restaurantId, diningSessionId: null },
      select: { id: true, status: true, type: true, events: true, total: true, createdAt: true, paymentVerified: true },
    });
    if (!order) throw new ApiError(404, 'Order not found. Check your order ID.');
    return order;
  });
}
