import type { Metadata } from 'next';
import { ReservationLookup } from '@/components/reservation-tracking';

export const metadata: Metadata = { title: 'Find your booking', robots: { index: false, follow: false } };

export default function Page() {
  return <ReservationLookup />;
}
