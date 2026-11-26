import { Storefront } from '@/components/storefront';
import { getMenu } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const menu = await getMenu().catch(error => {
    console.error('Unable to load the menu:', error);
    return null;
  });
  const { q } = await searchParams;
  return <Storefront initialMenu={menu} initialQuery={typeof q === 'string' ? q.slice(0, 100) : undefined} />;
}
