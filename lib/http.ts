import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readBody(request: Request, maxBytes: number, tooLarge: string) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ApiError(413, tooLarge);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks, bytes);
    bytes += value.length;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, tooLarge);
    }
    chunks.push(value);
  }
}

export async function jsonBody(request: Request) {
  const body = await readBody(request, 64 * 1024, 'This request is too large.');
  try { return JSON.parse(body.toString('utf8')) as unknown; }
  catch { throw new ApiError(400, 'Send a valid JSON request.'); }
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  const host = request.headers.get('host') || target.host;
  const expected = process.env.APP_ORIGIN || `${target.protocol}//${host}`;
  if (origin && origin !== expected) throw new ApiError(403, 'This request came from an unexpected origin.');
}

export async function respond(callback: () => Promise<unknown>) {
  try {
    const data = await callback();
    return data instanceof Response ? data : NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Check the form fields.' }, { status: 400 });
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'This record already exists.' }, { status: 409 });
      if (error.code === 'P2003') return NextResponse.json({ error: 'The record is still in use or its category no longer exists.' }, { status: 409 });
      if (error.code === 'P2025') return NextResponse.json({ error: 'This record could not be found.' }, { status: 404 });
      if (error.code === 'P2034') return NextResponse.json({ error: 'The data changed while saving. Try again.' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
