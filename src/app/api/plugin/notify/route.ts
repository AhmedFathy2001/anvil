import { NextResponse } from 'next/server';
import { normalizeRsn, requirePluginClan, verifyPluginTokenUser } from '@/lib/auth';
import {
  getNotificationWebhooks,
  NOTIFY_CHANNELS,
  type NotifyChannel,
  type PluginWebhooks,
} from '@/lib/pluginConfig';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { stripGameMarkup, stripGameMarkupDeep } from '@/lib/gameText';
import { playerEventEmbed } from '@/lib/discordEmbeds';
import { leaguesIconUrl, markSeasonal } from '@/lib/leagues';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { db } from '@/db';
import { accounts, clanRoster } from '@/db/schema';
import { findRosterSeat, personOf, seatsOwnedBy } from '@/lib/roster';
import { personalWebhookTargets, socialEmissionClans } from '@/lib/emissionRouting';
import { and, eq, isNull } from 'drizzle-orm';

// The plugin POSTs clan notifications (death / kill / rare drop / CA) here instead of straight to
// Discord, so it never receives or calls a webhook URL itself — the server owns those (RuneLite
// plugin-hub rule). We resolve the channel's webhook, then forward. Clips do NOT come through here:
// a multi-MB video would blow the request-body limit, so the plugin uploads those directly to a
// webhook the user pastes into its own config.

// Screenshots are small PNGs. Cap well under the platform request-body limit so an oversized upload
// can't tie up the function.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Clips are the one channel that never arrives here (multi-MB video goes to /api/plugin/clip), so
// the accepted set is every channel minus that one. Older plugins post "combatAchievements" for
// levels, quests, diaries and clog slots; that name is still in the list, and the routing table
// resolves it exactly as it always did, so a plugin that predates the split keeps working.
const CHANNELS = NOTIFY_CHANNELS.filter((c) => c !== 'clips');
type Channel = Exclude<NotifyChannel, 'clips'>;

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

function webhookFor(webhooks: PluginWebhooks, channel: Channel): string | null {
  // A channel setting may hold multiple webhook URLs — cycle across them to spread load and dodge
  // Discord's per-webhook rate limit on busy clans.
  return pickWebhookUrl(webhooks[channel], `plugin:${channel}`);
}

/**
 * Where a SEASONAL (Leagues) post goes.
 *
 * League drops are absurd by main-game standards and their kill counts mean nothing next to them,
 * so mixing the two makes both channels useless to read — a clan can point them at their own
 * channel. Falls back to the normal channel when they haven't: routing is an improvement, not a
 * precondition, and a post should never be lost because a webhook is unset.
 *
 * The plugin only reports that the player is ON a seasonal world; which channel that means is
 * decided here, so a clan can change it without waiting for a plugin release.
 */
function seasonalWebhookFor(webhooks: PluginWebhooks, channel: Channel): string | null {
  return pickWebhookUrl(webhooks.leagues, 'plugin:leagues') ?? webhookFor(webhooks, channel);
}

// A player-facing RSN for the embed's author line. Every plugin request already carries the account
// hash and current RSN (BingoApiClient.authedRequest sets them on every call), so the poster is
// identifiable without any plugin change: the hash is the reliable anchor (survives renames), the
// header is the fallback for accounts that never completed a handshake.
//
// Read-only on purpose — the auto-link/verify machinery belongs on the gameplay routes, not on a
// fire-and-forget notification.
/**
 * The account the poster is currently on, resolved to a row THEY own.
 *
 * Scoped to the person (playerId) on purpose: the token proves who is posting, and routing must use
 * one of their OWN accounts — never resolve a hash to somebody else's row and announce it as theirs.
 * Hash first (rename-proof), RSN second. Null when it isn't one of their accounts (unclaimed, or an
 * alt they never linked), which sends the notification down the URL-clan fallback rather than
 * fanning it out — see the POST handler.
 */
async function resolveOwnAccount(request: Request, playerId: number): Promise<{ id: number } | null> {
  const hash = request.headers.get('X-Account-Hash')?.trim() || null;
  if (hash) {
    const [byHash] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.accountHash, hash), eq(accounts.playerId, playerId)))
      .limit(1);
    if (byHash) return byHash;
  }
  const rsn = request.headers.get('X-RSN')?.trim() || null;
  if (rsn) {
    const [byRsn] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.rsnNormalized, normalizeRsn(rsn)), eq(accounts.playerId, playerId)))
      .limit(1);
    if (byRsn) return byRsn;
  }
  return null;
}

async function posterRsn(request: Request, userId: number): Promise<string | null> {
  const accountHash = request.headers.get('X-Account-Hash')?.trim() || null;
  if (accountHash) {
    // The name shown is the one THIS clan knows them by. Their seat in another clan may carry a
    // different RSN, and is none of this clan's business either way.
    const clan = await requirePluginClan(request);
    const owned = await findRosterSeat(and(
        eq(clanRoster.accountHash, accountHash),
        await seatsOwnedBy(clan.id, userId),
        isNull(clanRoster.leftAt),
      ));
    if (owned?.rsn) return owned.rsn;
  }
  // RSN header: self-reported, so it names the account the poster is logged into but proves
  // nothing. Fine for a display line — the token already established who is posting.
  const headerRsn = request.headers.get('X-RSN')?.trim();
  return headerRsn ? headerRsn.slice(0, 12) : null;
}

export async function POST(request: Request) {
  const clan = await requirePluginClan(request);
  const auth = await verifyPluginTokenUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <pluginToken>' }, { status: 401 });
  }

  // The plugin's spam floors (min drop value, dedup windows) all live client-side, so a tampered
  // client or raw API call could flood the clan's Discord through this endpoint. Cap per token holder.
  // 30/min is well above real play (a few drops/deaths/CAs a minute at most) but kills a flood.
  const limit = await rateLimit(request, `plugin-notify:${auth.userId}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many notifications' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let channel: unknown;
  let content: string | undefined;
  let embed: Record<string, unknown> | undefined;
  let image: { bytes: ArrayBuffer; filename: string } | null = null;
  // Player is on a Leagues world — the plugin reports the fact, this route decides what it means.
  let seasonal = false;

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const raw = form.get('payload_json');
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as { channel?: unknown; content?: string; embed?: Record<string, unknown>; seasonal?: unknown };
        channel = parsed.channel;
        content = parsed.content;
        embed = parsed.embed;
        seasonal = parsed.seasonal === true;
      }
      const file = form.get('file');
      if (file instanceof File) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        image = { bytes: await file.arrayBuffer(), filename: file.name || 'image.png' };
      }
    } else {
      const parsed = (await request.json()) as { channel?: unknown; content?: string; embed?: Record<string, unknown>; seasonal?: unknown };
      channel = parsed.channel;
      content = parsed.content;
      embed = parsed.embed;
      seasonal = parsed.seasonal === true;
    }
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  // ── Build the message once, then fan it out ─────────────────────────────────────────────────
  //
  // Deaths and PvP kills arrive as plain text + a screenshot; give them the same embed treatment as
  // everything else. Skipped the moment the plugin sends its own embed for these channels.
  let finalEmbed: Record<string, unknown> | null = embed ?? null;
  let finalContent = content;
  if (!finalEmbed && content && (channel === 'deaths' || channel === 'pvpKills')) {
    finalEmbed = playerEventEmbed({
      kind: channel === 'deaths' ? 'death' : 'pvp_kill',
      rsn: await posterRsn(request, auth.userId),
      message: content,
      imageFilename: image?.filename ?? null,
    }) as unknown as Record<string, unknown>;
    // The message moves into the embed's description, so don't also post it as content.
    finalContent = undefined;
  }

  // Seasonal stamp — server-side, so every kind gets it without the plugin knowing about each one.
  // The icon is a per-clan setting; the poster's member clan (or the URL clan) is a fine source for
  // a cosmetic mark that is the same across destinations.
  if (seasonal) {
    finalEmbed = markSeasonal(finalEmbed, await leaguesIconUrl(clan.id));
  }

  // Strip OSRS '@component@' chat markup the plugin can't (see lib/gameText) — turns a forwarded
  // `⚔️ @ach_comp@This Is Madness` back into `⚔️ This Is Madness` and repairs the wiki URL.
  const outContent = finalContent ? stripGameMarkup(finalContent) : finalContent;
  const outEmbed = finalEmbed ? stripGameMarkupDeep(finalEmbed) : finalEmbed;

  // ── ROUTE BY PERSON, not by the clan in the URL ─────────────────────────────────────────────
  //
  // The announcement is about whoever holds the token, so it goes to THEIR clans — the one they are
  // a member of, plus any they guest in WITH A SHARED account — and to their personal webhooks,
  // whatever clan's site the plugin happens to point at. This is the in-the-wild half of the
  // multi-clan product, and it needs no plugin release because the plugin already posts once and the
  // server owns the webhooks. See lib/emissionRouting for the model (and its privacy gate).
  const playerId = await personOf(auth.userId);
  const account = playerId != null ? await resolveOwnAccount(request, playerId) : null;
  const emissionClans = account ? await socialEmissionClans(account.id) : [];

  const urls = new Set<string>();
  for (const ec of emissionClans) {
    const webhooks = await getNotificationWebhooks(ec.clanId);
    const url = seasonal ? seasonalWebhookFor(webhooks, channel) : webhookFor(webhooks, channel);
    if (url) urls.add(url);
  }

  // THE ADDRESSED CLAN IS NOT A DESTINATION. There used to be a fallback here: an account we could
  // not place posted to whichever clan the URL named, so a notification was "never silently lost
  // while the roster catches up".
  //
  // That was safe when the plugin pointed at its own clan and the URL clan WAS your clan. On one
  // platform the URL is chooseable, and `verifyPluginTokenUser` above checks only that the bearer
  // token maps to a user — no seat, no membership, nothing. So any signed-in account with no live
  // seat could address /c/<someone-else>/api/plugin/notify and have this route post `content` and
  // `embed` — both straight off the request body — into that clan's Discord, thirty times a minute.
  //
  // A person with no clan has no clan destination. That is not a gap to paper over with whichever
  // clan the caller happened to name; it is the answer. Their own webhooks below still fire, which
  // is what a clanless player actually configured, and a member whose seat has not synced yet is
  // quiet for a few minutes rather than loud in a stranger's server.
  //
  // Note this is also what keeps the guest-quiet default honest (drizzle/0080): somebody whose only
  // seats are guest seats routes to no clan by design, and the fallback would have posted to the
  // addressed one anyway, straight past the gate.

  // The person's own destinations, independent of every clan.
  for (const t of await personalWebhookTargets(auth.userId, channel)) urls.add(t.url);

  if (urls.size === 0) {
    // No destination anywhere. Not an error; a webhook can be cleared on the site between the
    // plugin's config poll and this post.
    return new NextResponse(null, { status: 204 });
  }

  let anyOk = false;
  for (const url of urls) {
    const ok = await forwardPluginNotification(url, { content: outContent, embed: outEmbed, attachment: image });
    anyOk = anyOk || ok;
  }
  return NextResponse.json({ ok: anyOk });
}
