import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { hotelId } from '@/lib/hospitality';
import { roomTypeInput } from '@/lib/hotel-validation';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { id } from '@/lib/validation';

function save(request: Request, updating: boolean) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const { amenities, images, ...body } = roomTypeInput.parse(await jsonBody(request));
    const record = updating ? id.parse(new URL(request.url).searchParams.get('id')) : null;
    const records = await db.amenity.findMany({ where: { hotelId, id: { in: amenities } }, select: { id: true } });
    if (records.length !== amenities.length) throw new ApiError(400, 'One of the selected amenities was not found.');
    const create = images.map((url, position) => ({ url, position }));
    return record ? db.$transaction(async tx => {
      await tx.roomImage.deleteMany({ where: { roomTypeId: record, roomType: { hotelId } } });
      return tx.roomType.update({
        where: { id: record, hotelId }, data: { ...body, images: { create }, amenities: { set: records } }, select: { id: true },
      });
    }) : db.roomType.create({
      data: { ...body, hotelId, images: { create }, amenities: { connect: records } }, select: { id: true },
    });
  });
}
export function POST(request: Request) { return save(request, false); }
export function PATCH(request: Request) { return save(request, true); }
