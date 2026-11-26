'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ArrowDownToLine, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Circle, Pencil, Plus, QrCode } from 'lucide-react';
import { jsonRequest } from '@/lib/client';
import { currency } from '@/lib/domain';
import {
  addDays, formatStayDay, housekeepingStates, reservationActions, reservationLabels, roomConditions, stayPaymentLabels,
  type Hotel, type HotelOverview, type ReservationStatus, type Room, type RoomType, type StaffReservation,
} from '@/lib/hospitality';
import { ErrorNotice, Popup } from './shared';

export type HotelTab = 'reservations' | 'rooms' | 'roomTypes' | 'calendar' | 'branding';

const conditionLabel = { AVAILABLE: 'Available', MAINTENANCE: 'Maintenance' } as const;
const housekeepingLabel = { CLEAN: 'Clean', DIRTY: 'Needs cleaning', IN_PROGRESS: 'Cleaning in progress' } as const;
const actions: Partial<Record<ReservationStatus, string>> = {
  CONFIRMED: 'Confirm reservation', CANCELLED: 'Cancel reservation', CHECKED_IN: 'Check in guest', CHECKED_OUT: 'Check out guest',
};

function Reservations({ data, refresh }: { data: HotelOverview; refresh: () => Promise<void> }) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState<ReservationStatus>();
  const [error, setError] = useState('');
  const reservation = data.reservations.find(entry => entry.id === selected);

  async function update(entry: StaffReservation, status: ReservationStatus) {
    setBusy(status);
    setError('');
    try {
      await jsonRequest(`/api/admin/hotel/reservations/${entry.id}`, 'PATCH', { status });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(undefined); }
  }

  return <VStack className="admin-panel" gap={2}>
    <HStack hAlign="between" vAlign="center" gap={2}><Heading level={2}>Guest reservations</Heading><p className="muted">{data.pending} pending</p></HStack>
    {data.reservations.length === 0 ? <VStack className="empty-state" align="center" gap={1}>
      <CalendarDays size={24} /><strong>No reservations yet</strong><p>New room bookings appear here automatically.</p>
    </VStack> : <ul className="admin-order-list">
      {data.reservations.map(entry => <li key={entry.id}>
        <button className="order-row" onClick={() => { setSelected(entry.id); setError(''); }}>
          <VStack className="order-name"><strong>{entry.guestName}</strong><small>{entry.id}</small></VStack>
          <VStack className="order-type"><strong>{entry.roomTypeName} · Room {entry.room.number}</strong><small>{formatStayDay(entry.checkIn)} – {formatStayDay(entry.checkOut)}</small></VStack>
          <p className={`order-status ${entry.status === 'CANCELLED' ? 'danger' : ''}`}>{reservationLabels[entry.status]}</p>
          <strong className="row-price">{currency(entry.total)}</strong><ArrowUpRight size={17} />
        </button>
      </li>)}
    </ul>}
    {reservation && <Popup title={`Reservation for ${reservation.guestName}`} close={() => setSelected('')} busy={Boolean(busy)} end>
      <HStack hAlign="between" vAlign="center" gap={1} wrap="wrap">
        <code className="track-id">{reservation.id}</code>
        <p className={`order-status ${reservation.status === 'CANCELLED' ? 'danger' : ''}`}>{reservationLabels[reservation.status]}</p>
      </HStack>
      <dl className="settings-list">
        <HStack hAlign="between" gap={1}><dt>Room</dt><dd>{reservation.room.number} · {reservation.roomTypeName}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Stay</dt><dd>{formatStayDay(reservation.checkIn)} – {formatStayDay(reservation.checkOut)}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Guests</dt><dd>{reservation.guestCount}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Mobile</dt><dd>{reservation.guest.mobile}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Email</dt><dd>{reservation.email}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Demo payment</dt><dd>{stayPaymentLabels[reservation.payment]}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Nightly rate</dt><dd>{currency(reservation.nightlyRate)}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Total</dt><dd>{currency(reservation.total)}</dd></HStack>
      </dl>
      <Heading level={3}>Status history</Heading>
      <ul className="admin-reservation-events">
        {reservation.history.map(event => <li key={event.status}><Circle size={9} />{reservationLabels[event.status]}
          <time dateTime={event.at}>{new Date(event.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: data.hotel.timeZone })}</time>
        </li>)}
      </ul>
      <ErrorNotice>{error}</ErrorNotice>
      <HStack wrap="wrap" gap={1}>
        {reservationActions(reservation.status).map(status => <Button key={status} label={actions[status] ?? reservationLabels[status]}
          variant={status === 'CANCELLED' ? 'destructive' : 'primary'} isDisabled={Boolean(busy && busy !== status)} isLoading={busy === status}
          onClick={() => void update(reservation, status)} />)}
      </HStack>
    </Popup>}
  </VStack>;
}

function AdminEditor({ title, endpoint, method, close, refresh, fields, serialize }: {
  title: string; endpoint: string; method: 'POST' | 'PATCH'; close: () => void; refresh: () => Promise<void>;
  fields: React.ReactNode; serialize: (data: FormData) => object;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await jsonRequest(endpoint, method, serialize(new FormData(event.currentTarget)));
      await refresh();
      close();
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }
  return <Popup title={title} close={close} busy={busy}>
    <form className="form-stack" onSubmit={save}>
      {fields}
      <ErrorNotice>{error}</ErrorNotice>
      <Button className="solid-button" type="submit" label="Save changes" isLoading={busy} />
    </form>
  </Popup>;
}

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

function Rooms({ data, refresh }: { data: HotelOverview; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ room?: Room }>();
  const [qrRoom, setQrRoom] = useState<Room>();
  const room = editing?.room;
  const maintenance = data.rooms.filter(room => room.condition === 'MAINTENANCE').length;
  const cleaning = data.rooms.filter(room => room.housekeeping !== 'CLEAN').length;
  return <>
    <HStack className="room-summary" gap={2} wrap="wrap">
      <p><strong>{data.occupied} / {data.rooms.length}</strong> occupied</p>
      <p><strong>{maintenance}</strong> in maintenance</p>
      <p><strong>{cleaning}</strong> need housekeeping</p>
    </HStack>
    <VStack className="admin-panel" gap={2}>
      <HStack hAlign="between" gap={1} vAlign="center"><Heading level={2}>Rooms</Heading>
        <Button label="Add room" className="solid-button" icon={<Plus size={16} />} isDisabled={!data.roomTypes.length} onClick={() => setEditing({})} />
      </HStack>
      <ul className="hotel-inventory-list">
        {data.rooms.map(entry => <li key={entry.id}>
          <VStack><strong>Room {entry.number}</strong><small>{data.roomTypes.find(type => type.id === entry.roomTypeId)?.name} · Floor {entry.floor}</small></VStack>
          <p>{conditionLabel[entry.condition]}</p>
          <p>{housekeepingLabel[entry.housekeeping]}</p>
          <HStack gap={1}>
            <Button label={`Room service QR for ${entry.number}`} isIconOnly size="sm" variant="ghost" icon={<QrCode size={17} />} onClick={() => setQrRoom(entry)} />
            <Button label={`Edit room ${entry.number}`} isIconOnly size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => setEditing({ room: entry })} />
          </HStack>
        </li>)}
      </ul>
      {!data.rooms.length && <p className="empty-state">Add your first room to the inventory.</p>}
    </VStack>
    {editing && <AdminEditor title={room ? `Edit room ${room.number}` : 'Add room'} endpoint={`/api/admin/hotel/rooms${room ? `?id=${room.id}` : ''}`}
      method={room ? 'PATCH' : 'POST'} close={() => setEditing(undefined)} refresh={refresh}
      serialize={data => ({ number: value(data, 'number'), floor: value(data, 'floor'), roomTypeId: value(data, 'roomTypeId'),
        condition: value(data, 'condition'), housekeeping: value(data, 'housekeeping') })}
      fields={<>
        <HStack className="form-pair" gap={2}>
          <label>Room number<input name="number" defaultValue={room?.number} required maxLength={20} /></label>
          <label>Floor<input name="floor" defaultValue={room?.floor} required maxLength={25} /></label>
        </HStack>
        <label>Room type<select aria-label="Room type" name="roomTypeId" defaultValue={room?.roomTypeId}>{data.roomTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>Condition<select name="condition" aria-label="Condition" defaultValue={room?.condition ?? 'AVAILABLE'}>
          {roomConditions.map(condition => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}
        </select></label>
        <label>Housekeeping<select name="housekeeping" aria-label="Housekeeping" defaultValue={room?.housekeeping ?? 'CLEAN'}>
          {housekeepingStates.map(status => <option key={status} value={status}>{housekeepingLabel[status]}</option>)}
        </select></label>
      </>} />}
    {qrRoom && <Popup title={`Room ${qrRoom.number} service QR`} close={() => setQrRoom(undefined)}>
      <p className="muted">Place this code in the room. Guests scan it and verify their check-in before ordering.</p>
      <img src={`/api/admin/hotel/qr/${qrRoom.id}`} className="room-qr" alt={`Room service QR for room ${qrRoom.number}`} />
      <a className="hotel-button self-start" href={`/api/admin/hotel/qr/${qrRoom.id}`} download={`room-${qrRoom.number}-service.png`}><ArrowDownToLine size={16} /> Download QR code</a>
    </Popup>}
  </>;
}

function RoomTypes({ data, refresh }: { data: HotelOverview; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ type?: RoomType }>();
  const room = editing?.type;
  return <VStack className="admin-panel" gap={2}>
    <HStack hAlign="between" gap={1} vAlign="center"><Heading level={2}>Room types and rates</Heading>
      <Button className="solid-button" label="Add room type" icon={<Plus size={16} />} onClick={() => setEditing({})} />
    </HStack>
    <ul className="hotel-inventory-list">
      {data.roomTypes.map(entry => <li key={entry.id}>
        <VStack><strong>{entry.name}</strong><small>{entry.capacity} guests · {data.rooms.filter(room => room.roomTypeId === entry.id).length} rooms</small></VStack>
        <p>{currency(entry.nightlyRate)} / night</p>
        <p>{entry.isListed ? 'Listed' : 'Unlisted'}</p>
        <Button label={`Edit ${entry.name}`} isIconOnly variant="ghost" icon={<Pencil size={16} />} onClick={() => setEditing({ type: entry })} />
      </li>)}
    </ul>
    {!data.roomTypes.length && <p className="empty-state">Create a room type before adding rooms.</p>}
    {editing && <AdminEditor title={room ? `Edit ${room.name}` : 'Add room type'} endpoint={`/api/admin/hotel/room-types${room ? `?id=${room.id}` : ''}`}
      method={room ? 'PATCH' : 'POST'} close={() => setEditing(undefined)} refresh={refresh}
      serialize={form => ({
        name: value(form, 'name'), description: value(form, 'description'), beds: value(form, 'beds'), sizeM2: Number(value(form, 'sizeM2')),
        capacity: Number(value(form, 'capacity')), nightlyRate: Math.round(Number(value(form, 'nightlyRate')) * 100), position: Number(value(form, 'position')),
        isListed: form.has('isListed'), images: value(form, 'images').split(/\r?\n/).map(url => url.trim()).filter(Boolean), amenities: form.getAll('amenities'),
      })}
      fields={<>
        <label>Name<input name="name" defaultValue={room?.name} required maxLength={60} /></label>
        <label>Description<textarea name="description" defaultValue={room?.description} required maxLength={600} /></label>
        <label>Bed layout<input name="beds" defaultValue={room?.beds} required maxLength={80} /></label>
        <HStack className="form-pair" gap={2}>
          <label>Size (m²)<input name="sizeM2" type="number" min="1" max="1000" defaultValue={room?.sizeM2} required /></label>
          <label>Guest capacity<input name="capacity" type="number" min="1" max="8" defaultValue={room?.capacity} required /></label>
        </HStack>
        <HStack className="form-pair" gap={2}>
          <label>Nightly rate (₹)<input name="nightlyRate" type="number" min="1" max="100000" step="0.01" defaultValue={room ? room.nightlyRate / 100 : undefined} required /></label>
          <label>Display position<input name="position" type="number" min="0" max="9999" defaultValue={room?.position ?? data.roomTypes.length} required /></label>
        </HStack>
        <label>Room photographs <small>One image URL per line. The first is shown in the catalogue.</small>
          <textarea name="images" defaultValue={room?.images.map(photo => photo.url).join('\n')} required /></label>
        <fieldset className="options-list"><legend>Amenities</legend>
          {data.amenities.map(amenity => <label className="check-row" key={amenity.id}>
            <input name="amenities" type="checkbox" value={amenity.id} defaultChecked={room?.amenities.some(item => item.id === amenity.id)} /> {amenity.name}
          </label>)}
        </fieldset>
        <label className="check-row"><input type="checkbox" name="isListed" defaultChecked={room?.isListed ?? true} /> Listed for new bookings</label>
      </>} />}
  </VStack>;
}

function AvailabilityCalendar({ data, selectWeek }: { data: HotelOverview; selectWeek: (week: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.week, i));
  return <VStack className="admin-panel" gap={2}>
    <HStack className="calendar-controls" hAlign="between" vAlign="center" gap={2} wrap="wrap">
      <Heading level={2}>Room availability</Heading>
      <HStack gap={1} vAlign="center">
        <Button label="Previous week" isIconOnly variant="ghost" icon={<ChevronLeft size={17} />} onClick={() => selectWeek(addDays(data.week, -7))} />
        <input className="field-input" aria-label="Calendar start date" type="date" value={data.week} onChange={event => { if (event.target.value) selectWeek(event.target.value); }} />
        <Button label="Next week" isIconOnly variant="ghost" icon={<ChevronRight size={17} />} onClick={() => selectWeek(addDays(data.week, 7))} />
      </HStack>
    </HStack>
    <VStack className="room-calendar-scroll">
      <table className="room-calendar">
        <thead><tr><th scope="col">Room</th>{days.map(day => <th key={day} scope="col">{formatStayDay(day)}</th>)}</tr></thead>
        <tbody>{data.rooms.map(room => <tr key={room.id}>
          <th scope="row">{room.number}</th>
          {days.map(day => {
            const state = data.calendar.find(entry => entry.roomId === room.id && entry.night.slice(0, 10) === day)?.reservation.status;
            return <td key={day} className={state ? 'reserved-night' : room.condition === 'MAINTENANCE' ? 'danger' : 'muted'}>
              {state ? reservationLabels[state] : conditionLabel[room.condition]}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </VStack>
    {!data.rooms.length && <p className="empty-state">Rooms appear here once added to inventory.</p>}
  </VStack>;
}

function Branding({ hotel, refresh }: { hotel: Hotel; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  return <VStack className="admin-panel" gap={2}>
    <HStack hAlign="between" vAlign="center" gap={2}>
      <VStack gap={1}><Heading level={2}>{hotel.name}</Heading><p className="muted">{hotel.location}</p></VStack>
      <Button label="Edit hotel branding" icon={<Pencil size={16} />} onClick={() => setEditing(true)} />
    </HStack>
    <p>{hotel.description}</p><p className="muted">{hotel.email} · {hotel.phone}</p>
    {editing && <AdminEditor title="Edit hotel branding" endpoint="/api/admin/hotel/branding" method="PATCH" refresh={refresh} close={() => setEditing(false)}
      serialize={form => ({
        name: value(form, 'name'), tagline: value(form, 'tagline'), location: value(form, 'location'), description: value(form, 'description'),
        heroUrl: value(form, 'heroUrl'), logoUrl: value(form, 'logoUrl') || null, email: value(form, 'email'), phone: value(form, 'phone'),
      })}
      fields={<>
        <label>Hotel name<input name="name" defaultValue={hotel.name} required maxLength={55} /></label>
        <label>Brand tagline<input name="tagline" defaultValue={hotel.tagline} required maxLength={40} /></label>
        <label>Location<input name="location" defaultValue={hotel.location} required maxLength={100} /></label>
        <label>Description<textarea name="description" defaultValue={hotel.description} required maxLength={600} /></label>
        <label>Hero photograph URL<input name="heroUrl" defaultValue={hotel.heroUrl} required maxLength={1500} /></label>
        <label>Logo image URL<input name="logoUrl" defaultValue={hotel.logoUrl ?? ''} maxLength={1500} /></label>
        <label>Contact email<input type="email" name="email" defaultValue={hotel.email} required maxLength={254} /></label>
        <label>Contact telephone<input type="tel" name="phone" defaultValue={hotel.phone} required maxLength={20} /></label>
      </>} />}
  </VStack>;
}

export function HotelAdmin({ tab, data, selectWeek, refresh }: { tab: HotelTab; data: HotelOverview; selectWeek: (week: string) => void; refresh: () => Promise<void> }) {
  if (tab === 'reservations') return <Reservations data={data} refresh={refresh} />;
  if (tab === 'rooms') return <Rooms data={data} refresh={refresh} />;
  if (tab === 'roomTypes') return <RoomTypes data={data} refresh={refresh} />;
  if (tab === 'branding') return <Branding hotel={data.hotel} refresh={refresh} />;
  return <AvailabilityCalendar data={data} selectWeek={selectWeek} />;
}
