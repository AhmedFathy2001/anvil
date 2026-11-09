// The welcome DM and joining the Anvil Discord: the IO half (the words are lib/welcomeDmText).
//
// WHO CAN BE REACHED. A bot can only DM someone it shares a server with. So the welcome is tried when
// a clan is made or a membership starts, and if Discord says no, it is NOT stamped: it is tried again
// the moment they join the Anvil Discord (OAuth callback, start?anvil=1), which is what makes the DM
// possible at all for most people.
//
// BETA. Beta shares the real bot and the real Anvil Discord with production, and a tester making a
// throwaway clan there should not get a welcome from Ahmed. On a preview deploy only platform staff
// and the owner are DM'd or joined, so the flow can still be tried end to end.

import { and, desc, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, clans, users } from '@/db/schema';
import { ANVIL_GUILD_KEY } from '@/lib/anvilDiscord';
import { isRealDiscordId } from '@/lib/anvilDiscordRoles';
import { discordRest, sharedBotToken } from '@/lib/discord-roles';
import { log } from '@/lib/logger';
import { sendDm } from '@/lib/onboardingNudge';
import { getPlatformSetting, isPreview } from '@/lib/platformSettings';
import { SITE } from '@/lib/site';
import { supporterForUser } from '@/lib/supporter';
import { welcomeMessage, type DmsChoice, type WelcomeFor } from '@/lib/welcomeDmText';

/** The role everyone added through "Join the Anvil Discord" gets (set on /staff/discord). */
export const ANVIL_MEMBER_ROLE_KEY = 'anvil_discord_member_role';

type Person = { id: number; discordId: string | null; isOwner: boolean; platformRole: string };

const personColumns = { id: true, discordId: true, isOwner: true, platformRole: true } as const;

/** Whether this deploy may DM or join this person (see BETA above). */
export function mayReach(p: Pick<Person, 'isOwner' | 'platformRole'>, preview = isPreview()): boolean {
  return !preview || p.isOwner || (!!p.platformRole && p.platformRole !== 'none');
}

/** The operator's Discord id, for "message me directly". The owner-flagged login. */
export async function operatorDiscordId(): Promise<string | null> {
  const row = await db.query.users.findFirst({ where: eq(users.isOwner, true), columns: { discordId: true } });
  return isRealDiscordId(row?.discordId) ? row!.discordId : null;
}

/**
 * Send the welcome once. Claimed before sending so two triggers can't both send it, and released
 * again when Discord refused, so the next chance (joining the Anvil Discord) tries again. Never throws.
 */
export async function sendWelcomeDm(userId: number, what: WelcomeFor): Promise<'sent' | 'already' | 'unreachable' | 'off'> {
  try {
    const token = sharedBotToken();
    if (!token) return 'off';
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { ...personColumns, displayName: true, discordGlobalName: true, welcomedAt: true },
    });
    if (!user || !isRealDiscordId(user.discordId) || !mayReach(user)) return 'off';
    if (user.welcomedAt) return 'already';
    const [claimed] = await db
      .update(users)
      .set({ welcomedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.welcomedAt)))
      .returning({ id: users.id });
    if (!claimed) return 'already';
    const body = welcomeMessage({
      name: user.discordGlobalName || user.displayName,
      for: what,
      contactId: await operatorDiscordId(),
      supportInvite: SITE.supportDiscord,
    });
    const ok = await sendDm(token, user.discordId!, body).catch(() => false);
    if (!ok) {
      await db.update(users).set({ welcomedAt: null }).where(eq(users.id, userId));
      return 'unreachable';
    }
    return 'sent';
  } catch (err) {
    log.warn('welcome-dm.failed', { userId }, err);
    return 'unreachable';
  }
}

/** Fire-and-forget: a slow Discord must never hold up making a clan or a Gumroad webhook. */
export function welcomeLater(userId: number, what: WelcomeFor): void {
  void sendWelcomeDm(userId, what);
}

/** What they pressed on a DM: Yes, No, or Stop. Keyed by their Discord id (the button press has no session). */
export async function setDmsChoice(discordId: string, choice: DmsChoice): Promise<boolean> {
  if (!isRealDiscordId(discordId)) return false;
  const rows = await db.update(users).set({ anvilDms: choice }).where(eq(users.discordId, discordId)).returning({ id: users.id });
  return rows.length > 0;
}

/**
 * Put someone in the Anvil Discord with the member role, using the guilds.join token they just
 * granted. 201 = added, 204 = already there (then the role is handed over on its own). Never throws.
 */
export async function joinAnvilDiscord(userId: number, accessToken: string): Promise<'joined' | 'already' | 'off' | 'failed'> {
  try {
    const token = sharedBotToken();
    const [guildId, roleId] = await Promise.all([getPlatformSetting(ANVIL_GUILD_KEY), getPlatformSetting(ANVIL_MEMBER_ROLE_KEY)]);
    if (!token || !guildId) return 'off';
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: personColumns });
    if (!user || !isRealDiscordId(user.discordId) || !mayReach(user)) return 'off';
    const res = await discordRest(token, `/guilds/${guildId}/members/${user.discordId}`, {
      method: 'PUT',
      headers: { 'X-Audit-Log-Reason': 'Joined from Anvil' },
      body: JSON.stringify({ access_token: accessToken, ...(roleId ? { roles: [roleId] } : {}) }),
    });
    if (res.status === 201) return 'joined';
    if (res.status === 204) {
      if (roleId) {
        await discordRest(token, `/guilds/${guildId}/members/${user.discordId}/roles/${roleId}`, {
          method: 'PUT',
          headers: { 'X-Audit-Log-Reason': 'Joined from Anvil' },
        }).catch(() => null);
      }
      return 'already';
    }
    log.warn('anvil-discord.join-failed', { status: res.status });
    return 'failed';
  } catch (err) {
    log.warn('anvil-discord.join-error', { userId }, err);
    return 'failed';
  }
}

/**
 * What to thank them for, when the welcome goes out later (after joining the Anvil Discord): the clan
 * they most recently made, else their membership. Null when there's neither, and then nothing is sent.
 */
export async function welcomeContextFor(userId: number): Promise<WelcomeFor | null> {
  const [owned] = await db
    .select({ name: clans.name })
    .from(clanStaff)
    .innerJoin(clans, eq(clans.id, clanStaff.clanId))
    .where(and(eq(clanStaff.userId, userId), eq(clanStaff.role, 'owner'), ne(clans.kind, 'friends')))
    .orderBy(desc(clans.id))
    .limit(1);
  if (owned) return { kind: 'clan', clanName: owned.name };
  const s = await supporterForUser(userId);
  return s ? { kind: 'supporter', tierName: s.tier.name } : null;
}
