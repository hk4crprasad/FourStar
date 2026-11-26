import { Storefront } from '@/components/storefront';
import { getMenu } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const menu = await getMenu().catch(error => {
    console.error('Unable to load the menu:', error);
    return null;
  });
  return <Storefront initialMenu={menu} />;
}
