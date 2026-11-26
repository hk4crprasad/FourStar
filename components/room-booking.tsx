'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Search } from 'lucide-react';
import { currency } from '@/lib/domain';
import { addDays, formatStayDay, nightsBetween, stayPaymentLabels, stayPayments, type RoomType, type Stay } from '@/lib/hospitality';
import { jsonRequest, request, writeLocal } from '@/lib/client';
import { RoomCard, RoomFeatures } from './hotel-shared';
import { ErrorNotice, Photo, Popup } from './shared';

type Availability = { nights: number; available: { roomTypeId: string; count: number }[] };

const defaultStay = (today: string) => ({ checkIn: today, checkOut: addDays(today, 1), guests: 1 });
const stayQuery = (stay: Stay) => new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) }).toString();

function StayForm({ stay, setStay, today, maximum = 8, busy, onSearch }: {
  stay: Stay; setStay: (stay: Stay) => void; today: string; maximum?: number; busy: boolean; onSearch: () => void;
}) {
  return <form className="form-stack stay-form" onSubmit={event => { event.preventDefault(); onSearch(); }}>
    <label>Check-in<input type="date" value={stay.checkIn} min={today} max={addDays(today, 365)} required onChange={event => {
      const checkIn = event.target.value;
      setStay({ ...stay, checkIn, checkOut: checkIn && checkIn >= stay.checkOut ? addDays(checkIn, 1) : stay.checkOut });
    }} /></label>
    <label>Check-out<input type="date" value={stay.checkOut} min={addDays(stay.checkIn || today, 1)} max={addDays(stay.checkIn || today, 30)} required
      onChange={event => setStay({ ...stay, checkOut: event.target.value })} /></label>
    <label>Guests<select value={stay.guests} onChange={event => setStay({ ...stay, guests: Number(event.target.value) })}>
      {Array.from({ length: maximum }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'guest' : 'guests'}</option>)}
    </select></label>
    <Button className="solid-button" label="Check availability" icon={<Search size={16} />} type="submit" isLoading={busy} />
  </form>;
}

function useAvailability() {
  const [availability, setAvailability] = useState<Availability>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);

  function clear() { version.current++; setAvailability(undefined); setError(''); setBusy(false); }
  async function search(stay: Stay) {
    const sequence = ++version.current;
    setBusy(true);
    setError('');
    setAvailability(undefined);
    try {
      const result = await request<Availability>(`/api/hotel/availability?${stayQuery(stay)}`);
      if (sequence === version.current) setAvailability(result);
    } catch (cause) { if (sequence === version.current) setError((cause as Error).message); }
    finally { if (sequence === version.current) setBusy(false); }
  }
  return { availability, busy, error, clear, search };
}

export function RoomCatalogue({ rooms, today }: { rooms: RoomType[]; today: string }) {
  const [stay, setStay] = useState(defaultStay(today));
  const { availability, busy, error, clear, search } = useAvailability();
  return <main className="frame booking-page">
    <VStack gap={1.5} className="booking-title">
      <p className="eyebrow">ROOM RESERVATIONS</p>
      <Heading level={1}>Rooms & suites</Heading>
      <p className="muted">Choose your dates and guest count to see which rooms are available.</p>
    </VStack>
    <VStack className="single-panel" gap={1.5}>
      <StayForm stay={stay} setStay={value => { clear(); setStay(value); }} today={today} busy={busy} onSearch={() => void search(stay)} />
      <ErrorNotice>{error}</ErrorNotice>
      {availability && <p role="status" className="stay-result">{availability.available.length
        ? `${availability.available.length} room ${availability.available.length === 1 ? 'type' : 'types'} available for ${availability.nights} ${availability.nights === 1 ? 'night' : 'nights'}.`
        : 'No rooms are available for these dates and guest count.'}</p>}
    </VStack>
    <VStack className="hotel-room-grid room-catalogue">
      {rooms.map(room => <RoomCard key={room.id} room={room} href={`/rooms/${room.id}?${stayQuery(stay)}`}
        available={availability ? availability.available.find(entry => entry.roomTypeId === room.id)?.count ?? 0 : undefined} />)}
    </VStack>
    {rooms.length === 0 && <p className="empty-state">There are no rooms listed yet.</p>}
  </main>;
}

function RoomGallery({ room }: { room: RoomType }) {
  const [current, setCurrent] = useState(0);
  return <VStack className="room-gallery" gap={1.5}>
    <Photo src={room.images[current]?.url ?? ''} alt={`${room.name}, photo ${current + 1}`} className="room-main-photo" eager />
    {room.images.length > 1 && <HStack className="room-thumbs" gap={1}>
      {room.images.map((photo, i) => <button type="button" key={i} aria-label={`View room photo ${i + 1}`} aria-pressed={current === i} onClick={() => setCurrent(i)}>
        <Photo src={photo.url} />
      </button>)}
    </HStack>}
  </VStack>;
}

function StayBreakdown({ room, stay }: { room: RoomType; stay: Stay }) {
  const nights = Math.max(0, nightsBetween(stay.checkIn, stay.checkOut) || 0);
  return <dl className="breakdown">
    <HStack hAlign="between"><dt>Nightly rate</dt><dd>{currency(room.nightlyRate)}</dd></HStack>
    <HStack hAlign="between"><dt>Length of stay</dt><dd>{nights} {nights === 1 ? 'night' : 'nights'}</dd></HStack>
    <HStack hAlign="between"><dt>Guests</dt><dd>{stay.guests}</dd></HStack>
    <HStack hAlign="between" className="total"><dt>Total</dt><dd>{currency(nights * room.nightlyRate)}</dd></HStack>
  </dl>;
}

function GuestForm({ room, stay, close }: { room: RoomType; stay: Stay; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ data: string; key: string } | null>(null);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      roomTypeId: room.id, stay,
      guestName: form.get('guestName'), email: form.get('email'), mobile: form.get('mobile'), payment: form.get('payment'),
    };
    const encoded = JSON.stringify(data);
    if (attempt.current?.data !== encoded) attempt.current = { data: encoded, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const { id } = await jsonRequest<{ id: string }>('/api/reservations', 'POST', { ...data, requestId: attempt.current.key });
      writeLocal('phirmy-last-booking', id);
      router.push(`/reservations/${id}?booked=1`);
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }

  return <Popup title="Guest details" close={close} busy={busy}>
    <p className="muted">{room.name} · {formatStayDay(stay.checkIn)} to {formatStayDay(stay.checkOut)}</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Full name<input name="guestName" autoComplete="name" required maxLength={100} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Mobile number<input name="mobile" type="tel" autoComplete="tel" required maxLength={20} /></label>
      <label>Demo payment<select name="payment">{stayPayments.map(method => <option key={method} value={method}>{stayPaymentLabels[method]}</option>)}</select></label>
      <p className="muted">No payment is collected. The hotel will review your reservation.</p>
      <StayBreakdown room={room} stay={stay} />
      <ErrorNotice>{error}</ErrorNotice>
      <Button className="checkout-button" type="submit" label="Request reservation" isLoading={busy} size="lg" />
    </form>
  </Popup>;
}

export function RoomBooking({ room, today, initialStay }: { room: RoomType; today: string; initialStay?: Stay }) {
  const [stay, setStay] = useState(() => initialStay && initialStay.guests <= room.capacity ? initialStay : defaultStay(today));
  const [formOpen, setFormOpen] = useState(false);
  const { availability, busy, error, clear, search } = useAvailability();
  const count = availability?.available.find(entry => entry.roomTypeId === room.id)?.count ?? 0;
  return <main className="frame booking-page">
    <Link href="/rooms" className="text-action booking-back"><ArrowLeft size={16} /> All rooms</Link>
    <VStack className="room-detail-layout">
      <VStack gap={3}>
        <RoomGallery room={room} />
        <VStack gap={2} className="booking-title">
          <Heading level={1}>{room.name}</Heading>
          <p className="muted">{room.description}</p>
          <RoomFeatures room={room} />
          {room.amenities.length > 0 && <ul className="room-detail-amenities">{room.amenities.map(amenity => <li key={amenity.id}><Check size={16} /> {amenity.name}</li>)}</ul>}
        </VStack>
      </VStack>
      <aside aria-label="Booking summary" className="stay-panel">
        <VStack className="single-panel" gap={2}>
          <HStack vAlign="center" gap={1}><CalendarDays size={21} className="text-lime" /><Heading level={2}>Book this room</Heading></HStack>
          <StayForm stay={stay} setStay={value => { clear(); setStay(value); }} today={today} maximum={room.capacity} busy={busy} onSearch={() => void search(stay)} />
          <ErrorNotice>{error}</ErrorNotice>
          {availability && <p role="status" className={count ? 'stay-result' : 'muted'}>{count ? 'Available for your stay.' : 'This room is unavailable for the dates selected.'}</p>}
          <StayBreakdown stay={stay} room={room} />
          <Button className="checkout-button" label="Continue to booking" icon={<ArrowRight size={16} />} isDisabled={!count || busy} onClick={() => setFormOpen(true)} />
        </VStack>
      </aside>
    </VStack>
    {formOpen && <GuestForm room={room} stay={stay} close={() => setFormOpen(false)} />}
  </main>;
}
