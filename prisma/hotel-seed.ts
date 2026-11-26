import { db, restaurantId } from '../lib/db';
import { hotelId } from '../lib/hospitality';

const amenities = [
  { id: 'wifi', name: 'High-speed Wi-Fi', description: 'Complimentary Wi-Fi throughout the hotel.', hotelFeature: true },
  { id: 'dining', name: 'Indian kitchen', description: 'Tandoor favourites, curries and room service.', hotelFeature: true },
  { id: 'parking', name: 'On-site parking', description: 'Complimentary parking for hotel guests.', hotelFeature: true },
  { id: 'reception', name: '24-hour reception', description: 'Front desk assistance throughout your stay.', hotelFeature: true },
  { id: 'ac', name: 'Air conditioning', description: 'Individual climate control in your room.' },
  { id: 'bath', name: 'Private bathroom', description: 'An en-suite bathroom with a walk-in shower.' },
  { id: 'desk', name: 'Work desk', description: 'A dedicated desk with power and task lighting.' },
  { id: 'lounge', name: 'Separate lounge', description: 'A sitting area with space to unwind.' },
];

const types = [
  ['standard', 'Standard', 'A quiet queen room with soft bedding and a reading chair, ideal for a short stay in Kataka.', '1 queen bed', 22, 2, 249900, '101', '1', ['wifi', 'ac', 'bath']],
  ['deluxe', 'Deluxe', 'A generous king room with a deep armchair and a broad window that catches the evening light.', '1 king bed', 29, 2, 349900, '203', '2', ['wifi', 'ac', 'bath', 'desk']],
  ['executive', 'Executive', 'A king room with a walnut workstation, task lighting and space to put your feet up after a full day.', '1 king bed', 34, 3, 469900, '302', '3', ['wifi', 'ac', 'bath', 'desk']],
  ['family-suite', 'Family Suite', 'Two beds and a separate lounge give families room to spread out between trips into the city.', '1 king bed and 1 double bed', 51, 4, 629900, '401', '4', ['wifi', 'ac', 'bath', 'lounge']],
] as const;

export async function seedHotel() {
  await db.hotel.upsert({
    where: { id: hotelId }, update: {},
    create: {
      id: hotelId, restaurantId, name: 'FourStar', tagline: 'HOTEL & INDIAN KITCHEN', location: 'Kataka, Odisha',
      description: 'A boutique stay in Kataka with restful rooms and an Indian kitchen downstairs.',
      heroUrl: '/hotel/hero.webp', email: 'stay@fourstar.example', phone: '+919000090000',
    },
  });

  for (const amenity of amenities) {
    await db.amenity.upsert({ where: { id: amenity.id }, update: {}, create: { ...amenity, hotelId } });
  }
  for (const [position, [id, name, description, beds, sizeM2, capacity, nightlyRate, number, floor, features]] of types.entries()) {
    await db.roomType.upsert({ where: { id }, update: {},
      create: { id, hotelId, name, description, beds, sizeM2, capacity, nightlyRate, position,
        amenities: { connect: features.map(id => ({ id })) },
        images: { create: [
          { url: `/hotel/${id}.webp`, position: 0 }, { url: `/hotel/${id}-detail.webp`, position: 1 },
        ] },
      },
    });
    await db.room.upsert({ where: { id: `room-${number}` }, update: {}, create: { id: `room-${number}`, hotelId, roomTypeId: id, number, floor } });
  }
}
