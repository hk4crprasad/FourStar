import { HotelShell } from '@/components/hotel-shared';
import { getHotel } from '@/lib/hotel-db';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <HotelShell hotel={await getHotel()}>{children}</HotelShell>;
}
