import { TableGuestOrders } from '@/components/table-guest';

export const metadata = { title: 'Your table orders', robots: { index: false, follow: false } };

export default function Page() { return <TableGuestOrders />; }
