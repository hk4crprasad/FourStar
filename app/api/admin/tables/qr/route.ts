import QRCode from 'qrcode';
import { requireStaff } from '@/lib/auth';
import { db, restaurantId } from '@/lib/db';
import { ApiError, respond } from '@/lib/http';
import { tokenFor } from '@/lib/table';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? ''));

export function GET(request: Request) {
  return respond(async () => {
    await requireStaff();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const format = url.searchParams.get('format') ?? 'png';
    const tables = await db.restaurantTable.findMany({
      where: { restaurantId, ...(id ? { id } : {}) }, orderBy: { number: 'asc' },
      include: { restaurant: { select: { name: true } }, qrTokens: { where: { revokedAt: null }, take: 1 } },
    });
    const cards = tables.flatMap(table => {
      const record = table.qrTokens[0];
      if (!record) return [];
      const origin = process.env.APP_ORIGIN || `${url.protocol}//${request.headers.get('host') ?? url.host}`;
      return [{ table, target: new URL(`/table/${tokenFor(record.id)}`, origin).href }];
    });
    if (!cards.length) throw new ApiError(404, 'Generate a QR code first.');
    const options = { margin: 4, errorCorrectionLevel: 'M' as const, width: 600 };
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (format === 'cards') {
      const content = await Promise.all(cards.map(async ({ table, target }) => {
        const svg = await QRCode.toString(target, { ...options, type: 'svg' });
        return `<article><header>${escapeHtml(table.restaurant.name)}</header><h1>Table ${escapeHtml(table.number)}</h1><h2>Scan to Order</h2>${svg}<p>Browse Menu · Order Food · Enjoy Your Meal</p><footer>Powered by Phirmy</footer></article>`;
      }));
      headers.set('Content-Type', 'text/html; charset=utf-8');
      if (url.searchParams.has('download')) headers.set('Content-Disposition', 'attachment; filename="fourstar-table-cards.html"');
      return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FourStar table cards</title><style>
        @page{size:A4 portrait;margin:11mm}body{font-family:system-ui;color:#151a10;background:#fff;margin:0}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5mm;max-width:188mm;margin:auto}article{height:83mm;box-sizing:border-box;border:1px solid #52652f;border-top:4px solid #52652f;border-radius:3mm;text-align:center;padding:3mm;break-inside:avoid}header,footer{font-size:10pt}h1{font-size:20pt;margin:1mm 0 0}h2{font-size:13pt;margin:0}svg{display:block;width:43mm;height:43mm;margin:auto}p{font-size:9pt;margin:0 0 1mm}aside{text-align:center;margin:6mm}@media print{aside{display:none}}@media screen and (max-width:520px){main{grid-template-columns:1fr;padding:4mm}}
        </style><aside><button onclick="window.print()">Print or save as PDF</button></aside><main>${content.join('')}</main></html>`, { headers });
    }
    if (!id || (format !== 'png' && format !== 'svg')) throw new ApiError(400, 'Choose a table and a QR format.');
    const { table, target } = cards[0];
    headers.set('Content-Type', format === 'png' ? 'image/png' : 'image/svg+xml');
    if (url.searchParams.has('download')) headers.set('Content-Disposition', `attachment; filename="table-${table.number}.${format}"`);
    const body = format === 'png' ? new Uint8Array(await QRCode.toBuffer(target, options)) : await QRCode.toString(target, { ...options, type: 'svg' });
    return new Response(body, { headers });
  });
}
