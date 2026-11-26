import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { availableRooms } from '@/lib/hotel-db';
import { addDays, dateOnly, hotelDay, hotelId } from '@/lib/hospitality';
import { reservationInput, stayNights } from '@/lib/hotel-validation';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const input = reservationInput.parse(await jsonBody(request));
    const findDuplicate = () => db.reservation.findUnique({ where: { requestId: input.requestId }, select: { id: true } });
    const previous = await findDuplicate();
    if (previous) return previous;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const booking = await db.$transaction(async tx => {
          const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId } });
          const today = hotelDay(new Date(), hotel.timeZone);
          const nights = stayNights(input.stay, today);
          const room = await tx.room.findFirst({
            where: { ...availableRooms(input.stay, today), roomTypeId: input.roomTypeId },
            include: { roomType: { select: { name: true, nightlyRate: true } } }, orderBy: { number: 'asc' },
          });
          if (!room) throw new ApiError(409, 'This room type is unavailable for the selected dates and guest count.');
          const guest = await tx.guest.upsert({ where: { mobile: input.mobile }, create: { mobile: input.mobile }, update: {} });
          return tx.reservation.create({
            data: {
              id: `FSR-${randomBytes(12).toString('hex').toUpperCase()}`, requestId: input.requestId,
              hotelId, roomId: room.id, guestId: guest.id, guestName: input.guestName, email: input.email,
              roomTypeName: room.roomType.name, checkIn: dateOnly(input.stay.checkIn), checkOut: dateOnly(input.stay.checkOut),
              guestCount: input.stay.guests, nightlyRate: room.roomType.nightlyRate, total: nights * room.roomType.nightlyRate,
              payment: input.payment, history: { create: { status: 'PENDING' } },
              nights: { create: Array.from({ length: nights }, (_, i) => ({ roomId: room.id, night: dateOnly(addDays(input.stay.checkIn, i)) })) },
            }, select: { id: true },
          });
        }, { isolationLevel: 'Serializable' });
        return NextResponse.json(booking, { status: 201 });
      } catch (error) {
        if (!(typeof error === 'object' && error && 'code' in error && ['P2002', 'P2034'].includes(String(error.code)))) throw error;
        const duplicate = await findDuplicate();
        if (duplicate) return duplicate;
      }
    }
    throw new ApiError(409, 'Availability changed. Search again to select a room.');
  });
}
