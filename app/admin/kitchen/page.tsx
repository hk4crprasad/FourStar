import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/auth';
import { TableStaff } from '@/components/table-staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'kitchen', robots: { index: false, follow: false } };

export default async function Page() {
  if (!await isStaff()) redirect('/admin/login');
  return <TableStaff kitchen />;
}
