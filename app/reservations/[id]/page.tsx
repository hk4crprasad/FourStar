import type { Metadata } from 'next';
import { ReservationTracking } from '@/components/reservation-tracking';

export const metadata: Metadata = { title: 'Reservation status', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ booked?: string }>;
}) {
  const [{ id }, { booked }] = await Promise.all([params, searchParams]);
  return <ReservationTracking key={id} id={id} booked={booked === '1'} />;
}
