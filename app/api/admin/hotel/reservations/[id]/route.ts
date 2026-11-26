import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { dayString, hotelDay, hotelId, isReservationId, reservationActions, reservationStates } from '@/lib/hospitality';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';

export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const { id } = await params;
    if (!isReservationId(id)) throw new ApiError(404, 'Reservation not found.');
    const { status } = z.object({ status: z.enum(reservationStates) }).strict().parse(await jsonBody(request));
    return db.$transaction(async tx => {
      const reservation = await tx.reservation.findUnique({
        where: { id, hotelId }, include: { room: true, hotel: { select: { timeZone: true } } },
      });
      if (!reservation) throw new ApiError(404, 'Reservation not found.');
      if (status === reservation.status) return { ok: true };
      if (!reservationActions(reservation.status).includes(status)) throw new ApiError(409, 'That reservation status change is unavailable.');
      if (status === 'CHECKED_IN') {
        const today = hotelDay(new Date(), reservation.hotel.timeZone);
        if (today < dayString(reservation.checkIn) || today >= dayString(reservation.checkOut)) {
          throw new ApiError(409, 'Check-in is available during the reserved stay dates.');
        }
        if (reservation.room.condition !== 'AVAILABLE' || reservation.room.housekeeping !== 'CLEAN') {
          throw new ApiError(409, 'Mark the room available and clean before check-in.');
        }
        const occupied = await tx.reservation.count({ where: { roomId: reservation.roomId, status: 'CHECKED_IN' } });
        if (occupied) throw new ApiError(409, 'Check out the current guest before checking in this guest.');
      }
      await tx.reservation.update({ where: { id, status: reservation.status }, data: { status, history: { create: { status } } } });
      if (status === 'CANCELLED' || status === 'CHECKED_OUT') await tx.reservationNight.deleteMany({ where: { reservationId: id } });
      if (status === 'CHECKED_OUT') await tx.room.update({ where: { id: reservation.roomId }, data: { housekeeping: 'DIRTY' } });
      return { ok: true };
    }, { isolationLevel: 'Serializable' });
  });
}
