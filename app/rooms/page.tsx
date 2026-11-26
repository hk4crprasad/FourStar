import type { Metadata } from 'next';
import { HotelShell } from '@/components/hotel-shared';
import { RoomCatalogue } from '@/components/room-booking';
import { getHotel, roomTypes } from '@/lib/hotel-db';
import { hotelDay } from '@/lib/hospitality';

export const metadata: Metadata = { title: 'Rooms & suites' };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [hotel, rooms] = await Promise.all([getHotel(), roomTypes()]);
  return <HotelShell hotel={hotel}><RoomCatalogue rooms={rooms} today={hotelDay(new Date(), hotel.timeZone)} /></HotelShell>;
}
