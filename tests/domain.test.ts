import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { acceptingOrders, itemPrice, nextStatuses, totals } from '../lib/domain';
import { matchingPayment, validRazorpaySignature } from '../lib/razorpay';
import { verifyOrigin } from '../lib/http';
import { hotelDay, nightsBetween, reservationActions } from '../lib/hospitality';
import { stayNights } from '../lib/hotel-validation';
import { orderInput } from '../lib/validation';

test('checkout prices extras and rounds tax in paise', () => {
  const subtotal = 2 * itemPrice({ price: 38900, options: [{ label: 'Extra gravy', price: 3900 }] }, ['Extra gravy']);
  assert.deepEqual(totals(subtotal + 8900, 'DELIVERY', 500, 4900), {
    subtotal: 94500, tax: 4725, delivery: 4900, total: 104125,
  });
  assert.deepEqual(totals(38900, 'DINE_IN', 500, 4900), {
    subtotal: 38900, tax: 1945, delivery: 0, total: 40845,
  });
});

test('hours handle midnight, timezone and a manual closure', () => {
  const overnight = { opensAt: '18:00', closesAt: '02:00', timeZone: 'Asia/Kolkata', isOpen: true };
  const midnight = new Date('2026-11-26T19:30:00Z');
  assert.equal(acceptingOrders(overnight, midnight), true);
  assert.equal(acceptingOrders(overnight, new Date('2026-11-26T20:30:00Z')), false);
  assert.equal(acceptingOrders({ ...overnight, isOpen: false }, midnight), false);
  assert.equal(acceptingOrders({ ...overnight, opensAt: '00:00', closesAt: '00:00' }), true);
});

test('only delivery orders go out for delivery and terminal states have no actions', () => {
  assert.deepEqual(nextStatuses('DELIVERY', 'PLACED'), ['ACCEPTED', 'REJECTED']);
  assert.deepEqual(nextStatuses('DELIVERY', 'READY'), ['OUT_FOR_DELIVERY']);
  assert.deepEqual(nextStatuses('TAKEAWAY', 'READY'), ['COMPLETED']);
  assert.deepEqual(nextStatuses('DINE_IN', 'REJECTED'), []);
});

test('order payload rejects missing fulfilment fields and supplied prices', () => {
  const order = {
    requestId: randomUUID(), customerName: 'Demo Customer', mobile: '+91 98765 43210',
    type: 'DELIVERY', payment: 'RAZORPAY_TEST', items: [{ menuItemId: 'butter-chicken', quantity: 1, picks: [] }],
  };
  assert.equal(orderInput.safeParse(order).success, false);
  assert.equal(orderInput.safeParse({ ...order, type: 'DINE_IN' }).success, false);
  assert.equal(orderInput.safeParse({ ...order, type: 'TAKEAWAY', total: 1 }).success, false);
  assert.equal(orderInput.parse({ ...order, address: '12 Demo Road, Kataka' }).mobile, '+919876543210');
});

test('Razorpay verification binds signature and capture to the stored order and total', () => {
  const order = 'order_AAAA12345678';
  const payment = 'pay_BBBB12345678';
  const secret = 'unit-test';
  const signature = createHmac('sha256', secret).update(`${order}|${payment}`).digest('hex');
  assert.equal(validRazorpaySignature(order, payment, signature, secret), true);
  assert.equal(validRazorpaySignature('order_other', payment, signature, secret), false);
  assert.equal(validRazorpaySignature(order, payment, '00', secret), false);
  const capture = { id: payment, order_id: order, captured: true, status: 'captured', amount: 999, currency: 'INR', amount_refunded: 0 };
  assert.equal(matchingPayment(capture, order, 999), true);
  assert.equal(matchingPayment(capture, order, 998), false);
  assert.equal(matchingPayment({ ...capture, amount_refunded: 1 }, order, 999), false);
});

test('same-origin mutations use the incoming host when the server listens on an alias', () => {
  const request = (origin: string) => new Request('http://0.0.0.0:3000/api/orders', {
    headers: { host: 'localhost:3000', origin },
  });
  assert.doesNotThrow(() => verifyOrigin(request('http://localhost:3000')));
  assert.throws(() => verifyOrigin(request('https://unrelated.example')));
});

test('hotel stays use local date boundaries and exclusive checkout dates', () => {
  const now = new Date('2026-11-25T20:00:00Z');
  assert.equal(hotelDay(now, 'Asia/Kolkata'), '2026-11-26');
  assert.equal(nightsBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(stayNights({ checkIn: '2026-11-26', checkOut: '2026-11-27', guests: 2 }, '2026-11-26'), 1);
  assert.throws(() => stayNights({ checkIn: '2026-11-26', checkOut: '2026-11-26', guests: 2 }, '2026-11-26'));
  assert.throws(() => stayNights({ checkIn: '2026-11-25', checkOut: '2026-11-26', guests: 2 }, '2026-11-26'));
});

test('hotel and room service status paths require check-in before fulfilment', () => {
  assert.deepEqual(reservationActions('PENDING'), ['CONFIRMED', 'CANCELLED']);
  assert.deepEqual(reservationActions('CONFIRMED'), ['CHECKED_IN', 'CANCELLED']);
  assert.deepEqual(reservationActions('CHECKED_IN'), ['CHECKED_OUT']);
  assert.deepEqual(reservationActions('CHECKED_OUT'), []);
  assert.deepEqual(nextStatuses('ROOM_SERVICE', 'READY'), ['COMPLETED']);
  assert.equal(totals(38900, 'ROOM_SERVICE', 500, 4900).delivery, 0);
});
