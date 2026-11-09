import { NextResponse } from 'next/server';
import { judgeDropRequest, withPetRarity } from '@/lib/notifyDropJudge';
import { keepDropDestinations, type DropVerdict } from '@/lib/notifyDrops';
import { characterClanKinds, clanMainRarity } from '@/lib/notifyDefaults';
import { renderTemplate, resolveTemplate, templateKindOf, templateValues, withTemplate } from '@/lib/notifyTemplates';
import { NOTIFY_DEFAULTS } from '@/lib/notifyPrefs';
import { factsAsPoster, isNewPostKind, milestoneForFeed, vetNewKindPost, type NewKindPost } from '@/lib/notifyKindsPost';
import { liveBoardRows, recordMilestoneMoment } from '@/lib/momentsStore';
import { emitMomentRows } from '@/lib/panelRows';
import { pluginParticipantScope, requirePluginClan, resolvePluginMember, verifyPluginTokenUser } from '@/lib/auth';
import {
  getDeathTaunts,
  getFunDeathMessages,
  getNotificationWebhooks,
  NOTIFY_CHANNELS,
  type NotifyChannel,
  type PluginWebhooks,
} from '@/lib/pluginConfig';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { playerEventEmbed } from '@/lib/discordEmbeds';
import { buildPluginEmbed, type DeathWording } from '@/lib/pluginEmbeds';
import { getNotifyPrefs } from '@/lib/notifyPrefsStore';
import { FALLEN_MODE, fallenEmbed } from '@/lib/hardcoreFall';
import { markMode, routeModePost, type WorldMode } from '@/lib/worldModes';
import { worldModeOf } from '@/lib/worldModeRequest';
import { getModeFilters, getModeRouting, modeIconUrl, rememberSeenMode } from '@/lib/worldModeStore';
import { modeFilterAllows } from '@/lib/modeFilters';
import { stripChatTags, stripChatTagsDeep } from '@/lib/chatTags';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { findRosterSeat, seatsOwnedBy } from '@/lib/roster';
import { clanTagsGuestEmissions, markGuestPost, personalWebhookTargets, socialEmissionClans } from '@/lib/emissionRouting';
import { and, eq, isNull } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { effectiveClanRules, levelPostMatches, levelPostOf } from '@/lib/levelRules';
import { getClanMilestoneRules, getMemberLevelPrefs } from '@/lib/levelRulesStore';
import { labQuarantine } from '@/lib/lab';
import { apexOrigin } from '@/lib/seo';
import { supporterForUsers, withSupporterAuthor } from '@/lib/supporter';
import { boostedClanIdsForAccount, withBoosterAuthor } from '@/lib/clanBoosts';
import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { refuseForeignCharacter } from '@/lib/pluginForeign';

// The plugin POSTs clan notifications (death / kill / rare drop / CA) here instead of straight to
// Discord, so it never receives or calls a webhook URL itself — the server owns those (RuneLite
// plugin-hub rule). We resolve the channel's webhook, then forward. Clips do NOT come through here:
// a multi-MB video would blow the request-body limit, so the plugin uploads those directly to a
// webhook the user pastes into its own config.

// Screenshots are small PNGs. Cap well under the platform request-body limit so an oversized upload
// can't tie up the function.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** A death / PvP-kill line is one game message; nothing longer is a real one. */
const MAX_LINE_CHARS = 300;

// Clips are the one channel that never arrives here (multi-MB video goes to /api/plugin/clip), so
// the accepted set is every channel minus that one. Older plugins post "combatAchievements" for
// levels, quests, diaries and clog slots; that name is still in the list, and the routing table
// resolves it exactly as it always did, so a plugin that predates the split keeps working.
const CHANNELS = NOTIFY_CHANNELS.filter((c) => c !== 'clips');
type Channel = Exclude<NotifyChannel, 'clips'>;

/** The notify body. `kind` + `facts` (site-embeds) or a plugin-built `embed` (older plugins). */
type NotifyBody = {
  channel?: unknown;
  content?: string;
  embed?: Record<string, unknown>;
  kind?: unknown;
  facts?: unknown;
  seasonal?: unknown;
  /** The world the post was made on, frozen in by the plugin (lib/worldModeRequest). */
  world?: unknown;
};

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

function webhookFor(webhooks: PluginWebhooks, channel: Channel): string | null {
  // A channel setting may hold multiple webhook URLs — cycle across them to spread load and dodge
  // Discord's per-webhook rate limit on busy clans.
  return pickWebhookUrl(webhooks[channel], `plugin:${channel}`);
}

/**
 * Where a post from a GAME-MODE world (Leagues, Deadman, hardcore, … — lib/worldModes) goes in one
 * clan.
 *
 * A league or Deadman drop is absurd by main-game standards and its kill counts mean nothing next
 * to main-game ones, so mixing them makes both channels useless to read. Each clan decides, per
 * mode: its own channel, which kinds of post, or nothing at all — and one master switch keeps every
 * mode in the normal channels. With no mode channel set, a post lands where the same post from the
 * main game would: routing is an improvement, never the reason a post is lost.
 *
 * The plugin only reports the world; which mode that is and where it goes is decided here, so a
 * clan can change it — and a mode Jagex launches tomorrow is handled — without a plugin release.
 */
async function modeWebhookFor(
  clanId: number,
  webhooks: PluginWebhooks,
  channel: Channel,
  mode: WorldMode,
): Promise<string | null> {
  const leaguesHook = pickWebhookUrl(webhooks.leagues, 'plugin:leagues');
  const routing = await getModeRouting(clanId, mode.key, leaguesHook);
  return routeModePost(channel, { ...routing, normalHook: webhookFor(webhooks, channel) });
}

// A player-facing RSN for the embed's author line. Every plugin request already carries the account
// hash and current RSN (BingoApiClient.authedRequest sets them on every call), so the poster is
// identifiable without any plugin change: the hash is the reliable anchor (survives renames), the
// header is the fallback for accounts that never completed a handshake.
// The account/routing resolution below uses the full plugin-member path. This helper only chooses
// the display name for the old plain-text death/PvP payloads.
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
  // Resolve the same exact owned account as /moments. The old, second identity lookup understood
  // neither previous RSNs nor the rest of the plugin's claim/rename path, so the site could accept
  // a named pet into the feed and then silently find no Discord destination for the sibling call.
  // Keep token-only auth as the fallback for personal hooks when the current account has no seat.
  const member = await resolvePluginMember(request);
  const auth = member ?? (await verifyPluginTokenUser(request));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <pluginToken>' }, { status: 401 });
  }
  // The login fallback posts AS the character being played, so that character has to be this
  // login's own — somebody else's (or one this login let go of) posts nothing (lib/pluginForeign).
  if (!member) {
    const foreign = await refuseForeignCharacter(request);
    if (foreign) return foreign;
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
  // Site-built embeds (capability 'site-embeds', lib/pluginEmbeds): the plugin sends what happened
  // and this route composes the post. Older plugins keep sending a finished `embed`, passed through.
  let kind: unknown;
  let facts: unknown;
  // Player is on a Leagues world — what plugins before `world` said; this route decides what it means.
  let seasonal = false;
  // The world the post was made on (types + activity), frozen in by the plugin.
  let world: unknown;

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const raw = form.get('payload_json');
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as NotifyBody;
        channel = parsed.channel;
        content = parsed.content;
        embed = parsed.embed;
        kind = parsed.kind;
        facts = parsed.facts;
        seasonal = parsed.seasonal === true;
        world = parsed.world;
      }
      const file = form.get('file');
      if (file instanceof File) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        image = { bytes: await file.arrayBuffer(), filename: file.name || 'image.png' };
      }
    } else {
      const parsed = (await request.json()) as NotifyBody;
      channel = parsed.channel;
      content = parsed.content;
      embed = parsed.embed;
      kind = parsed.kind;
      facts = parsed.facts;
      seasonal = parsed.seasonal === true;
      world = parsed.world;
    }
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  // A tile-lab session logs this post (lib/lab). A replayed scenario's stops there and posts nowhere;
  // real play posts as usual — the lab clan has no channels, so only the player's real clans hear it.
  const quarantined = await labQuarantine(
    request,
    member?.accountId ?? (async () => (await resolvePluginCharacter(request))?.accountId),
    'notify',
    { channel, kind, facts, content, embed, seasonal, world, image: image?.filename ?? null },
  );
  if (quarantined) return quarantined;

  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  // A drop the plugin's screenshot gate let through (capability 'notify-prefs'): whether it posts, and
  // what the post says about it, is decided here (lib/notifyDrops) — the person's floors live on the site.
  // Who takes it: the clan channels and/or some of the person's own webhooks (each judged by its own filters).
  let dropVerdict: DropVerdict | null = null;
  if (kind === 'drop' && facts && typeof facts === 'object' && (facts as { judge?: unknown }).judge === true) {
    const judged = await judgeDropRequest(request, clan.id, auth.userId, member?.accountId ?? null, facts);
    if (!judged) return NextResponse.json({ ok: true, declined: 1 });
    facts = judged.facts;
    dropVerdict = judged;
  }
  if (kind === 'pet') facts = await withPetRarity(facts);
  // WHO POSTED IS THE TOKEN'S CHARACTER, for every kind: the `rsn` a body names is ignored and replaced
  // by the character the token resolved (its seat's name; else the poster lookup). A body name let a
  // client post a drop, pet or level under someone else's name into clan channels.
  const poster = member?.rsn ?? (await posterRsn(request, auth.userId));
  if (kind !== undefined && facts && typeof facts === 'object' && !Array.isArray(facts)) facts = factsAsPoster(facts, poster);
  // The newer kinds (lib/notifyKinds): re-checked against the person's settings in force, so a client
  // can't post a line nobody turned on. Private kinds and own patterns go to own webhooks only.
  let newPost: NewKindPost | null = null;
  if (isNewPostKind(kind)) {
    // The name on the post is the token's own character's, never the `rsn` the body names: a shared
    // line kind reaches clan channels, where a body name would put words in someone else's mouth.
    facts = factsAsPoster(facts, poster);
    const [prefs, clanKinds] = await Promise.all([getNotifyPrefs(auth.userId), characterClanKinds(member?.accountId ?? null, clan.id)]);
    newPost = vetNewKindPost(kind, facts, prefs.announce, clanKinds);
    if (channel !== 'milestones') return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
    if (!newPost) return NextResponse.json({ ok: true, declined: 1 });
    // A shared line kind also makes a clan feed row, in the member's clan (lib/milestoneMoments). Never a
    // private kind or a player's own pattern: those stay on their own webhooks.
    const milestone = member ? milestoneForFeed(kind, facts, prefs.announce, clanKinds) : null;
    if (milestone && member) {
      try {
        // Every live board they're drafted onto too, co-hosted and clan-v-clan included (lab boards aside).
        const boards = await liveBoardRows(member.clanMemberId, new Date(), await pluginParticipantScope(member, { lab: false }));
        const stored = await recordMilestoneMoment(member, milestone, boards);
        if (stored.clan.length) await emitMomentRows(member.clanId, 'member', stored.clan);
        // The board copies go to the boards' lists only: 'guest' skips the clan push, which has its own copy.
        if (stored.boards.length) await emitMomentRows(member.clanId, 'guest', stored.boards);
      } catch (e) {
        log.warn('plugin-notify.milestone-moment-failed', { error: String(e) });
      }
    }
  }
  // A death is facts only (what killed them); the words are the person's and the clan's, read here.
  let death: DeathWording | null = null;
  if (kind === 'death' && facts && typeof facts === 'object' && !Array.isArray(facts)) {
    const f = facts as { rsn?: unknown };
    if (typeof f.rsn !== 'string' || !f.rsn.trim()) facts = { ...f, rsn: await posterRsn(request, auth.userId) };
    const [prefs, funLines, taunts] = await Promise.all([
      getNotifyPrefs(auth.userId),
      getFunDeathMessages(clan.id),
      getDeathTaunts(clan.id),
    ]);
    // The death line: their own template, else their old Death message if they changed it, else the
    // clan's template, else Anvil's (lib/notifyTemplates). {player} / {name} and {killer}.
    const clanTemplates = (await characterClanKinds(member?.accountId ?? null, clan.id)).templates;
    const own = prefs.announce.templates?.deaths ?? (prefs.deathMsg !== NOTIFY_DEFAULTS.deathMsg ? prefs.deathMsg : undefined);
    const t = resolveTemplate('deaths', own ? { deaths: own } : {}, clanTemplates);
    const message = t.source === 'platform' ? prefs.deathMsg : renderTemplate('deaths', t.template, templateValues('deaths', facts, null));
    death = { message, funLines, taunts };
  }

  // ── Build the message once, then fan it out ─────────────────────────────────────────────────
  //
  // Deaths and PvP kills arrive as plain text + a screenshot; give them the same embed treatment as
  // everything else.
  //
  // The plugin composes these embeds from chat lines, and until every client is on a release that
  // strips Jagex's @tag@ colour codes (lib/chatTags) one can be anywhere in one — a title, a field,
  // the wiki URL built from a task name. Cleaned here so a post reads right today rather than on the
  // plugin-hub's schedule; on a client that already strips them this is a no-op.
  //
  // A plugin-built `embed`, and free `content` on any other channel, are no longer posted. Both went
  // straight from the request body into the clan's Discord, so any member's token could put whatever
  // it liked there — links, a fake "announcement" — under the site's webhook. Every current client
  // sends `kind` + `facts`, which the site composes; free text survives only as a death / PvP-kill
  // line, folded into the site's own embed below, and capped.
  void embed;
  let finalEmbed: Record<string, unknown> | null = null;
  const finalContent: string | undefined = undefined;
  const lineText = typeof content === 'string' ? stripChatTags(content).slice(0, MAX_LINE_CHARS) : '';
  if (newPost) {
    finalEmbed = stripChatTagsDeep(newPost.embed as unknown as Record<string, unknown>);
    if (image) finalEmbed.image = { url: `attachment://${image.filename}` };
  } else if (kind !== undefined) {
    const built = buildPluginEmbed(kind, facts, { imageFilename: image?.filename ?? null, death });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }
    // Same tag scrub as a passed-through embed: names in facts come straight off game text.
    finalEmbed = stripChatTagsDeep(built.embed as unknown as Record<string, unknown>);
  }
  if (!finalEmbed && lineText && (channel === 'deaths' || channel === 'pvpKills')) {
    finalEmbed = playerEventEmbed({
      kind: channel === 'deaths' ? 'death' : 'pvp_kill',
      rsn: await posterRsn(request, auth.userId),
      message: lineText,
      imageFilename: image?.filename ?? null,
    }) as unknown as Record<string, unknown>;
  }
  if (!finalEmbed) {
    return NextResponse.json({ error: 'Nothing to post — send kind and facts.' }, { status: 400 });
  }
  // A message template someone set (lib/notifyTemplates) replaces the post's first line. Unset, the
  // builder's own wording stands untouched. Deaths are worded above.
  const tKind = templateKindOf(kind, channel, facts);
  if (tKind && tKind !== 'deaths' && finalEmbed) {
    const [prefs, clanKinds] = await Promise.all([getNotifyPrefs(auth.userId), characterClanKinds(member?.accountId ?? null, clan.id)]);
    const t = resolveTemplate(tKind, prefs.announce.templates, clanKinds.templates);
    if (t.source !== 'platform' && t.template) {
      const rsn = tKind === 'pvp' ? await posterRsn(request, auth.userId) : null;
      finalEmbed.description = withTemplate(finalEmbed.description as string | undefined, renderTemplate(tKind, t.template, templateValues(tKind, facts, rsn)));
    }
  }

  // Game-mode stamp ("[Deadman] …") — server-side, so every kind gets it without the plugin knowing
  // about each one. The icon is a per-clan setting; the URL clan is a fine source for a cosmetic
  // mark that is the same across destinations. (A mode nobody catalogued is remembered below, per
  // clan the poster actually posts into — never the URL clan, which any token holder can name.)
  const mode = worldModeOf(request, { world, seasonal });
  // A death on Hardcore Worlds ends the character (lib/hardcoreFall): its own post, and it goes to the
  // clan's main deaths channel as well as the mode's.
  const fallen = mode?.key === FALLEN_MODE && channel === 'deaths';
  if (fallen) finalEmbed = fallenEmbed(finalEmbed);
  if (mode) {
    finalEmbed = markMode(finalEmbed, mode.label, await modeIconUrl(clan.id, mode));
  }

  // Strip OSRS '@component@' chat markup the plugin can't (see lib/chatTags) — turns a forwarded
  // `⚔️ @ach_comp@This Is Madness` back into `⚔️ This Is Madness` and repairs the wiki URL.
  const outContent = finalContent ? stripChatTags(finalContent) : finalContent;
  let outEmbed = finalEmbed ? stripChatTagsDeep(finalEmbed) : finalEmbed;
  // Before the star: a clan this character boosts gets the booster gem in its place (below).
  const unstarred = outEmbed;
  // An Anvil Supporter's posts carry their tier's star beside their name. Cosmetic: a failed read
  // posts without it.
  if (outEmbed?.author) {
    const s = (await supporterForUsers([auth.userId]).catch(() => new Map())).get(auth.userId) ?? null;
    outEmbed = withSupporterAuthor(outEmbed, s?.tier.id ?? null, apexOrigin(), s?.style ?? null);
  }

  // ── ROUTE BY PERSON, not by the clan in the URL ─────────────────────────────────────────────
  //
  // The announcement is about whoever holds the token, so it goes to THEIR clans — the one they are
  // a member of, plus any they guest in WITH A SHARED account — and to their personal webhooks,
  // whatever clan's site the plugin happens to point at. This is the in-the-wild half of the
  // multi-clan product, and it needs no plugin release because the plugin already posts once and the
  // server owns the webhooks. See lib/emissionRouting for the model (and its privacy gate).
  const emissionClans = member && dropVerdict?.clan !== false && !newPost?.personalOnly ? await socialEmissionClans(member.accountId) : [];

  // LEVEL POSTS ARE RE-CHECKED PER DESTINATION (lib/levelRules). The plugin sends a level-up when it
  // matches EITHER the member's clan rules or their personal rules, so each destination asks its own
  // question: a clan channel takes it under that clan's rules after the member's choice, a personal
  // webhook under the member's own rules. A destination that declines is skipped, never an error.
  // Released plugins' `level99` / `totalLevel` posts go through the same check.
  const levelPost = kind !== undefined && !newPost ? levelPostOf(kind, facts) : null;
  const levelPrefs = levelPost ? await getMemberLevelPrefs(auth.userId) : null;
  let declined = 0;

  // Destination → the clan it belongs to (for that clan's bot name and icon); personal webhooks have none.
  let urls = new Map<string, number | undefined>();
  // Destinations where this account only GUESTS and the clan asked for guests' posts to be marked.
  const markAsGuest = new Set<string>();
  for (const ec of emissionClans) {
    // A main-game level post follows the clan's rules; a game mode's follows the mode's own (below).
    if (levelPost && levelPrefs && !mode) {
      const rules = effectiveClanRules(await getClanMilestoneRules(ec.clanId), levelPrefs.clanChoice);
      if (!levelPostMatches(levelPost, rules)) {
        declined++;
        continue;
      }
    }
    // A mode's own thresholds (lib/modeFilters), looser or stricter than the main game: drop rarity,
    // drop value, level milestones. The plugin sent whatever the MOST permissive of this person's
    // clans allows, so each clan asks its own question here. Only posts they can judge cost a read.
    if (mode && (kind === 'drop' || levelPost)) {
      const filters = await getModeFilters(ec.clanId, mode.key);
      // An unset rarity half is judged against the clan's main-game floor — read only when needed.
      const mainRarityFloor =
        kind === 'drop' && filters.dropFloor == null && filters.dropMinValue != null ? await clanMainRarity(ec.clanId) : 0;
      if (!modeFilterAllows(kind, facts, filters, { mainRarityFloor, levelChoice: levelPrefs?.clanChoice ?? 'clan' })) {
        declined++;
        continue;
      }
    }
    // A new mode joins this clan's Game modes list only off a post by someone with a seat here.
    if (mode) await rememberSeenMode(ec.clanId, mode);
    const webhooks = await getNotificationWebhooks(ec.clanId);
    const url = mode ? await modeWebhookFor(ec.clanId, webhooks, channel, mode) : webhookFor(webhooks, channel);
    // A fallen post also goes to the main deaths channel — unless the clan muted the mode (no url).
    const main = fallen && url ? webhookFor(webhooks, channel) : null;
    for (const u of [url, main]) {
      if (!u || urls.has(u)) continue;
      urls.set(u, ec.clanId);
      if (ec.kind === 'guest' && (await clanTagsGuestEmissions(ec.clanId))) markAsGuest.add(u);
    }
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
  // A newer kind is subscribed to by its own name on a webhook (the per-webhook override).
  const personalTargets = await personalWebhookTargets(auth.userId, newPost?.kind ?? channel, dropVerdict ? { only: new Set(dropVerdict.hooks) } : undefined);
  if (levelPost && levelPrefs && personalTargets.length > 0 && !levelPostMatches(levelPost, levelPrefs.personal)) {
    declined += personalTargets.length;
  } else {
    for (const t of personalTargets) if (!urls.has(t.url)) urls.set(t.url, undefined);
  }
  // A drop the clan's gate declined goes only to the personal webhooks that took it, never a clan channel.
  urls = keepDropDestinations(urls, dropVerdict);

  if (urls.size === 0 && declined > 0) {
    // Every destination's rules said no. That is the rules working, not a failure.
    return NextResponse.json({ ok: true, declined });
  }

  if (urls.size === 0) {
    // No destination anywhere. Not an error; a webhook can be cleared on the site between the
    // plugin's config poll and this post.
    log.warn('plugin-notify.no-destination', {
      userId: auth.userId,
      accountId: member?.accountId ?? null,
      addressedClanId: clan.id,
      channel,
    });
    return new NextResponse(null, { status: 204 });
  }

  // The clans this character boosts (lib/clanBoosts): THEIR posts wear the booster gem by the name
  // instead of the star. Every other clan, and personal webhooks, keep the ordinary star.
  const boosted =
    unstarred?.author && member ? await boostedClanIdsForAccount(member.accountId).catch(() => new Set<number>()) : new Set<number>();

  let anyOk = false;
  for (const [url, clanId] of urls) {
    const embedHere = clanId != null && boosted.has(clanId) ? withBoosterAuthor(unstarred!, apexOrigin()) : outEmbed;
    const post = markAsGuest.has(url) ? markGuestPost(embedHere, outContent) : { embed: embedHere, content: outContent };
    const ok = await forwardPluginNotification(url, {
      content: post.content ?? undefined,
      embed: post.embed ?? null,
      attachment: image,
      clanId,
    });
    anyOk = anyOk || ok;
  }
  if (!anyOk) {
    log.warn('plugin-notify.all-destinations-failed', {
      userId: auth.userId,
      accountId: member?.accountId ?? null,
      addressedClanId: clan.id,
      channel,
      destinations: urls.size,
    });
    return NextResponse.json({ ok: false, error: 'Discord refused every destination' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
