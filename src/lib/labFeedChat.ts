// The lab's bench for the plugin's Feed tab and event chat (/staff/lab/<session>): make the session's
// test players say things in its chat, and file drops on its board that reach the Feed live — so
// both can be tried from one dev client without a second real person.
//
// Everything here lands on a lab session board (lib/lab), so it is swept with the session.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, eventParticipants, moments, users } from '@/db/schema';
import { chatAccess, sendChat, setEventChat } from '@/lib/eventChat';
import { labClanId } from '@/lib/lab';
import { emitMomentRows, type NewMoment } from '@/lib/panelRows';
import { seatOpensEventSql } from '@/lib/seatScope';

export interface LabCastMember {
  participantId: number;
  userId: number;
  name: string;
  teamId: number | null;
}

/** The session's players who have a login (test players and you): who can be made to talk. */
export async function labSessionCast(eventId: number): Promise<LabCastMember[]> {
  return db
    .select({ participantId: eventParticipants.id, userId: users.id, name: eventParticipants.name, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(eventParticipants.eventId, eventId))
    .orderBy(eventParticipants.name);
}

export type LabResult = { ok: true; note?: string } | { ok: false; error: string };

/** One line in the session's chat as one of its players, checked by the same rules as a real line. */
export async function labSay(eventId: number, participantId: number, body: string, teamOnly: boolean): Promise<LabResult> {
  const who = (await labSessionCast(eventId)).find((c) => c.participantId === participantId);
  if (!who) return { ok: false, error: 'That player isn’t on this session.' };
  // The lab plays one named player: their seat, even when one person holds two in the session.
  const access = await chatAccess(eventId, who.userId, { participantId });
  if (!access) return { ok: false, error: 'Session not found.' };
  if (!access.open) return { ok: false, error: access.closedWhy ?? 'Chat is off for this session.' };
  const r = await sendChat(access, who.userId, body, teamOnly ? 'team' : 'all');
  return r.ok ? { ok: true } : r;
}

export async function labChatOn(eventId: number, on: boolean): Promise<void> {
  await setEventChat(eventId, on);
}

// A spread around every floor a board can have: some clear a 10m floor, some only a small board's 1m,
// and the rest are rolled up — so the floor, the roll-up line and the pets all show from one click.
const SPREAD: { itemId: number; itemName: string; source: string; kind: 'unique' | 'loot' | 'pet'; valueGp: number | null }[] = [
  { itemId: 22324, itemName: 'Ghrazi rapier', source: 'Theatre of Blood', kind: 'unique', valueGp: 120_000_000 },
  { itemId: 21034, itemName: 'Dexterous prayer scroll', source: 'Chambers of Xeric', kind: 'unique', valueGp: 14_000_000 },
  { itemId: 12922, itemName: 'Tanzanite fang', source: 'Zulrah', kind: 'unique', valueGp: 4_100_000 },
  { itemId: 22006, itemName: 'Skeletal visage', source: 'Vorkath', kind: 'unique', valueGp: 2_600_000 },
  { itemId: 4151, itemName: 'Abyssal whip', source: 'Abyssal demon', kind: 'loot', valueGp: 1_400_000 },
  { itemId: 22877, itemName: 'Dragonfruit tree seed', source: 'Seed pack', kind: 'loot', valueGp: 200_000 },
  { itemId: 12921, itemName: 'Pet snakeling', source: 'Zulrah', kind: 'pet', valueGp: null },
];

/**
 * File `count` drops on the session's board, from its players in turn, and send them to the Feed the
 * way a real drop goes. Returns how many were filed.
 */
export async function labDrops(eventId: number, count: number): Promise<LabResult> {
  const clanId = await labClanId();
  if (clanId == null) return { ok: false, error: 'No lab clan on this site.' };
  const cast = await db
    .select({ seatId: clanMemberships.id, name: eventParticipants.name, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    // A seat that opens this event (an event player's seat only for its own event).
    .innerJoin(
      clanMemberships,
      and(eq(clanMemberships.accountId, eventParticipants.accountId), eq(clanMemberships.clanId, clanId), seatOpensEventSql(eventId)),
    )
    .where(eq(eventParticipants.eventId, eventId));
  if (!cast.length) return { ok: false, error: 'Add some players to the session first (Teams, below).' };

  const n = Math.max(1, Math.min(60, Math.floor(count) || 1));
  const now = Date.now();
  const made: NewMoment[] = [];
  for (let i = 0; i < n; i++) {
    const who = cast[i % cast.length];
    const drop = SPREAD[(i + Math.floor(now / 1000)) % SPREAD.length];
    const occurredAt = new Date(now - (n - i) * 1_000).toISOString();
    const [row] = await db
      .insert(moments)
      .values({
        clanMemberId: who.seatId,
        rsn: who.name,
        kind: drop.kind,
        eventId,
        teamId: who.teamId,
        itemId: drop.itemId,
        itemName: drop.itemName,
        source: drop.source,
        valueGp: drop.valueGp,
        occurredAt,
        dedupKey: `lab-feed:${crypto.randomUUID()}`,
      })
      .returning({ id: moments.id });
    made.push({
      id: row.id,
      rsn: who.name,
      kind: drop.kind,
      itemId: drop.itemId,
      itemName: drop.itemName,
      quantity: 1,
      valueGp: drop.valueGp,
      source: drop.source,
      teamId: who.teamId,
      eventId,
      tier: null,
      kc: null,
      occurredAt,
    });
  }
  // Session players' seats are lab-clan member seats: the lab clan's Feed hears them too.
  await emitMomentRows(clanId, 'member', made, now);
  return { ok: true, note: `${n} drop${n === 1 ? '' : 's'} filed. Smaller ones roll up into one line after a minute.` };
}
