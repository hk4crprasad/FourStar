import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateOnly, hotelDay, hotelId } from '@/lib/hospitality';
import { roomInput } from '@/lib/hotel-validation';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { id } from '@/lib/validation';

function save(request: Request, updating: boolean) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const body = roomInput.parse(await jsonBody(request));
    const record = updating ? id.parse(new URL(request.url).searchParams.get('id')) : null;
    return db.$transaction(async tx => {
      if (!await tx.roomType.findUnique({ where: { id: body.roomTypeId, hotelId } })) throw new ApiError(400, 'Choose a valid room type.');
      if (!record) return tx.room.create({ data: { ...body, hotelId }, select: { id: true } });
      const room = await tx.room.findUniqueOrThrow({
        where: { id: record, hotelId }, include: { hotel: { select: { timeZone: true } } },
      });
      if (body.condition === 'MAINTENANCE' || body.roomTypeId !== room.roomTypeId) {
        const today = dateOnly(hotelDay(new Date(), room.hotel.timeZone));
        const operating = await tx.reservation.count({
          where: { roomId: room.id, OR: [{ status: 'CHECKED_IN' }, { status: { in: ['PENDING', 'CONFIRMED'] }, checkOut: { gt: today } }] },
        });
        if (operating) throw new ApiError(409, 'This room has an active or upcoming reservation.');
      }
      return tx.room.update({ where: { id: record, hotelId }, data: body, select: { id: true } });
    }, { isolationLevel: 'Serializable' });
  });
}
export function POST(request: Request) { return save(request, false); }
export function PATCH(request: Request) { return save(request, true); }
