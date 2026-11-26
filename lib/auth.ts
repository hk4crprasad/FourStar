import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ApiError } from './http';

export const cookieName = 'phirmy_staff';
export const sessionSeconds = 8 * 60 * 60;

export function secretEqual(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function signature(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function newSession() {
  const expires = String(Math.floor(Date.now() / 1000) + sessionSeconds);
  return `${expires}.${signature(expires)}`;
}

export async function isStaff() {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return false;
  const [expires, hash, extra] = value.split('.');
  return !extra && /^\d{10}$/.test(expires) && Boolean(hash) &&
    Number(expires) > Date.now() / 1000 && secretEqual(hash, signature(expires));
}

export async function requireStaff() {
  if (!await isStaff()) throw new ApiError(401, 'Sign in to access restaurant management.');
}

export function cookieOptions(request: Request) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: (process.env.APP_ORIGIN ?? request.url).startsWith('https:'), path: '/' };
}
