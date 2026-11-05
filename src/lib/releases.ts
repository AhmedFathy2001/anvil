// Anvil releases: the shipped record of releases/<version>.md (lib/releaseNotes).
//
// Production only ships as a release (scripts/promote.sh refuses without a new release file, and
// tagging needs Ahmed's approval). When a production build carrying a release file that hasn't gone
// out yet starts, the lifecycle tick publishes it ONCE — claimed by a unique insert, because two
// blue-green slots run side by side during a deploy: #anvil-announcements, every clan that set an
// "Anvil updates" channel, /changelog, and one chat line at each player's next plugin login.
// Beta never publishes: it is the owner's preview.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, desc, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { releases, settings, users } from '@/db/schema';
import { ANVIL_UPDATES_WEBHOOK_KEY, sendAnvilUpdatesWebhook } from '@/lib/discord';
import { stampEmbeds } from '@/lib/discordEmbeds';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { log } from '@/lib/logger';
import { getPlatformSetting, isPreview } from '@/lib/platformSettings';
import { VERSION_RE, compareVersions, parseReleaseNote, releaseBriefLine, releaseEmbed, releaseIsDue, type ReleaseNote } from '@/lib/releaseNotes';
import { apexOrigin } from '@/lib/seo';

// Moved to lib/platformSettings; re-exported so existing imports keep working.
export { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';

export const ANNOUNCEMENTS_WEBHOOK_KEY = 'anvil_announcements_webhook';
/** Silent releases staff asked to announce now (a JSON list of versions), /staff/releases. */
export const ANNOUNCE_NOW_KEY = 'releases_announce_now';

export function parseVersionList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && VERSION_RE.test(x)).slice(0, 50) : [];
  } catch {
    return [];
  }
}

/** Every release file bundled with this build, newest first. A malformed one is logged and skipped. */
export async function loadReleaseFiles(dir = path.join(process.cwd(), 'releases')): Promise<ReleaseNote[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => /^\d+\.\d+\.\d+\.md$/.test(n));
  } catch {
    return [];
  }
  const out: ReleaseNote[] = [];
  for (const n of names) {
    try {
      out.push(parseReleaseNote(await readFile(path.join(dir, n), 'utf8')));
    } catch (err) {
      log.warn('releases.bad-file', { file: n, message: (err as Error).message });
    }
  }
  return out.sort((a, b) => compareVersions(a.version, b.version));
}

// The "Powered by Anvil" footer every Anvil post carries: the clan copies get it from
// sendAnvilUpdatesWebhook, and this direct post stamps it the same way.
async function announce(note: ReleaseNote): Promise<void> {
  const embed = releaseEmbed(note, apexOrigin());
  const hook = await getPlatformSetting(ANNOUNCEMENTS_WEBHOOK_KEY);
  if (hook && isDiscordWebhookUrl(hook)) {
    try {
      const res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stampEmbeds({ embeds: [embed] })) });
      if (!res.ok) log.warn('releases.announce-failed', { status: res.status });
    } catch (err) {
      log.warn('releases.announce-error', {}, err);
    }
  }
  // clan-scope: global -- a release goes to every clan that asked for it.
  const clans = await db
    .select({ clanId: settings.clanId })
    .from(settings)
    .where(and(eq(settings.key, ANVIL_UPDATES_WEBHOOK_KEY), ne(settings.value, '')));
  for (const c of clans) {
    await sendAnvilUpdatesWebhook(c.clanId, { embeds: [embed] }).catch(() => false);
  }
}

/** Publish every bundled release that hasn't gone out. Returns the versions it published. */
export async function publishShippedReleases(dir?: string): Promise<string[]> {
  if (isPreview()) return [];
  // Nothing goes out until #anvil-announcements is set on /staff/releases: a release announced to
  // nobody would be claimed and never posted there. Set it, and the next tick publishes.
  if (!(await getPlatformSetting(ANNOUNCEMENTS_WEBHOOK_KEY))) return [];
  // Oldest first: a backlog (the channel set after a few releases) then reads top to bottom in the
  // order things shipped, and each release's row is newer than the one before it.
  const notes = [...(await loadReleaseFiles(dir))].reverse();
  const announceNow = new Set(parseVersionList(await getPlatformSetting(ANNOUNCE_NOW_KEY)));
  const done: string[] = [];
  for (const note of notes) {
    // A silent release waits (lib/releaseNotes releaseIsDue): no row yet, so nothing shows anywhere.
    if (!releaseIsDue(note, notes, announceNow)) continue;
    const [claimed] = await db
      .insert(releases)
      .values({ version: note.version, title: note.title, note, pluginVersion: note.pluginVersion })
      .onConflictDoNothing()
      .returning({ id: releases.id });
    if (!claimed) continue;
    await announce(note);
    done.push(note.version);
  }
  return done;
}

export interface PublishedRelease {
  id: number;
  version: string;
  publishedAt: string;
  note: ReleaseNote;
}

export async function listPublishedReleases(limit = 50): Promise<PublishedRelease[]> {
  const rows = await db.select().from(releases).orderBy(desc(releases.id)).limit(limit);
  return rows
    .map((r) => ({ id: r.id, version: r.version, publishedAt: r.publishedAt, note: r.note as ReleaseNote }))
    .sort((a, b) => compareVersions(a.version, b.version));
}

/**
 * The plugin's login line for a release this login hasn't been shown, marking it seen. A login that
 * never had a line before starts at the newest release, so nobody gets a backlog.
 */
export async function unseenReleaseLine(userId: number): Promise<string | null> {
  // The newest by VERSION. Row order isn't release order: a backlog published newest-first once
  // gave the oldest release the newest row.
  const rows = await db.select().from(releases).orderBy(desc(releases.id)).limit(50);
  const [latest] = rows.sort((a, b) => compareVersions(a.version, b.version));
  if (!latest) return null;
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { seenReleaseId: true } });
  // Seen = the line shown last was this release (not "an id at least this high", for the same reason).
  if (me?.seenReleaseId === latest.id) return null;
  await db.update(users).set({ seenReleaseId: latest.id }).where(eq(users.id, userId));
  return releaseBriefLine(latest.note as ReleaseNote);
}
