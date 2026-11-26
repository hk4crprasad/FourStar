import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HotelShell } from '@/components/hotel-shared';
import { RoomBooking } from '@/components/room-booking';
import { db } from '@/lib/db';
import { getHotel, roomTypeInclude } from '@/lib/hotel-db';
import { hotelDay, hotelId } from '@/lib/hospitality';
import { stayInput } from '@/lib/hotel-validation';

export const metadata: Metadata = { title: 'Book a room' };

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const [{ id }, search, hotel] = await Promise.all([params, searchParams, getHotel()]);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) notFound();
  const room = await db.roomType.findUnique({ where: { id, hotelId, isListed: true }, include: roomTypeInclude });
  if (!room) notFound();
  const stay = stayInput.safeParse({ checkIn: search.checkIn, checkOut: search.checkOut, guests: Number(search.guests) });
  return <HotelShell hotel={hotel}><RoomBooking room={room} today={hotelDay(new Date(), hotel.timeZone)} initialStay={stay.data} /></HotelShell>;
}
