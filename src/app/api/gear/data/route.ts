import { NextResponse } from 'next/server';

import { effectiveGear } from '@/lib/dps/store';

// The gear calculator's data as it stands: dataset + platform overrides + custom effect rules. Public
// and the same for every reader. Revalidated by version, since /staff can change it at any time.
export async function GET(request: Request) {
  const { data } = await effectiveGear();
  const etag = `"gear-${data.version ?? 'b'}"`;
  if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  return NextResponse.json(data, {
    headers: { ETag: etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' },
  });
}
