import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { getSetting, setSetting } from '@/lib/settings';
import { verifyAdmin } from '@/lib/auth';
import { fetchGuildRoles } from '@/lib/discord-roles';


function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Only real Discord snowflake ids (all digits) — guards against junk being saved into the config
// the role sync reads (a bad id there would just no-op, but keep it clean).
function cleanIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && /^\d+$/.test(x));
}

// GET — the guild's roles (for the picker) + which are currently assigned as default / guest roles.
export async function GET() {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roles = await fetchGuildRoles(clan.id);
  // Top-of-server first (matches Discord); drop @everyone and bot-managed roles (can't be assigned).
  const sorted = roles
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position);

  return NextResponse.json({
    roles: sorted,
    defaultRoleIds: parseIds(await getSetting(clan.id, 'discord_default_role_ids')),
    guestRoleIds: parseIds(await getSetting(clan.id, 'discord_guest_role_ids')),
  });
}

// POST — save which roles the sync gives every member (default) and every guest.
export async function POST(request: Request) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { defaultRoleIds?: unknown; guestRoleIds?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  await setSetting(clan.id, 'discord_default_role_ids', JSON.stringify(cleanIds(body.defaultRoleIds)));
  await setSetting(clan.id, 'discord_guest_role_ids', JSON.stringify(cleanIds(body.guestRoleIds)));

  return NextResponse.json({ success: true });
}
