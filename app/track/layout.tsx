import Link from 'next/link';
import { HStack } from '@astryxdesign/core/Stack';
import { ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/shared';
import { db, restaurantId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function TrackingLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } }).catch(() => null);
  return <>
    <header className="single-header"><HStack className="frame" hAlign="between" vAlign="center">
      <Brand restaurant={restaurant ?? undefined} />
      <Link href="/"><ArrowLeft size={16} /> Back to menu</Link>
    </HStack></header>
    {children}
  </>;
}
