'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ArrowRight, BedDouble, Check, Circle, LoaderCircle, Utensils, X } from 'lucide-react';
import { currency } from '@/lib/domain';
import { formatStayDay, isReservationId, reservationLabels, type Reservation, type ReservationStatus } from '@/lib/hospitality';
import { readLocal, request, RequestError } from '@/lib/client';
import { ErrorNotice } from './shared';

export function ReservationLookup() {
  const [last, setLast] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => { setLast(readLocal('phirmy-last-booking', '')); }, []);
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get('id')).trim().toUpperCase();
    if (!isReservationId(id)) { setError('Enter the full ID shown in your booking confirmation.'); return; }
    router.push(`/reservations/${id}`);
  }
  return <main className="single-main">
    <VStack className="track-layout">
      <VStack gap={2} className="booking-title"><Heading level={1}>Find your booking</Heading><p className="muted">Use your reservation ID to see your stay details and check-in status.</p></VStack>
      <VStack className="single-panel" gap={2}>
        <form className="form-stack" onSubmit={find}>
          <label>Reservation ID<input name="id" required placeholder="FSR-…" autoComplete="off" maxLength={40} /></label>
          <ErrorNotice>{error}</ErrorNotice>
          <Button label="Find reservation" className="solid-button" type="submit" />
        </form>
        {isReservationId(last) && <Link className="text-action self-start" href={`/reservations/${last}`}>View your last reservation <ArrowRight size={15} /></Link>}
      </VStack>
    </VStack>
  </main>;
}

const journey: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];

export function ReservationTracking({ id, booked }: { id: string; booked: boolean }) {
  const [reservation, setReservation] = useState<Reservation>();
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await request<Reservation>(`/api/reservations/${encodeURIComponent(id)}`, { signal });
      if (!signal?.aborted) { setReservation(data); setError(''); }
    } catch (cause) {
      if (signal?.aborted) return;
      setError((cause as Error).message);
      setNotFound(cause instanceof RequestError && cause.status === 404);
    }
  }, [id]);

  const finished = reservation?.status === 'CANCELLED' || reservation?.status === 'CHECKED_OUT';
  useEffect(() => {
    if (finished || notFound) return;
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void refresh(controller.signal); };
    void refresh(controller.signal);
    const timer = setInterval(update, 3500);
    document.addEventListener('visibilitychange', update);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [refresh, finished, notFound]);

  const stages = reservation?.status === 'CANCELLED' ? [...reservation.history.map(event => event.status)] : journey;
  return <main className="single-main booking-tracking">
    <VStack className="track-layout">
      <VStack gap={2} className="booking-title">
        <p className="eyebrow">RESERVATION</p>
        <Heading level={1}>{booked && reservation ? 'Reservation requested' : 'Your reservation'}</Heading>
        {reservation && <>
          <p className="muted">Reservation ID</p>
          <code className="track-id">{reservation.id}</code>
          <HStack gap={1} vAlign="center" wrap="wrap"><BedDouble size={17} /><strong>{reservation.roomTypeName}</strong> · {formatStayDay(reservation.checkIn)} to {formatStayDay(reservation.checkOut)}</HStack>
          <p>{reservation.guestCount} {reservation.guestCount === 1 ? 'guest' : 'guests'} · <strong>{currency(reservation.total)}</strong></p>
          {reservation.status === 'CHECKED_IN' && <Link className="hotel-button self-start" href={`/room-service?reservation=${id}`}><Utensils size={16} /> Order room service</Link>}
        </>}
        <Link className="text-action self-start" href="/reservations">Find another reservation</Link>
      </VStack>
      <VStack className="single-panel" gap={3}>
        <Heading level={2}>Booking status</Heading>
        <ErrorNotice>{error}</ErrorNotice>
        {!reservation && !error && <HStack role="status" vAlign="center" gap={1}><LoaderCircle className="animate-spin" size={18} /> Loading reservation…</HStack>}
        {!reservation && error && !notFound && <Button label="Retry" onClick={() => void refresh()} />}
        {reservation && <ol className="timeline" aria-label="Reservation progress">
          {stages.map(status => {
            const event = reservation.history.find(entry => entry.status === status);
            const Icon = status === 'CANCELLED' ? X : event ? Check : Circle;
            return <li key={status} aria-current={status === reservation.status ? 'step' : undefined}
              className={`${event ? 'done' : ''} ${status === 'CANCELLED' ? 'rejected' : ''}`}>
              <HStack hAlign="center" vAlign="center" className="timeline-mark"><Icon size={event ? 15 : 8} /></HStack>
              <VStack><strong>{reservationLabels[status]}</strong>{event && <time dateTime={event.at}>{new Date(event.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>}</VStack>
            </li>;
          })}
        </ol>}
      </VStack>
    </VStack>
  </main>;
}
