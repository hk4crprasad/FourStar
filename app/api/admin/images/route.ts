import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireStaff } from '@/lib/auth';
import { ApiError, readBody, respond, verifyOrigin } from '@/lib/http';
import { mediaDirectory } from '@/lib/media';

const maxBytes = 5 * 1024 * 1024;

export function POST(request: Request) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const body = await readBody(request, maxBytes, 'Images must be smaller than 5 MB.');
    if (!body.length) throw new ApiError(400, 'Choose an image to upload.');

    let encoded;
    try {
      const source = sharp(body, { limitInputPixels: 20_000_000 });
      const { format } = await source.metadata();
      if (!format || !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(format)) throw new Error();
      encoded = await source.rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new ApiError(400, 'Upload a valid JPG, PNG, WebP or AVIF image.');
    }
    const id = randomUUID();
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, `${id}.webp`), encoded, { flag: 'wx' });
    return { url: `/api/media/${id}` };
  });
}
