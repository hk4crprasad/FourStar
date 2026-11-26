import { db, restaurantId } from './db';
import { razorpayKeys } from './razorpay';
import { acceptingOrders, type Menu, type Option } from './domain';

export async function getMenu(): Promise<Menu> {
  const { categories, items, ...restaurant } = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    include: {
      categories: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
      items: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
    },
  });
  return { restaurant, categories, items: items.map(item => ({ ...item, options: item.options as Option[] })), acceptingOrders: acceptingOrders(restaurant), razorpayEnabled: Boolean(razorpayKeys()) };
}
