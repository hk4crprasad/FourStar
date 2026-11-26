import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookieName, cookieOptions, newSession, secretEqual, sessionSeconds } from '@/lib/auth';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';

const credentials = z.object({ email: z.email().max(250), password: z.string().min(1).max(250) }).strict();
// shortcut: process-local throttling for the demo, move to a shared limiter when running multiple instances.
let failedAttempts = 0;
let resetAt = 0;

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    if (Date.now() >= resetAt) {
      failedAttempts = 0;
      resetAt = Date.now() + 60_000;
    }
    if (failedAttempts >= 12) throw new ApiError(429, 'Too many attempts. Wait a minute and try again.');
    const { email, password } = credentials.parse(await jsonBody(request));
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new ApiError(503, 'Staff credentials have not been configured.');
    if (!secretEqual(password, ADMIN_PASSWORD) || !secretEqual(email.toLowerCase(), ADMIN_EMAIL.toLowerCase())) {
      failedAttempts++;
      throw new ApiError(401, 'Email or password is incorrect.');
    }
    failedAttempts = 0;
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, newSession(), { ...cookieOptions(request), maxAge: sessionSeconds });
    return response;
  });
}

export function DELETE(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, '', { ...cookieOptions(request), maxAge: 0 });
    return response;
  });
}
