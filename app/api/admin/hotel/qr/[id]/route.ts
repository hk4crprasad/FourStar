import QRCode from 'qrcode';
import { requireStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { hotelId } from '@/lib/hospitality';
import { respond } from '@/lib/http';
import { id as roomId } from '@/lib/validation';

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    await requireStaff();
    const { id } = await params;
    const room = await db.room.findUniqueOrThrow({ where: { id: roomId.parse(id), hotelId }, select: { qrToken: true } });
    const requestUrl = new URL(request.url);
    const origin = process.env.APP_ORIGIN ?? `${requestUrl.protocol}//${request.headers.get('host') ?? requestUrl.host}`;
    const link = new URL('/room-service', origin);
    link.searchParams.set('room', room.qrToken);
    const qr = await QRCode.toBuffer(link.toString(), { width: 440, margin: 3, errorCorrectionLevel: 'M' });
    return new Response(new Uint8Array(qr), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  });
}
