import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminLogin } from '@/components/admin-login';
import { isStaff } from '@/lib/auth';
import { db, restaurantId } from '@/lib/db';

export const metadata: Metadata = { title: 'Staff sign in', robots: { index: false, follow: false } };

export default async function Page() {
  if (await isStaff()) redirect('/admin');
  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } }).catch(() => null);
  return <AdminLogin restaurant={restaurant ?? undefined} />;
}
