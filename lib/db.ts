import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
export const dbSchema = connectionString ? (new URL(connectionString).searchParams.get('schema') ?? 'public') : 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(dbSchema)) throw new Error('DATABASE_URL has an invalid schema name.');

const globalDb = globalThis as typeof globalThis & { phirmyPrisma?: PrismaClient };
export const db = globalDb.phirmyPrisma ??= new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 8_000 }, { schema: dbSchema }),
});
export const restaurantId = 'tamarind-social';
