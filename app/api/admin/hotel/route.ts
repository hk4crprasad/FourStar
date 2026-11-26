import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { hotelOverview } from '@/lib/hotel-db';
import { respond } from '@/lib/http';

export function GET(request: Request) {
  return respond(async () => {
    await requireStaff();
    const params = new URL(request.url).searchParams;
    const { week, day } = z.object({ week: z.iso.date().optional(), day: z.iso.date().optional() }).parse({
      week: params.get('week') ?? undefined, day: params.get('day') ?? undefined,
    });
    return hotelOverview(week, day);
  });
}
