import 'dotenv/config';
import { seedHotel } from './hotel-seed';
import { db, restaurantId } from '../lib/db';
import type { Option } from '../lib/domain';
import { issueToken, sessionHours } from '../lib/table';

const categories = [
  ['starters', 'Starters', 'paneer-tikka'],
  ['mains', 'Mains', 'butter-chicken'],
  ['biryani', 'Biryani', 'chicken-biryani'],
  ['breads', 'Breads', 'garlic-naan'],
  ['desserts', 'Desserts', 'gulab-jamun'],
  ['drinks', 'Drinks', 'mango-lassi'],
] as const;

const dishes: [string, string, string, string, number, boolean][] = [
  ['butter-chicken', 'mains', 'Butter Chicken', 'Tandoor-charred chicken simmered in a silky tomato, butter and fenugreek gravy.', 389, false],
  ['paneer-tikka', 'starters', 'Paneer Tikka', 'Clay-oven paneer, charred peppers and onions with mint chutney.', 289, true],
  ['chicken-biryani', 'biryani', 'Chicken Dum Biryani', 'Saffron-scented basmati and spiced chicken, slow-cooked under a sealed lid.', 349, false],
  ['garlic-naan', 'breads', 'Garlic Naan', 'Tandoor-baked flatbread brushed with garlic butter and fresh coriander.', 89, true],
  ['dal-makhani', 'mains', 'Dal Makhani', 'Black lentils and kidney beans slow-simmered with cream and house spices.', 269, true],
  ['tandoori-chicken', 'starters', 'Tandoori Chicken', 'Yogurt-marinated chicken roasted over charcoal with lemon and smoky spices.', 329, false],
  ['samosa', 'starters', 'Punjabi Samosa', 'Two flaky pastries filled with cumin-spiced potato and peas, served with chutneys.', 119, true],
  ['gobi', 'starters', 'Gobi Manchurian', 'Crisp cauliflower tossed with ginger, garlic, spring onion and chilli.', 249, true],
  ['palak-paneer', 'mains', 'Palak Paneer', 'Soft paneer in a bright spinach sauce with garlic and toasted cumin.', 299, true],
  ['rogan-josh', 'mains', 'Lamb Rogan Josh', 'Slow-braised lamb with Kashmiri chilli, cardamom and warming spices.', 499, false],
  ['chana', 'mains', 'Amritsari Chana Masala', 'Chickpeas in a tangy onion-tomato masala with fresh ginger.', 239, true],
  ['hariyali', 'starters', 'Hariyali Chicken Tikka', 'Chicken skewers marinated with mint, coriander and green chilli.', 299, false],
  ['paneer-makhani', 'mains', 'Paneer Makhani', 'Paneer cubes folded into a velvety tomato and cashew gravy.', 319, true],
  ['veg-biryani', 'biryani', 'Vegetable Dum Biryani', 'Basmati rice layered with marinated seasonal vegetables and fried onions.', 279, true],
  ['lamb-biryani', 'biryani', 'Lamb Biryani', 'Dum-cooked basmati, slow-cooked lamb and crisp onions with raita.', 469, false],
  ['paratha', 'breads', 'Laccha Paratha', 'Flaky, hand-layered whole wheat flatbread brushed with ghee.', 89, true],
  ['roti', 'breads', 'Tandoori Roti', 'Whole wheat flatbread baked directly on the clay oven wall.', 55, true],
  ['gulab-jamun', 'desserts', 'Gulab Jamun', 'Warm milk dumplings soaked in rose and cardamom syrup.', 139, true],
  ['kulfi', 'desserts', 'Pista Kulfi', 'Dense, slow-reduced milk ice cream with roasted pistachios.', 169, true],
  ['mango-lassi', 'drinks', 'Mango Lassi', 'Chilled Alphonso mango and yogurt with a touch of cardamom.', 149, true],
  ['chai', 'drinks', 'Masala Chai', 'Assam black tea simmered with milk, ginger and house spices.', 89, true],
  ['lime-soda', 'drinks', 'Fresh Lime Soda', 'Lime, mint and sparkling water, bright and refreshing.', 119, true],
  ['rasmalai', 'desserts', 'Kesar Rasmalai', 'Soft cheese dumplings in saffron milk with slivered pistachios.', 179, true],
  ['raita', 'biryani', 'Cucumber Raita', 'Cooling yogurt with cucumber, roasted cumin and fresh herbs.', 89, true],
];

async function seed() {
  await db.restaurant.upsert({
    where: { id: restaurantId }, update: {},
    create: {
      id: restaurantId, name: 'FourStar', tagline: 'INDIAN KITCHEN',
      location: 'Kataka, Odisha', description: 'Tandoor favourites, slow-cooked curries and more from our Indian kitchen.',
      opensAt: '00:00', closesAt: '00:00',
    },
  });

  await Promise.all(categories.map(([id, name, image], position) => db.category.upsert({
    where: { id }, update: {},
    create: { id, restaurantId, name, imageUrl: `/food/${image}.webp`, position },
  })));

  await Promise.all(dishes.map(([id, categoryId, name, description, price, vegetarian], position) => {
    let options: Option[] = [];
    if (['butter-chicken', 'paneer-makhani', 'dal-makhani'].includes(id)) {
      options = [{ label: 'Extra gravy', price: 3900 }, { label: 'Extra spicy', price: 0 }];
    }
    if (categoryId === 'biryani' && id !== 'raita') options = [{ label: 'Extra raita', price: 4500 }];
    if (id === 'paneer-tikka') options = [{ label: 'Extra mint chutney', price: 2000 }];
    return db.menuItem.upsert({
      where: { id }, update: {},
      create: {
        id, categoryId, restaurantId, name, description, price: price * 100, vegetarian, options, position,
        imageUrl: `/food/${id}.webp`, popular: position < 4, recommended: [4, 5, 17, 19].includes(position),
        inStock: id !== 'kulfi',
      },
    });
  }));
  await seedHotel();
  for (let number = 1; number <= 6; number++) {
    const tableNumber = `T${number}`;
    const table = await db.restaurantTable.upsert({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
      update: {},
      create: { restaurantId, number: tableNumber, name: `Table ${tableNumber}`, capacity: 4 },
    });
    await db.$transaction(async tx => {
      if (!await tx.tableQrToken.count({ where: { tableId: table.id } })) await issueToken(tx, table.id);
      if (process.env.TABLE_DEMO_SESSIONS === '1' && table.enabled && !await tx.diningSession.count({ where: { tableId: table.id } })) {
        await tx.diningSession.create({ data: { restaurantId, tableId: table.id, expiresAt: new Date(Date.now() + sessionHours * 3_600_000) } });
      }
    });
  }
  console.log('Seeded FourStar, 24 dishes, four room types and six dining tables.');
}

seed().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
