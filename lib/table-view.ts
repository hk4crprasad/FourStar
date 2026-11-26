import type { OrderStatus } from './domain';

export const serviceLabels = { WAITER: 'Call waiter', WATER: 'Request water', BILL: 'Request bill' };
export type RequestKind = keyof typeof serviceLabels;
export type TableOrder = {
  id: string; tableNumber: string; status: OrderStatus; createdAt: string; updatedAt: string;
  instructions: string | null; total: number; subtotal: number; tax: number;
  events: { status: OrderStatus; at: string }[];
  items: { id: string; name: string; quantity: number; unitPrice: number; options: string[] }[];
};
export type TableRequest = { id: string; type: RequestKind; status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' };
export type TableSession = {
  id: string; code: string | null; openedAt: string; expiresAt: string; closedAt: string | null;
  orders: TableOrder[]; requests: TableRequest[];
  bill: { id: string; subtotal: number; tax: number; discount: number; total: number; payments: { method: string; amount: number }[] } | null;
};
export type StaffTable = { id: string; number: string; name: string; capacity: number; enabled: boolean; token: string | null; session: TableSession | null };
export const tableStatus: Record<OrderStatus, string> = {
  PLACED: 'Submitted', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready to serve',
  COMPLETED: 'Served', REJECTED: 'Cancelled or rejected', OUT_FOR_DELIVERY: 'Out for delivery',
};
export const supportedMenuLocales = ['en', 'hi', 'or'] as const;

export function localizedMenuCopy<T>(base: T, verifiedTranslations: Partial<Record<typeof supportedMenuLocales[number], T>>, locale: string): T {
  return verifiedTranslations[locale as keyof typeof verifiedTranslations] ?? base;
}
