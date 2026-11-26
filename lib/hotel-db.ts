import type { Prisma } from '@/generated/prisma/client';
import { db, restaurantId } from './db';
import { addDays, dateOnly, hotelDay, hotelId, type Stay } from './hospitality';

export const roomTypeInclude = {
  images: { orderBy: { position: 'asc' } },
  amenities: { orderBy: { name: 'asc' } },
} as const;

export const publicReservation = {
  id: true, status: true, roomTypeName: true, checkIn: true, checkOut: true, guestCount: true,
  nightlyRate: true, total: true, history: { orderBy: { at: 'asc' }, select: { status: true, at: true } },
} as const;

export function getHotel() {
  return db.hotel.findUniqueOrThrow({ where: { id: hotelId, restaurantId } });
}

export function roomTypes() {
  return db.roomType.findMany({
    where: { hotelId, isListed: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: roomTypeInclude,
  });
}

export function availableRooms(stay: Stay, today: string): Prisma.RoomWhereInput {
  return {
    hotelId, condition: 'AVAILABLE', roomType: { hotelId, isListed: true, capacity: { gte: stay.guests } },
    nights: { none: { night: { gte: dateOnly(stay.checkIn), lt: dateOnly(stay.checkOut) } } },
    ...(stay.checkIn === today ? { reservations: { none: { status: 'CHECKED_IN', checkOut: { lte: dateOnly(today) } } } } : {}),
  };
}

export async function hotelOverview(week?: string, day?: string) {
  const hotel = await getHotel();
  const today = hotelDay(new Date(), hotel.timeZone);
  const start = week || today;
  const reportDay = day || today;
  const [types, rooms, amenities, active, past, calendar, occupied, pending, sales] = await Promise.all([
    db.roomType.findMany({ where: { hotelId }, include: roomTypeInclude, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    db.room.findMany({
      where: { hotelId }, orderBy: { number: 'asc' },
      select: { id: true, number: true, floor: true, condition: true, housekeeping: true, roomTypeId: true },
    }),
    db.amenity.findMany({ where: { hotelId }, orderBy: { name: 'asc' } }),
    staffReservations({ notIn: ['CHECKED_OUT', 'CANCELLED'] }),
    staffReservations({ in: ['CHECKED_OUT', 'CANCELLED'] }, 50),
    db.reservationNight.findMany({
      where: { room: { hotelId }, night: { gte: dateOnly(start), lt: dateOnly(addDays(start, 7)) } },
      select: { roomId: true, night: true, reservation: { select: { status: true, id: true } } },
    }),
    db.reservation.count({ where: { hotelId, status: 'CHECKED_IN' } }),
    db.reservation.count({ where: { hotelId, status: 'PENDING' } }),
    db.reservation.aggregate({
      where: {
        hotelId, status: 'CHECKED_OUT', history: { some: { status: 'CHECKED_OUT', at: { gte: zonedStart(reportDay, hotel.timeZone), lt: zonedStart(addDays(reportDay, 1), hotel.timeZone) } } },
      },
      _sum: { total: true },
    }),
  ]);
  return { hotel, roomTypes: types, rooms, amenities, reservations: [...active, ...past], calendar, occupied, pending, roomSales: sales._sum.total ?? 0, today, week: start };
}

function staffReservations(status: Prisma.EnumReservationStatusFilter, take?: number) {
  return db.reservation.findMany({
    where: { hotelId, status }, orderBy: { createdAt: 'desc' }, take,
    select: { ...publicReservation, guestName: true, email: true, guest: { select: { mobile: true } }, room: { select: { id: true, number: true } }, payment: true },
  });
}

function zonedStart(date: string, timeZone: string) {
  const midnight = dateOnly(date);
  const clock = new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  // Recheck the offset at local midnight, which can differ from the offset at UTC midnight.
  function offset(instant: Date) {
    const parts = Object.fromEntries(clock.formatToParts(instant).map(part => [part.type, part.value]));
    return new Date(`${hotelDay(instant, timeZone)}T${parts.hour}:${parts.minute}:${parts.second}Z`).valueOf() - instant.valueOf();
  }
  return new Date(midnight.valueOf() - offset(new Date(midnight.valueOf() - offset(midnight))));
}
