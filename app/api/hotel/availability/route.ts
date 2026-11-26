import { db } from '@/lib/db';
import { getHotel, availableRooms } from '@/lib/hotel-db';
import { hotelDay } from '@/lib/hospitality';
import { stayInput, stayNights } from '@/lib/hotel-validation';
import { respond } from '@/lib/http';

export function GET(request: Request) {
  return respond(async () => {
    const params = new URL(request.url).searchParams;
    const stay = stayInput.parse({ checkIn: params.get('checkIn'), checkOut: params.get('checkOut'), guests: Number(params.get('guests')) });
    const hotel = await getHotel();
    const today = hotelDay(new Date(), hotel.timeZone);
    const nights = stayNights(stay, today);
    const results = await db.room.groupBy({ by: ['roomTypeId'], where: availableRooms(stay, today), _count: true });
    return { nights, available: results.map(room => ({ roomTypeId: room.roomTypeId, count: room._count })) };
  });
}
