import Link from 'next/link';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ArrowRight, CarFront, Clock3, Mail, MapPin, Phone, Utensils, Wifi } from 'lucide-react';
import { db } from '@/lib/db';
import { currency } from '@/lib/domain';
import { getHotel, roomTypes } from '@/lib/hotel-db';
import { hotelId } from '@/lib/hospitality';
import { getMenu } from '@/lib/menu';
import { HotelShell, RoomCard } from '@/components/hotel-shared';
import { Photo } from '@/components/shared';

export const dynamic = 'force-dynamic';

const amenityIcons = { wifi: Wifi, parking: CarFront, reception: Clock3, dining: Utensils };

export default async function Page() {
  const [hotel, types, menu, amenities] = await Promise.all([
    getHotel(), roomTypes(), getMenu(), db.amenity.findMany({ where: { hotelId, hotelFeature: true }, orderBy: { name: 'asc' } }),
  ]);
  const popular = menu.items.filter(item => item.popular).slice(0, 4);
  return <HotelShell hotel={hotel}>
    <main className="frame hotel-home">
      <section className="hotel-hero" aria-labelledby="hotel-title">
        <Photo src={hotel.heroUrl} className="hotel-hero-photo" eager />
        <VStack className="hotel-hero-content" gap={2} align="start">
          <p className="eyebrow hotel-location"><MapPin size={15} /> {hotel.location}</p>
          <Heading level={1} id="hotel-title">Stay at <em>{hotel.name}.</em></Heading>
          <p>{hotel.description}</p>
          <HStack wrap="wrap" gap={1.5}>
            <Link href="/rooms" className="hotel-button">Book rooms <ArrowRight size={17} /></Link>
            <Link href="/food" className="hotel-button hotel-button-outline">Order food <Utensils size={15} /></Link>
          </HStack>
        </VStack>
      </section>
      <section className="hotel-section" aria-labelledby="featured-rooms">
        <HStack className="hotel-section-header" vAlign="end" hAlign="between" gap={2}>
          <Heading level={2} id="featured-rooms">Featured rooms</Heading>
          <Link className="text-action" href="/rooms">View all rooms <ArrowRight size={15} /></Link>
        </HStack>
        {types.length ? <VStack className="hotel-room-grid">
          {types.slice(0, 4).map(room => <RoomCard key={room.id} room={room} href={`/rooms/${room.id}`} />)}
        </VStack> : <p className="empty-state">Rooms will appear here when they are listed.</p>}
      </section>
      {popular.length > 0 && <section className="hotel-section" aria-labelledby="hotel-dining">
        <HStack className="hotel-section-header" vAlign="end" hAlign="between" gap={2}>
          <Heading level={2} id="hotel-dining">From the Indian kitchen</Heading>
          <Link className="text-action" href="/food">Explore the menu <ArrowRight size={15} /></Link>
        </HStack>
        <VStack className="hotel-room-grid food-preview-grid">
          {popular.map(item => <Link className="hotel-food-card" key={item.id} href={`/food?q=${encodeURIComponent(item.name)}`}>
            <Photo src={item.imageUrl} alt={item.name} />
            <HStack vAlign="center" hAlign="between" gap={1}><strong>{item.name}</strong><small>{currency(item.price)}</small></HStack>
          </Link>)}
        </VStack>
      </section>}
      <section className="hotel-section hotel-stay-info" aria-label="Hotel amenities and contact">
        <VStack gap={3}>
          <Heading level={2}>Hotel amenities</Heading>
          <ul className="hotel-amenities">{amenities.map(amenity => {
            const Icon = amenityIcons[amenity.id as keyof typeof amenityIcons] ?? Clock3;
            return <li key={amenity.id}><Icon size={21} /><VStack gap={0.5}><strong>{amenity.name}</strong><small>{amenity.description}</small></VStack></li>;
          })}</ul>
        </VStack>
        <VStack className="hotel-contact" gap={2}>
          <Heading level={2}>Contact</Heading>
          <p><MapPin size={18} /> {hotel.location}</p>
          <a href={`mailto:${hotel.email}`}><Mail size={18} /> {hotel.email}</a>
          <a href={`tel:${hotel.phone}`}><Phone size={18} /> {hotel.phone}</a>
        </VStack>
      </section>
    </main>
  </HotelShell>;
}
