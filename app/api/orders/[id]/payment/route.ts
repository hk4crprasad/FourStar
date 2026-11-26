import { isOrderId } from '@/lib/domain';
import { z } from 'zod';
import { db, restaurantId } from '@/lib/db';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import {
  createRazorpayOrder, ensureCaptured, paymentForOrder, razorpayKeys, razorpayOrderId, razorpayPaymentId, validRazorpaySignature,
} from '@/lib/razorpay';

type Context = { params: Promise<{ id: string }> };
const signatureInput = z.object({
  razorpay_order_id: razorpayOrderId,
  razorpay_payment_id: razorpayPaymentId,
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

async function load(request: Request, { params }: Context) {
  verifyOrigin(request);
  const { id } = await params;
  if (!isOrderId(id)) throw new ApiError(404, 'Order not found.');
  const order = await db.order.findFirst({
    where: { id, restaurantId, payment: 'RAZORPAY_TEST' },
    select: { id: true, total: true, razorpayOrderId: true, paymentVerified: true, restaurant: { select: { name: true } } },
  });
  if (!order) throw new ApiError(404, 'Order not found.');
  return order;
}

async function finalize(id: string, paymentId: string) {
  const now = new Date();
  await db.order.updateMany({
    where: { id, paymentVerified: false },
    data: { paymentVerified: true, razorpayPaymentId: paymentId, createdAt: now, events: [{ status: 'PLACED', at: now.toISOString() }] },
  });
  return { verified: true } as const;
}

export function POST(request: Request, context: Context) {
  return respond(async () => {
    const order = await load(request, context);
    if (order.paymentVerified) return { verified: true };
    const keys = razorpayKeys();
    if (!keys) throw new ApiError(503, 'Razorpay Test Mode is unavailable.');
    let gatewayId = order.razorpayOrderId;

    if (gatewayId) {
      const previous = await paymentForOrder(gatewayId, order.total);
      if (previous) return finalize(order.id, await ensureCaptured(previous, gatewayId, order.total));
    } else {
      let created;
      try {
        created = await createRazorpayOrder(order.id, order.total);
      } catch (error) {
        const raced = await db.order.findUnique({ where: { id: order.id }, select: { razorpayOrderId: true } });
        if (!raced?.razorpayOrderId) throw error;
        created = raced.razorpayOrderId;
      }
      await db.order.updateMany({ where: { id: order.id, razorpayOrderId: null }, data: { razorpayOrderId: created } });
      gatewayId = (await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { razorpayOrderId: true } })).razorpayOrderId;
    }

    if (!gatewayId) throw new ApiError(409, 'Unable to start the test payment. Try again.');
    return { verified: false, keyId: keys.keyId, orderId: gatewayId, amount: order.total, name: order.restaurant.name };
  });
}

export function PATCH(request: Request, context: Context) {
  return respond(async () => {
    const order = await load(request, context);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = signatureInput.parse(await jsonBody(request));
    const keys = razorpayKeys();
    if (!keys) throw new ApiError(503, 'Razorpay Test Mode is unavailable.');
    if (!order.razorpayOrderId || razorpay_order_id !== order.razorpayOrderId ||
      !validRazorpaySignature(order.razorpayOrderId, razorpay_payment_id, razorpay_signature, keys.secret)) {
      throw new ApiError(400, 'The test payment signature could not be verified.');
    }
    if (order.paymentVerified) return { verified: true };
    const payment = await paymentForOrder(order.razorpayOrderId, order.total, razorpay_payment_id);
    if (!payment) throw new ApiError(409, 'Test payment not found.');
    return finalize(order.id, await ensureCaptured(payment, order.razorpayOrderId, order.total));
  });
}
