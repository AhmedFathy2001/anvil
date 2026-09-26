// Image uploads for guides — shared by the clan editor and the library editor, which differ only in
// who may call them and where the object lands.
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { put } from '@/lib/storage';

const ALLOWED = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);
// Discord itself refuses to render embed images much past this, and a guide image is a screenshot.
const MAX_SIZE = 8 * 1024 * 1024;

export async function handleGuideImageUpload(request: Request, keyPrefix: string): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  // HEIC is refused on purpose: Discord cannot display it, and the point of the upload is Discord.
  const ext = ALLOWED.get(file.type);
  if (!ext) return NextResponse.json({ error: 'Use PNG, JPG, GIF or WebP — Discord cannot show other formats.' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Images are capped at 8 MB.' }, { status: 400 });
  const { url } = await put(`${keyPrefix}/${crypto.randomUUID()}.${ext}`, file, file.type);
  return NextResponse.json({ url });
}
