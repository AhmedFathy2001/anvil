// A clan's "Streaming" switch (clans.streaming, lib/creatorSpaces streamsEvents) — the one rule about
// turning it on, and its mirror on the clan's visibility.
//
// PRIVATE CLANS CAN'T STREAM. A viewer joins from a stream link, so they have to be able to open the
// clan's event page; a clan set to `members` shows a stranger its card instead (lib/clanAccess). So
// Streaming is refused on a private clan, and a Streaming clan is refused going private — refusal both
// ways, never a silent switch-off, so nothing changes without the admin seeing why.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const STREAMING_NEEDS_PUBLIC = 'Make your clan public first — viewers need to open its events.';
export const PRIVATE_NEEDS_STREAMING_OFF = 'Turn off Streaming first — viewers need to open your events.';

export type SwitchResult = { ok: true } | { ok: false; error: string };

/** Turn a clan's Streaming on or off. Refused for a creator space (always streams) and for a private clan. */
export async function setClanStreaming(clanId: number, on: boolean): Promise<SwitchResult> {
  // clan-scope: this clan -- its own kind and visibility.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true, visibility: true } });
  if (!row) return { ok: false, error: 'Not found' };
  if (isCreatorSpace(row)) return { ok: false, error: 'A creator space always streams.' };
  if (on && clanVisibilityOf(row.visibility) !== 'public') return { ok: false, error: STREAMING_NEEDS_PUBLIC };
  // clan-scope: this clan -- its own switch.
  await db.update(clans).set({ streaming: on }).where(eq(clans.id, clanId));
  return { ok: true };
}

/** May this clan take this visibility? A Streaming clan may not go private. */
export async function visibilityChangeVerdict(clanId: number, visibility: string): Promise<SwitchResult> {
  if (clanVisibilityOf(visibility) === 'public') return { ok: true };
  // clan-scope: this clan -- its own switch.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { streaming: true, kind: true } });
  if (row?.streaming === true && !isCreatorSpace(row)) return { ok: false, error: PRIVATE_NEEDS_STREAMING_OFF };
  return { ok: true };
}
