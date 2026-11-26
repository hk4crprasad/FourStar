import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from './http';

export const razorpayOrderId = z.string().regex(/^order_[a-zA-Z0-9]{8,40}$/);
export const razorpayPaymentId = z.string().regex(/^pay_[a-zA-Z0-9]{8,40}$/);

const gatewayOrder = z.object({
  id: razorpayOrderId,
  amount: z.number().int(),
  currency: z.literal('INR'),
  receipt: z.string(),
});

const gatewayPayment = z.object({
  id: razorpayPaymentId,
  amount: z.number().int(),
  currency: z.string(),
  order_id: razorpayOrderId.nullable(),
  status: z.string(),
  captured: z.boolean(),
  amount_refunded: z.number().int(),
});

export function razorpayKeys() {
  const keyId = process.env.RAZORPAY_TEST_KEY_ID;
  const secret = process.env.RAZORPAY_TEST_KEY_SECRET;
  return keyId?.startsWith('rzp_test_') && secret ? { keyId, secret } : null;
}

export function validRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

async function gateway<T>(path: string, schema: z.ZodType<T>, body?: object) {
  const keys = razorpayKeys();
  if (!keys) throw new ApiError(503, 'Razorpay Test Mode is unavailable.');
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      cache: 'no-store',
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(502, 'Razorpay Test Mode could not be reached. Try again.');
  }
  if (!response.ok) {
    console.error('Razorpay Test Mode returned HTTP', response.status);
    throw new ApiError(502, 'Razorpay Test Mode could not complete this request. Try again.');
  }
  const result = schema.safeParse(await response.json().catch(() => null));
  if (!result.success) throw new ApiError(502, 'Razorpay returned an unexpected response.');
  return result.data;
}

export async function createRazorpayOrder(id: string, total: number) {
  const order = await gateway('orders', gatewayOrder, { amount: total, currency: 'INR', receipt: id });
  if (order.amount !== total || order.receipt !== id) throw new ApiError(502, 'Razorpay returned an unexpected order amount or receipt.');
  return order.id;
}

type Payment = z.infer<typeof gatewayPayment>;
export function matchingPayment(payment: Payment, orderId: string, total: number) {
  return payment.order_id === orderId && payment.amount === total && payment.currency === 'INR' && payment.amount_refunded === 0;
}

export async function paymentForOrder(orderId: string, total: number, paymentId?: string) {
  if (paymentId) {
    const payment = await gateway(`payments/${paymentId}`, gatewayPayment);
    if (!matchingPayment(payment, orderId, total)) throw new ApiError(409, 'This payment does not match the order.');
    return payment;
  }
  const { items } = await gateway(`orders/${orderId}/payments`, z.object({ items: z.array(gatewayPayment) }));
  return items.find(payment => matchingPayment(payment, orderId, total) && ['captured', 'authorized'].includes(payment.status));
}

export async function ensureCaptured(payment: Payment, orderId: string, total: number) {
  if (payment.status === 'captured' && payment.captured) return payment.id;
  if (payment.status !== 'authorized') throw new ApiError(409, 'The test payment has not completed. Try again.');
  let captured: Payment;
  try {
    captured = await gateway(`payments/${payment.id}/capture`, gatewayPayment, { amount: total, currency: 'INR' });
  } catch (error) {
    const latest = await paymentForOrder(orderId, total, payment.id);
    if (!latest?.captured) throw error;
    captured = latest;
  }
  if (!matchingPayment(captured, orderId, total) || !captured.captured || captured.status !== 'captured') {
    throw new ApiError(409, 'The test payment has not been captured. Try again.');
  }
  return captured.id;
}
