// Small shared pieces for the guide community API routes (app/api/guides/**).

import { NextResponse } from 'next/server';

import { verifyUser, type UserPayload } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { getGuide } from '@/lib/guides';
import { CommunityError } from '@/lib/guideCommunity';
import type { Guide } from '@/db/schema';

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** The signed-in person, rate-limited per action; or the response to send instead. */
export async function signedIn(scope: string, limit = 30, windowMs = 60_000): Promise<{ user: UserPayload } | { response: NextResponse }> {
  const user = await verifyUser();
  if (!user) return { response: bad('Sign in first.', 401) };
  const rl = await rateLimitByKey(`guides-${scope}`, String(user.userId), { limit, windowMs });
  if (!rl.ok) return { response: bad('That’s a lot at once — try again in a minute.', 429) };
  return { user };
}

/** A published guide by the route's id param. */
export async function publishedGuide(raw: string): Promise<Guide | null> {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const g = await getGuide(id);
  return g && g.status === 'published' ? g : null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const b = await request.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
}

/** Turn a store refusal into a 400; anything else is a real error. */
export function refusal(err: unknown): NextResponse {
  if (err instanceof CommunityError) return bad(err.message);
  throw err;
}

export const intParam = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
};
