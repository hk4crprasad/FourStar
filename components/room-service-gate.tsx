'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/Stack';
import { ConciergeBell } from 'lucide-react';
import { jsonRequest } from '@/lib/client';
import { ErrorNotice } from './shared';

export function RoomServiceGate({ roomToken, reservationId }: { roomToken?: string; reservationId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await jsonRequest('/api/room-service', 'POST', { reservationId: form.get('reservationId'), mobile: form.get('mobile'), roomToken });
      window.location.reload();
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }
  return <main className="single-main">
    <VStack className="track-layout">
      <VStack gap={2} className="booking-title">
        <ConciergeBell size={24} className="text-lime" />
        <Heading level={1}>Room service</Heading>
        <p className="muted">Use your reservation ID and booking mobile number to order to your room after check-in.</p>
        <Link className="text-action self-start" href="/reservations">Find your reservation</Link>
      </VStack>
      <VStack className="single-panel" gap={2}>
        <form className="form-stack" onSubmit={verify}>
          <label>Reservation ID<input name="reservationId" required defaultValue={reservationId} maxLength={40} placeholder="FSR-…" /></label>
          <label>Booking mobile number<input name="mobile" type="tel" autoComplete="tel" required maxLength={20} /></label>
          <ErrorNotice>{error}</ErrorNotice>
          <Button className="solid-button" type="submit" label="Verify check-in" isLoading={busy} />
        </form>
      </VStack>
    </VStack>
  </main>;
}
