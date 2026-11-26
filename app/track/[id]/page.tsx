import type { Metadata } from 'next';
import { OrderTracking } from '@/components/tracking';

export const metadata: Metadata = { title: 'Order status', robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const [{ id }, { placed }] = await Promise.all([params, searchParams]);
  return <OrderTracking key={id} id={id} placed={placed === '1'} />;
}
