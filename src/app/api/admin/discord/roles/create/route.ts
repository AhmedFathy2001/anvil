import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { createGuildRole, getBotCredentials } from '@/lib/discord-roles';

// POST — create a new Discord role in the connected guild and return it, so the role pickers can
// select a freshly-made role without leaving the page. Admin-only; needs the bot connected with
// Manage Roles.
export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; color?: unknown; mentionable?: unknown }
    | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Enter a role name.' }, { status: 400 });
  if (name.length > 100) {
    return NextResponse.json({ error: 'Role names are 100 characters max.' }, { status: 400 });
  }

  // Optional styling. Colour is a Discord 24-bit int (0 = no colour); ignore anything out of range.
  const color =
    Number.isInteger(body?.color) && (body!.color as number) >= 0 && (body!.color as number) <= 0xffffff
      ? (body!.color as number)
      : undefined;
  const mentionable = body?.mentionable === true;

  const creds = await getBotCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'Connect the Discord bot first (bot token + server ID in the Discord bot tab).' },
      { status: 400 },
    );
  }

  const role = await createGuildRole(name, { color, mentionable });
  if (!role) {
    return NextResponse.json(
      { error: 'Discord rejected the role — check the bot has Manage Roles and its role is high enough.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ role: { id: role.id, name: role.name } });
}
