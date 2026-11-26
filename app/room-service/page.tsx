import type { Metadata } from 'next';
import { HotelShell } from '@/components/hotel-shared';
import { RoomServiceGate } from '@/components/room-service-gate';
import { Storefront } from '@/components/storefront';
import { getHotel } from '@/lib/hotel-db';
import { isReservationId } from '@/lib/hospitality';
import { getMenu } from '@/lib/menu';
import { activeGuest, sessionReservationId } from '@/lib/room-service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Room service', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string; reservation?: string }> }) {
  const [search, id, hotel] = await Promise.all([searchParams, sessionReservationId(), getHotel()]);
  const guest = id ? await activeGuest(id) : null;
  const token = search.room === undefined ? undefined : typeof search.room === 'string' && search.room.length <= 36 ? search.room : 'invalid';
  if (guest && (token === undefined || token === guest.room.qrToken) && (!search.reservation || search.reservation === guest.id)) {
    return <Storefront roomNumber={guest.room.number} initialMenu={await getMenu()} />;
  }
  const reservationId = typeof search.reservation === 'string' && isReservationId(search.reservation) ? search.reservation : undefined;
  return <HotelShell hotel={hotel}><RoomServiceGate roomToken={token} reservationId={reservationId} /></HotelShell>;
}
