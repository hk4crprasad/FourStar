import type { ReactNode } from 'react';
import Link from 'next/link';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Heading } from '@astryxdesign/core/Heading';
import { ArrowUpRight, BedDouble, Maximize, UsersRound } from 'lucide-react';
import { currency } from '@/lib/domain';
import type { Hotel, RoomType } from '@/lib/hospitality';
import { Brand, Photo, PoweredBy } from './shared';

export function HotelShell({ hotel, children }: { hotel: Hotel; children: ReactNode }) {
  return <>
    <header className="site-header hotel-header">
      <HStack className="frame hotel-nav-frame" hAlign="between" vAlign="center" gap={2}>
        <Brand restaurant={hotel} />
        <nav aria-label="Hotel navigation">
          <Link href="/rooms">Stay</Link>
          <Link href="/food">Dining</Link>
          <Link href="/room-service">Room service</Link>
          <Link href="/reservations">My booking</Link>
        </nav>
        <Link className="hotel-button hotel-button-small" href="/rooms">Book rooms <ArrowUpRight size={15} /></Link>
      </HStack>
    </header>
    {children}
    <footer className="frame hotel-footer">
      <Brand restaurant={hotel} />
      <HStack vAlign="center" wrap="wrap" gap={3}>
        <Link href="/admin">Staff access <ArrowUpRight size={14} /></Link>
        <PoweredBy />
      </HStack>
    </footer>
  </>;
}

export function RoomFeatures({ room }: { room: RoomType }) {
  return <ul className="room-features">
    <li><BedDouble size={16} /> {room.beds}</li>
    <li><UsersRound size={16} /> Up to {room.capacity}</li>
    <li><Maximize size={15} /> {room.sizeM2} m²</li>
  </ul>;
}

export function RoomCard({ room, href, available }: { room: RoomType; href: string; available?: number }) {
  return <VStack as="article" className="room-card">
    <Link href={href} className="room-card-photo" aria-label={`View ${room.name}`}><Photo src={room.images[0]?.url ?? ''} alt={room.name} /></Link>
    <VStack className="room-card-body" gap={1}>
      <Heading level={3}>{room.name}</Heading>
      <RoomFeatures room={room} />
      {available !== undefined && <p className={available ? 'text-lime' : 'muted'}>{available ? `${available} available for these dates` : 'Unavailable for these dates'}</p>}
      <HStack className="room-card-foot" hAlign="between" vAlign="center" gap={1}>
        <p><strong>{currency(room.nightlyRate)}</strong><small> / night</small></p>
        <Link href={href} className="room-card-arrow" aria-label={`Details for ${room.name}`}><ArrowUpRight size={19} /></Link>
      </HStack>
    </VStack>
  </VStack>;
}
