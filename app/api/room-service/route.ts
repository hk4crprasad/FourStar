import { NextResponse } from 'next/server';
import { cookieOptions, secretEqual } from '@/lib/auth';
import { guestLoginInput } from '@/lib/hotel-validation';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { activeGuest, guestSession, guestSessionSeconds, roomServiceCookie } from '@/lib/room-service';

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const { reservationId, mobile, roomToken } = guestLoginInput.parse(await jsonBody(request));
    const guest = await activeGuest(reservationId);
    if (!guest || !secretEqual(guest.guest.mobile, mobile) || (roomToken && !secretEqual(guest.room.qrToken, roomToken))) {
      throw new ApiError(403, 'These details don’t match an active check-in for this room.');
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(roomServiceCookie, guestSession(guest.id), { ...cookieOptions(request), maxAge: guestSessionSeconds });
    return response;
  });
}

export function DELETE(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(roomServiceCookie, '', { ...cookieOptions(request), maxAge: 0 });
    return response;
  });
}
