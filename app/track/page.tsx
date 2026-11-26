import type { Metadata } from 'next';
import { TrackLookup } from '@/components/tracking';

export const metadata: Metadata = { title: 'Track your order' };

export default function Page() {
  return <TrackLookup />;
}
