export const isOrderId = (value: string) => /^(?:FS|TS)-[A-F0-9]{20}$/.test(value);

export const orderTypes = ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE'] as const;
export type OrderType = typeof orderTypes[number];

export const statuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'REJECTED'] as const;
export type OrderStatus = typeof statuses[number];

export const payments = ['CASH', 'CARD_DEMO', 'UPI_DEMO', 'RAZORPAY_TEST'] as const;
export const paymentLabels = { CASH: 'Cash (demo)', CARD_DEMO: 'Card (demo)', UPI_DEMO: 'UPI (demo)', RAZORPAY_TEST: 'Razorpay (Test Mode)' };
export const typeLabels = { DELIVERY: 'Delivery', TAKEAWAY: 'Takeaway', DINE_IN: 'Dine-in', ROOM_SERVICE: 'Room service' };
export const statusLabels: Record<OrderStatus, string> = {
  PLACED: 'Order placed', ACCEPTED: 'Order accepted', PREPARING: 'Preparing', READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery', COMPLETED: 'Completed', REJECTED: 'Order rejected',
};

export type Option = { label: string; price: number };
export type MenuItem = {
  id: string; categoryId: string; name: string; description: string; imageUrl: string;
  price: number; vegetarian: boolean; inStock: boolean; popular: boolean; recommended: boolean;
  options: Option[]; position: number;
};
export type Category = { id: string; name: string; imageUrl: string | null; position: number };
export type Restaurant = {
  id: string; name: string; tagline: string; logoUrl: string | null; location: string; description: string;
  isOpen: boolean; opensAt: string; closesAt: string; timeZone: string; taxBps: number; deliveryFee: number;
};
export type Menu = { restaurant: Restaurant; categories: Category[]; items: MenuItem[]; acceptingOrders: boolean; razorpayEnabled: boolean };
export type CartLine = { menuItemId: string; picks: string[]; quantity: number };
export type Event = { status: OrderStatus; at: string };
export type TrackedOrder = {
  id: string; status: OrderStatus; type: OrderType; events: Event[]; total: number; createdAt: string; paymentVerified: boolean;
};
export type AdminOrder = TrackedOrder & {
  customerName: string; customer: { mobile: string }; address: string | null; tableNumber: string | null;
  instructions: string | null; roomNumber: string | null; payment: typeof payments[number]; subtotal: number; tax: number; delivery: number;
  items: { id: string; name: string; quantity: number; options: string[]; unitPrice: number }[];
};

export const currency = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);

export function restaurantTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function acceptingOrders(restaurant: Pick<Restaurant, 'isOpen' | 'opensAt' | 'closesAt' | 'timeZone'>, date = new Date()) {
  if (!restaurant.isOpen) return false;
  const localTime = restaurantTime(date, restaurant.timeZone);
  if (restaurant.opensAt === restaurant.closesAt) return true;
  return restaurant.opensAt < restaurant.closesAt
    ? localTime >= restaurant.opensAt && localTime < restaurant.closesAt
    : localTime >= restaurant.opensAt || localTime < restaurant.closesAt;
}

export function totals(subtotal: number, type: OrderType, taxBps: number, deliveryFee: number) {
  const tax = Math.round(subtotal * taxBps / 10_000);
  const delivery = type === 'DELIVERY' && subtotal > 0 ? deliveryFee : 0;
  return { subtotal, tax, delivery, total: subtotal + tax + delivery };
}

export function orderTimeline(type: OrderType): OrderStatus[] {
  return ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', ...(type === 'DELIVERY' ? ['OUT_FOR_DELIVERY' as const] : []), 'COMPLETED'];
}

export function nextStatuses(type: OrderType, status: OrderStatus): OrderStatus[] {
  if (status === 'REJECTED' || status === 'COMPLETED') return [];
  if (status === 'PLACED') return ['ACCEPTED', 'REJECTED'];
  const timeline = orderTimeline(type);
  return [timeline[timeline.indexOf(status) + 1]].filter(Boolean);
}

export function itemPrice(item: Pick<MenuItem, 'price' | 'options'>, picks: string[]) {
  return item.price + item.options.filter(option => picks.includes(option.label)).reduce((sum, option) => sum + option.price, 0);
}
