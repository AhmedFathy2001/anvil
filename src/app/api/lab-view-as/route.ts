import { NextResponse } from 'next/server';

import { LAB_VIEW_AS_COOKIE } from '@/lib/auth';
import { sessionCookieDomain } from '@/lib/clanContext';

// DELETE /api/lab-view-as — stop viewing the site as a lab test user. Outside /api/staff on purpose:
// while viewing as one, the session IS the test user, who holds no platform role, so a staff-gated
// route could never be reached to switch back. Clearing your own cookie needs no authority.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const domain = sessionCookieDomain();
  res.cookies.set(LAB_VIEW_AS_COOKIE, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  return res;
}
