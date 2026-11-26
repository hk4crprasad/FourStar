import { db } from '@/lib/db';
import { publicReservation } from '@/lib/hotel-db';
import { hotelId, isReservationId } from '@/lib/hospitality';
import { ApiError, respond } from '@/lib/http';

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    if (!isReservationId(id)) throw new ApiError(404, 'Reservation not found. Check the reservation ID.');
    const reservation = await db.reservation.findUnique({ where: { id, hotelId }, select: publicReservation });
    if (!reservation) throw new ApiError(404, 'Reservation not found. Check the reservation ID.');
    return reservation;
  });
}
