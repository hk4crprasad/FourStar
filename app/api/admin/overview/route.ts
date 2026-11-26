import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { db, dbSchema, restaurantId } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { respond } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return respond(async () => {
    await requireStaff();
    const query = new URL(request.url).searchParams;
    const date = query.has('date') ? z.iso.date().parse(query.get('date')) : null;
    const page = z.coerce.number().int().min(1).max(10_000).parse(query.get('page') ?? 1);
    const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
    const day = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: restaurant.timeZone }).format(new Date());
    const terminal = ['COMPLETED', 'REJECTED'] as const;
    const historyWhere = { restaurantId, paymentVerified: true, status: { in: [...terminal] } };
    const include = { customer: { select: { mobile: true } }, items: true } as const;
    const [live, history, historyCount, [report]] = await Promise.all([
      db.order.findMany({ where: { restaurantId, paymentVerified: true, status: { notIn: [...terminal] } }, orderBy: { createdAt: 'desc' }, include }),
      db.order.findMany({ where: historyWhere, orderBy: { createdAt: 'desc' }, include, skip: (page - 1) * 20, take: 20 }),
      db.order.count({ where: historyWhere }),
      db.$queryRaw<{ count: number; completed: number; rejected: number; sales: string }[]>`
        SELECT count(*)::int AS count,
          (count(*) FILTER (WHERE status = 'COMPLETED'))::int AS completed,
          (count(*) FILTER (WHERE status = 'REJECTED'))::int AS rejected,
          COALESCE(sum(total) FILTER (WHERE status = 'COMPLETED'), 0)::text AS sales
        FROM ${Prisma.raw(`"${dbSchema}"."Order"`)}
        WHERE "restaurantId" = ${restaurantId} AND "paymentVerified" = true
          AND "createdAt" >= (${day}::date::timestamp AT TIME ZONE ${restaurant.timeZone}) AT TIME ZONE 'UTC'
          AND "createdAt" < ((${day}::date + 1)::timestamp AT TIME ZONE ${restaurant.timeZone}) AT TIME ZONE 'UTC'
      `,
    ]);
    return { live, history, historyCount, day, report: { ...report, sales: Number(report.sales) } };
  });
}
