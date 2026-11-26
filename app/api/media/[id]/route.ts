import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, respond } from '@/lib/http';
import { mediaDirectory } from '@/lib/media';

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw new ApiError(404, 'Image not found.');
    try {
      const data = await readFile(path.join(mediaDirectory, `${id}.webp`));
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ApiError(404, 'Image not found.');
      throw error;
    }
  });
}
