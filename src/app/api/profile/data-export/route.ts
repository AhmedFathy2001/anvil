import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { exportPerson } from '@/lib/exportPerson';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// GET /api/profile/data-export — "Download my data": one JSON file of what Anvil holds about the
// signed-in person (lib/exportPerson). Their own rows only, links instead of image bytes, never a
// token or a hash. A few a day: it reads from fifty-odd tables.
export async function GET(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Not allowed from another site.' }, { status: 403 });
  }
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  // Staff viewing as a test user, or acting with a borrowed grant, are not the person whose data this is.
  if (session.labViewAs || session.actingAs) {
    return NextResponse.json({ error: 'Not while you are viewing or acting as someone else.' }, { status: 403 });
  }

  const rl = await rateLimitByKey('account-export', String(session.userId), { limit: 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'You can download your data three times a day. Try again tomorrow.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const data = await exportPerson(session.userId);
  if (!data) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="anvil-my-data-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
