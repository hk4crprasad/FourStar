import { redirect } from 'next/navigation';
import { TableGate } from '@/components/table-guest';
import { activeTable, tableClaim, tokenFor } from '@/lib/table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Table ordering', robots: { index: false, follow: false } };

export default async function Page() {
  const claim = await tableClaim();
  if (claim && await activeTable(claim)) redirect(`/table/${tokenFor(claim.tokenId)}`);
  return <TableGate />;
}
