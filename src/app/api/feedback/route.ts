import { NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/feedback — a signed-in user files a bug report or feedback. Stored in this clan instance;
// admins triage it, and (on managed hosting) can elevate it to the operator.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'feedback', { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many submissions — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });

  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Please sign in to send feedback.' }, { status: 401 });

  let body: { kind?: string; subject?: string; body?: string; contact?: string; pageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = body.kind === 'feedback' ? 'feedback' : 'bug';
  const subject = (body.subject || '').trim().slice(0, 160);
  const text = (body.body || '').trim().slice(0, 5000);
  if (!subject || !text) return NextResponse.json({ error: 'A subject and some details are required.' }, { status: 400 });

  const inserted = await db
    .insert(feedback)
    .values({
      kind,
      subject,
      body: text,
      userId: session.userId,
      contact: body.contact?.trim().slice(0, 120) || null,
      pageUrl: body.pageUrl?.trim().slice(0, 300) || null,
      status: 'open',
    })
    .returning({ id: feedback.id });

  return NextResponse.json({ ok: true, id: inserted[0].id });
}
