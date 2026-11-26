'use client';

import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/Stack';

export default function PageError({ reset }: { reset: () => void }) {
  return <main className="single-main">
    <VStack className="single-panel" gap={2} align="start">
      <Heading level={1}>FourStar is temporarily unavailable</Heading>
      <p className="muted">Try again in a moment.</p>
      <Button label="Try again" className="solid-button" onClick={reset} />
    </VStack>
  </main>;
}
