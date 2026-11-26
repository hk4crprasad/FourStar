import { cookies } from 'next/headers';
import type { Prisma } from '@/generated/prisma/client';
import { secretEqual, signature } from './auth';
import { db, restaurantId } from './db';
import { dayString, hotelDay, hotelId, isReservationId } from './hospitality';

export const roomServiceCookie = 'phirmy_room_service';
export const guestSessionSeconds = 8 * 60 * 60;

export function guestSession(reservationId: string) {
  const value = `${reservationId}.${Math.floor(Date.now() / 1000) + guestSessionSeconds}`;
  return `${value}.${signature(`room-service:${value}`)}`;
}

export async function sessionReservationId() {
  const value = (await cookies()).get(roomServiceCookie)?.value;
  const [id, expiry, hash, extra] = value?.split('.') ?? [];
  if (!id || !isReservationId(id) || !/^\d{10}$/.test(expiry ?? '') || !hash || extra || Number(expiry) <= Date.now() / 1000) return null;
  return secretEqual(hash, signature(`room-service:${id}.${expiry}`)) ? id : null;
}

export async function activeGuest(id: string, client: Pick<Prisma.TransactionClient, 'reservation'> = db) {
  const reservation = await client.reservation.findFirst({
    where: { id, hotelId, status: 'CHECKED_IN', hotel: { restaurantId }, room: { condition: 'AVAILABLE' } },
    select: { id: true, guestName: true, checkIn: true, guest: { select: { mobile: true } },
      room: { select: { number: true, qrToken: true } }, hotel: { select: { timeZone: true } } },
  });
  if (!reservation || dayString(reservation.checkIn) > hotelDay(new Date(), reservation.hotel.timeZone)) return null;
  return reservation;
}
