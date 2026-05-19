import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { fetchGuildRoles } from '@/lib/discord-roles';

// GET — list the guild's Discord roles. Used by the admin UI to populate the
// rank→role-id mapping pickers. Returns an empty array (not an error) when the
// feature is disabled or the bot token isn't set yet — the UI can show a hint
// instead of a broken state.
export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await fetchGuildRoles();
  // Sort top-of-server-first (matches the Discord UI). @everyone is position 0.
  const sorted = roles
    .filter((r) => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);

  return NextResponse.json({ roles: sorted });
}
