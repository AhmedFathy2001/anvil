import { NextResponse } from 'next/server';
import { verifyAdminPluginToken } from '@/lib/auth';

// GET /api/plugin/me
//
// Lightweight "is my account token an admin?" probe for the RuneLite plugin. The plugin sends its
// per-user account token as a Bearer header; if the token's site user is an admin, returns
// { isAdmin: true } so the plugin can show its admin side panel (clan-roster sync). Non-admins (or
// invalid tokens) get 401 — there's nothing admin-only to expose, so the panel simply stays hidden.
export async function GET(request: Request) {
  const auth = await verifyAdminPluginToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ isAdmin: true });
}
