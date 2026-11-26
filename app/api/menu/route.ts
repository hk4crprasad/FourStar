import { respond } from '@/lib/http';
import { getMenu } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export function GET() {
  return respond(getMenu);
}
