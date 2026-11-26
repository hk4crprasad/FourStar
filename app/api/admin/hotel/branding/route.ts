import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { hotelId } from '@/lib/hospitality';
import { hotelInput } from '@/lib/hotel-validation';
import { jsonBody, respond, verifyOrigin } from '@/lib/http';

export function PATCH(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    return db.hotel.update({ where: { id: hotelId }, data: hotelInput.parse(await jsonBody(request)) });
  });
}
