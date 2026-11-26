import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Admin } from '@/components/admin';
import { isStaff } from '@/lib/auth';
import { getMenu } from '@/lib/menu';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Restaurant dashboard', robots: { index: false, follow: false } };

export default async function Page() {
  if (!await isStaff()) redirect('/admin/login');
  return <Admin initialMenu={await getMenu().catch(() => null)} />;
}
