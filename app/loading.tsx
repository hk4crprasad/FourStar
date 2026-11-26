import { FlameKindling, LoaderCircle } from 'lucide-react';
import { VStack } from '@astryxdesign/core/Stack';

export default function Loading() {
  return <main className="loading-screen" role="status" aria-live="polite">
    <VStack className="loading-content" align="center" gap={3}>
      <FlameKindling size={32} aria-hidden="true" />
      <LoaderCircle className="motion-safe:animate-spin" size={26} aria-hidden="true" />
      <p>Loading FourStar…</p>
    </VStack>
  </main>;
}
