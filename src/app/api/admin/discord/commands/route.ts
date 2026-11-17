import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { refuseCreatorSpace } from '@/lib/creatorGuard';
import { COMMANDS_OFF_KEY, TOGGLEABLE_COMMANDS, parseCommandsOff } from '@/lib/discordCommandToggles';
import { getSetting, setSetting } from '@/lib/settings';
import { discordCommandNotes } from '@/lib/discordCommandPermissionsDb';

/** Which slash commands answer in this clan's server (lib/discordCommandToggles). Admins only. */

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  // `discord`: what the server's admin set in Discord itself, read through the bot (null when it can't be read).
  const [off, discord] = await Promise.all([getSetting(clan.id, COMMANDS_OFF_KEY), discordCommandNotes(clan.id)]);
  return NextResponse.json({ off: [...parseCommandsOff(off)], discord });
}

/** { name, on } — switch one command. */
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  // The command switches are not on a creator space's Discord page (lib/creatorSpaces).
  const refused = refuseCreatorSpace(clan);
  if (refused) return refused;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; on?: unknown };
  if (typeof body.on !== 'boolean' || !TOGGLEABLE_COMMANDS.some((c) => c.name === body.name)) {
    return NextResponse.json({ error: 'Unknown command.' }, { status: 400 });
  }
  const off = parseCommandsOff(await getSetting(clan.id, COMMANDS_OFF_KEY));
  if (body.on) off.delete(body.name as string);
  else off.add(body.name as string);
  await setSetting(clan.id, COMMANDS_OFF_KEY, JSON.stringify([...off]));
  return NextResponse.json({ off: [...off] });
}
