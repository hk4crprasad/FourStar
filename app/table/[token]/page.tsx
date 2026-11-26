import { Storefront } from '@/components/storefront';
import { TableGate } from '@/components/table-guest';
import { getMenu } from '@/lib/menu';
import { activeTable, resolveTable, tableClaim } from '@/lib/table';
import { db, restaurantId } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Table ordering', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const qr = await resolveTable(token);
  if (!qr) return <TableGate />;
  const claim = await tableClaim();
  const [session, restaurant] = await Promise.all([
    claim?.tokenId === qr.id ? activeTable(claim) : null,
    db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { name: true, logoUrl: true, tagline: true } }),
  ]);
  if (!session) return <TableGate token={token} number={qr.table.number} restaurant={restaurant} />;
  return <Storefront key={session.id} initialMenu={await getMenu()} diningTable={qr.table.number} tableBilled={Boolean(session.bill)} />;
}
