import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db, restaurantId } from '@/lib/db';
import { acceptingOrders, itemPrice, totals, type Option } from '@/lib/domain';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { orderInput } from '@/lib/validation';
import { activeGuest, sessionReservationId } from '@/lib/room-service';
import { razorpayKeys } from '@/lib/razorpay';

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const input = orderInput.parse(await jsonBody(request));
    const service = input.type === 'ROOM_SERVICE';
    const reservationId = service ? await sessionReservationId() : null;
    if (service && !reservationId) throw new ApiError(403, 'Verify an active check-in before ordering room service.');
    const online = input.payment === 'RAZORPAY_TEST';
    if (online && !razorpayKeys()) throw new ApiError(503, 'Razorpay Test Mode is unavailable. Choose another demo payment method.');
    const findExisting = () => db.order.findUnique({ where: { requestId: input.requestId, diningSessionId: null }, select: { id: true } });
    const existing = await findExisting();
    if (existing) return existing;

    try {
      const order = await db.$transaction(async tx => {
        const guest = reservationId ? await activeGuest(reservationId, tx) : null;
        if (service && !guest) throw new ApiError(403, 'Room service is available to checked-in guests.');
        const mobile = guest?.guest.mobile ?? input.mobile;
        const customerName = guest?.guestName ?? input.customerName;
        if (!mobile || !customerName) throw new ApiError(400, 'Enter your name and mobile number.');
        const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
        if (!acceptingOrders(restaurant)) throw new ApiError(409, 'The kitchen is closed. Please check the restaurant hours.');
        if (input.type === 'DINE_IN' && input.tableNumber && await tx.restaurantTable.findUnique({
          where: { restaurantId_number: { restaurantId, number: input.tableNumber.toUpperCase() } },
          select: { id: true },
        })) throw new ApiError(400, 'Scan your table’s QR code or ask staff to place the order.');
        const items = await tx.menuItem.findMany({
          where: { restaurantId, id: { in: input.items.map(line => line.menuItemId) } },
        });
        const lines = input.items.map(line => {
          const item = items.find(candidate => candidate.id === line.menuItemId);
          if (!item?.inStock) throw new ApiError(409, `${item?.name ?? 'A dish in your order'} is no longer available. Update your cart and try again.`);
          const options = item.options as Option[];
          if (line.picks.some(label => !options.some(option => option.label === label))) {
            throw new ApiError(409, `The options for ${item.name} have changed. Please add it again.`);
          }
          return {
            menuItemId: item.id, name: item.name, quantity: line.quantity,
            options: line.picks, unitPrice: itemPrice({ price: item.price, options }, line.picks),
          };
        });
        const customer = await tx.customer.upsert({ where: { mobile }, create: { mobile }, update: {} });
        const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
        const amount = totals(subtotal, input.type, restaurant.taxBps, restaurant.deliveryFee);
        if (amount.total > 2_147_483_647) throw new ApiError(400, 'This order exceeds the maximum total.');
        return tx.order.create({
          data: {
            id: `FS-${randomBytes(10).toString('hex').toUpperCase()}`,
            requestId: input.requestId, restaurantId, customerId: customer.id, customerName, reservationId: guest?.id, roomNumber: guest?.room.number,
            type: input.type, tableNumber: input.type === 'DINE_IN' ? input.tableNumber : null,
            address: input.type === 'DELIVERY' ? input.address : null,
            instructions: input.instructions, payment: input.payment,
            paymentVerified: !online,
            events: online ? [] : [{ status: 'PLACED', at: new Date().toISOString() }],
            ...amount,
            items: { create: lines },
          },
          select: { id: true },
        });
      }, { isolationLevel: 'Serializable' });
      return NextResponse.json(order, { status: 201 });
    } catch (error) {
      const duplicate = await findExisting();
      if (duplicate) return duplicate;
      throw error;
    }
  });
}
