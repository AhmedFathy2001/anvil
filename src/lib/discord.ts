import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { startBlockerLabel, type StartBlockerCode } from '@/lib/eventReadiness';
import { formatEfficiencyHours } from '@/lib/constants';
import { deriveTileIcon, skillIconUrl, bossItemForStatKey, itemIconUrl, type IconableTile } from '@/lib/tileIcons';
import {
  EMBED_COLOR,
  clamp,
  field,
  statField,
  stampEmbeds,
  teamColorToDecimal,
  LIMIT,
  type DiscordEmbed,
  type DiscordEmbedField,
} from '@/lib/discordEmbeds';

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  // Restrict which mentions actually ping. When pinging a role we set `roles` explicitly so the
  // role notifies even if it isn't "mentionable", and nothing else (e.g. @everyone) can slip in.
  allowed_mentions?: { parse?: string[]; roles?: string[]; users?: string[] };
}

// General / plugin-updates webhook — clan-roster changes (member joins / leaves / renames / count)
// and any non-event-specific posts. NOT bingo-specific.
const GENERAL_WEBHOOK_KEY = 'discord_webhook_url';
// Dedicated bingo-event webhook (event start/end, draft, blackout, submissions). Falls back to the
// general webhook when unset so existing single-webhook setups keep receiving bingo posts.
const BINGO_WEBHOOK_KEY = 'discord_webhook_bingo';
// Dedicated weekly competition (SOTW/BOTW) start/end/winner webhook.
const WEEKLY_WEBHOOK_KEY = 'discord_webhook_weekly';
// Dedicated sign-up channel — posts when an admin approves a sign-up, nudging the member to pay
// their entry fee. No fallback: stays silent until a dedicated webhook is set.
const SIGNUP_WEBHOOK_KEY = 'discord_webhook_signups';

async function getSettingUrl(key: string): Promise<string | null> {
  try {
    const setting = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    return setting?.value || null;
  } catch (error) {
    log.warn('discord.db-read-fail', { key }, error);
    return null;
  }
}

// A webhook setting may hold MULTIPLE URLs (newline / comma / space separated). Splitting a
// destination across several webhooks lets us round-robin posts and dodge Discord's per-webhook
// rate limit on busy clans. Only well-formed https URLs are kept.
export function parseWebhookUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((u) => /^https:\/\/\S+/i.test(u));
}

// Best-effort round-robin cursor per setting key. In-process only (serverless may reset it between
// invocations), but within a single cron tick — where a burst of posts actually risks the limit —
// it spreads load across the configured URLs. The random seed stops every cold start from hammering
// url[0] first.
const rrCursors = new Map<string, number>();
function pickCycledUrl(urls: string[], key: string): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  const start = rrCursors.get(key) ?? Math.floor(Math.random() * urls.length);
  rrCursors.set(key, start + 1);
  return urls[start % urls.length];
}

// Parse a raw multi-URL setting value and pick one round-robin. Exported for callers that already
// hold the raw value (e.g. the plugin-notify route reads all channel webhooks in one batch).
export function pickWebhookUrl(raw: string | null | undefined, cursorKey: string): string | null {
  return pickCycledUrl(parseWebhookUrls(raw), cursorKey);
}

// Resolve a webhook destination: the first key in `keys` that has any URL(s) wins, and one of its
// URLs is chosen round-robin. Pass the master key (`discord_webhook_url`) last so every destination
// falls back to it — set only the master and everything posts there ("simple" mode); set the
// specific keys to split channels ("advanced" mode).
async function resolveWebhookUrl(...keys: string[]): Promise<string | null> {
  for (const key of keys) {
    const urls = parseWebhookUrls(await getSettingUrl(key));
    if (urls.length) return pickCycledUrl(urls, key);
  }
  return null;
}

const MAX_RETRY_MS = 5000;

async function postWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<Response> {
  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Brand every embed here rather than in each builder: this is the single JSON exit to Discord,
    // so a post added later can't forget the footer.
    body: JSON.stringify(stampEmbeds(payload)),
  });
}

// Post to a specific webhook URL with Discord's 429 retry handling. Returns true on a 2xx.
async function sendToWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<boolean> {
  try {
    let response = await postWebhook(webhookUrl, payload);

    if (response.status === 429) {
      // Discord sends Retry-After in seconds (sometimes fractional). Also check
      // the JSON body's retry_after which can be more precise for route-specific
      // buckets. Cap total wait so a hot bucket can't stall a cron job.
      const headerVal = response.headers.get('retry-after');
      let retryMs = headerVal ? Number(headerVal) * 1000 : 0;
      if (!retryMs) {
        try {
          const body = (await response.clone().json()) as { retry_after?: number };
          if (typeof body.retry_after === 'number') retryMs = body.retry_after * 1000;
        } catch { /* body wasn't JSON */ }
      }
      retryMs = Math.max(250, Math.min(retryMs || 1000, MAX_RETRY_MS));
      log.warn('discord.rate-limited', { retryMs });
      await new Promise((r) => setTimeout(r, retryMs));
      response = await postWebhook(webhookUrl, payload);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      log.warn('discord.webhook-fail', { status: response.status, body: text.slice(0, 200) });
    }
    return response.ok;
  } catch (error) {
    log.warn('discord.webhook-exception', {}, error);
    return false;
  }
}

// Forward a plugin-originated notification (death / kill / rare drop / CA) to a clan webhook. The
// plugin POSTs these to /api/plugin/notify, which resolves the channel's webhook server-side and
// calls this — so the plugin never holds or calls the Discord URL itself (RuneLite plugin-hub rule).
// `embed` is arbitrary embed JSON built by the plugin; `image` is an optional screenshot the embed
// references via "attachment://<filename>".
export async function forwardPluginNotification(
  webhookUrl: string,
  payload: {
    content?: string;
    embed?: Record<string, unknown> | null;
    image?: { bytes: ArrayBuffer; filename: string } | null;
  },
): Promise<boolean> {
  const { content, embed, image } = payload;
  const embeds = embed ? [embed as unknown as DiscordEmbed] : undefined;
  // content/embed are plugin-supplied and reach here from anyone holding a plugin token, so neutralize
  // mentions: these clan notifications never legitimately ping, and without this a tampered plugin
  // could blast @everyone/@here/role pings through the webhook.
  const allowed_mentions: DiscordWebhookPayload['allowed_mentions'] = { parse: [] };

  if (!image) {
    return sendToWebhook(webhookUrl, { content: content || undefined, embeds, allowed_mentions });
  }

  // Multipart upload so the screenshot rides along; Discord renders it inline via the embed's
  // attachment:// reference. sendToWebhook is JSON-only, so this path posts directly — which means
  // it also has to stamp the brand footer itself (postWebhook does it for every other exit).
  try {
    const form = new FormData();
    form.append(
      'payload_json',
      JSON.stringify(stampEmbeds({ content: content || undefined, embeds, allowed_mentions })),
    );
    form.append('files[0]', new Blob([image.bytes]), image.filename);
    const response = await fetch(webhookUrl, { method: 'POST', body: form });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      log.warn('discord.plugin-notify-fail', { status: response.status, body: text.slice(0, 200) });
    }
    return response.ok;
  } catch (error) {
    log.warn('discord.plugin-notify-exception', {}, error);
    return false;
  }
}

// General / master channel — clan-roster sync summaries and other non-event posts. This is the
// webhook every other destination falls back to.
export async function sendDiscordWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookUrl(GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

// Bingo-event channel; falls back to the master webhook so single-webhook clans keep getting bingo
// posts until they split the channel.
export async function sendBingoWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookUrl(BINGO_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

// Weekly-competition channel; falls back to the master webhook when no dedicated one is set.
export async function sendWeeklyWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookUrl(WEEKLY_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

// Sign-up approvals channel; falls back to the master webhook when no dedicated one is set.
export async function sendSignupWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await resolveWebhookUrl(SIGNUP_WEBHOOK_KEY, GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

interface SignupApprovedNotifyParams {
  eventId: number;
  eventName: string;
  displayName: string;
  discordId: string | null;
  rsn: string;
  feeAmount: number | null; // gp; null / 0 = free event
  feeAlreadyPaid: boolean;
}

// Posted when an admin approves a sign-up. Pings the approved member and nudges them to pay the
// entry fee so approvals convert into paid, committed seats. Fire-and-forget from the approve action.
export async function notifySignupApproved(params: SignupApprovedNotifyParams): Promise<boolean> {
  const { eventId, eventName, displayName, discordId, rsn, feeAmount, feeAlreadyPaid } = params;
  const base = siteBaseUrl();
  const signupUrl = base ? `${base}/events/${eventId}/signup` : null;
  const hasFee = !!feeAmount && feeAmount > 0;

  const lines = [`**${displayName}** (\`${rsn}\`) is approved for **${eventName}**! 🎉`];
  if (hasFee && !feeAlreadyPaid) {
    lines.push(
      '',
      `💰 Lock your spot — pay the **${feeAmount!.toLocaleString()} gp** entry fee, then report it on the site.`,
    );
    if (signupUrl) lines.push(`→ [Pay & report your fee](${signupUrl})`);
  } else if (hasFee && feeAlreadyPaid) {
    lines.push('', "✅ Fee already received — you're locked in. Good luck!");
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '✅ Sign-up approved',
    description: lines.join('\n'),
    color: EMBED_COLOR.green,
  };

  return sendSignupWebhook({
    content: discordId ? `<@${discordId}>` : undefined,
    embeds: [embed],
    // Ping only the approved member; never @everyone/roles.
    allowed_mentions: discordId ? { parse: [], users: [discordId] } : { parse: [] },
  });
}

export async function sendTestWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Posts straight to the URL under test (it isn't a configured destination yet), so it stamps
      // the brand footer itself — this is also the admin's first look at the house style.
      body: JSON.stringify(
        stampEmbeds({
          embeds: [{
            title: '✅ Webhook connected',
            description: 'This channel is wired up. Anvil will post here.',
            color: EMBED_COLOR.green,
          }],
        }),
      ),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send test webhook:', error);
    return false;
  }
}

// The author line every board post opens with: "<event>" or "<event> · <team>", linking to the
// event page when the site URL is known. It carries the context that used to sit in three inline
// Event/Tile/Team fields, which frees the title to say what actually happened.
function eventAuthor(
  eventId: number | null | undefined,
  eventName: string,
  teamName?: string | null,
): Pick<DiscordEmbed, 'author'> {
  const name = teamName ? `${eventName} · ${teamName}` : eventName;
  const url = eventId != null ? eventLeaderboardUrl(eventId) : null;
  return { author: { name: clamp(name, LIMIT.author), ...(url ? { url } : {}) } };
}

// Thumbnail for a tile-driven post — the tile's own item/skill/boss sprite, the same image the
// board renders. Absent for tiles with no derivable icon (e.g. manual tiles).
function tileThumbnail(tile: IconableTile | null | undefined): Pick<DiscordEmbed, 'thumbnail'> {
  const icon = tile ? deriveTileIcon(tile) : null;
  return icon ? { thumbnail: { url: icon } } : {};
}

// Discord renders <t:UNIX:STYLE> dynamically per viewer: the timezone is the
// reader's own, and the `R` (relative) style is a live countdown that ticks
// down on its own — no re-posting needed. Far better than a server-side
// toLocaleString(), which would bake in the server's UTC clock for everyone.
//   F = full date+time (e.g. "Friday, June 26, 2026 8:00 PM")
//   R = relative/countdown (e.g. "in 3 days")
function discordTime(date: string | Date, style: 'F' | 'R' = 'F'): string {
  const secs = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${secs}:${style}>`;
}

interface SubmissionNotifyParams {
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  creditPlayerName: string | null;
  amount: number;
  currentTotal: number;
  requiredAmount: number | null;
  note: string | null;
  imageUrl: string | null;
  // Tile kind so the embed can label itself ('drop' | 'kill' | 'timed'). Defaults to drop.
  tileType?: string | null;
  // Timed-tile clear time in seconds (shown as mm:ss). Null for drop/kill submissions.
  durationSeconds?: number | null;
  // True when this submission completed the tile — folds the old separate completion post into
  // this one message so a completing submission costs the bingo webhook one request, not two.
  completed?: boolean;
  // Links the author line to the live board. Optional: older callers just get an unlinked line.
  eventId?: number | null;
  // The tile row, for its icon (the thumbnail). Optional — no icon, no thumbnail.
  tile?: IconableTile | null;
}

function formatClearTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Headline for a submission post. Completions get their own line; otherwise the tile kind names
// what landed. The tile label rides in the title (it used to be a field) so the post reads as a
// sentence at a glance in a busy channel.
function submissionTitle(tileType: string | null | undefined, tileLabel: string, completed: boolean): string {
  const lead = completed
    ? '✅ Tile complete'
    : tileType === 'timed' ? '⏱️ Timed clear'
    : tileType === 'kill' ? '⚔️ Kill'
    : tileType === 'pvp' ? '💀 PvP kill'
    : '🎯 Drop';
  return clamp(`${lead} — ${tileLabel}`, LIMIT.title);
}

export async function notifySubmission(params: SubmissionNotifyParams): Promise<boolean> {
  const {
    eventName,
    tileLabel,
    teamName,
    teamColor,
    creditPlayerName,
    amount,
    currentTotal,
    requiredAmount,
    note,
    imageUrl,
    tileType,
    durationSeconds,
    completed,
    eventId,
    tile,
  } = params;

  const fields: DiscordEmbedField[] = [];

  if (tileType === 'timed' && durationSeconds != null) {
    fields.push(statField('Clear time', formatClearTime(durationSeconds)));
  } else if (tileType === 'kill' || tileType === 'pvp') {
    fields.push(statField('Kills', requiredAmount ? `+${amount} · ${currentTotal}/${requiredAmount}` : `+${amount}`));
  } else if (requiredAmount) {
    fields.push(statField('Progress', `+${amount} · ${currentTotal}/${requiredAmount}`));
  }

  if (note) {
    fields.push(field('Note', note, false));
  }

  const who = creditPlayerName ? `**${creditPlayerName}**` : 'Someone';
  const description = completed
    ? `${who} finished it for **${teamName}**.`
    : `${who} submitted for **${teamName}**.`;

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: submissionTitle(tileType, tileLabel, !!completed),
    description,
    color: teamColorToDecimal(teamColor),
    ...(fields.length ? { fields } : {}),
  };

  const boardUrl = eventId != null ? eventLeaderboardUrl(eventId) : null;
  if (boardUrl) embed.url = boardUrl;
  if (imageUrl) embed.image = { url: imageUrl };

  return sendBingoWebhook({ embeds: [embed] });
}

// Merged/debounced variant of notifySubmission. Several submissions for the same tile+team that
// arrived within a quiet window collapse into ONE post: `pendingAmount` is the total accrued since
// the last flush, `currentTotal`/`requiredAmount` the live standing. Used by the server-side
// notification debounce so a kill spree (or a downtime boss ticking one kill at a time) is a single
// embed instead of one per submission. Mirrors notifySubmission's layout so the feed reads uniformly.
interface MergedSubmissionParams {
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  tileType?: string | null;
  creditPlayerName?: string | null;
  pendingAmount: number;
  currentTotal: number | null;
  requiredAmount: number | null;
  note: string | null;
  imageUrl: string | null;
  completed: boolean;
  eventId?: number | null;
  tile?: IconableTile | null;
}

export async function notifyMergedSubmission(params: MergedSubmissionParams): Promise<boolean> {
  const {
    eventName, tileLabel, teamName, teamColor, tileType, creditPlayerName,
    pendingAmount, currentTotal, requiredAmount, note, imageUrl, completed, eventId, tile,
  } = params;

  const fields: DiscordEmbedField[] = [];

  const progress = requiredAmount != null && currentTotal != null
    ? ` · ${currentTotal}/${requiredAmount}`
    : '';
  fields.push(
    statField(tileType === 'kill' || tileType === 'pvp' ? 'Kills' : 'Progress', `+${pendingAmount}${progress}`),
  );

  if (note) {
    fields.push(field('Note', note, false));
  }

  // Who the credit went to — matches notifySubmission's wording so merged posts read the same.
  const who = creditPlayerName ? `**${creditPlayerName}**` : 'The team';
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: submissionTitle(tileType, tileLabel, completed),
    description: completed
      ? `${who} finished it for **${teamName}**.`
      : `${who} made progress for **${teamName}**.`,
    color: teamColorToDecimal(teamColor),
    fields,
  };

  const boardUrl = eventId != null ? eventLeaderboardUrl(eventId) : null;
  if (boardUrl) embed.url = boardUrl;
  if (imageUrl) embed.image = { url: imageUrl };

  return sendBingoWebhook({ embeds: [embed] });
}

interface SubmissionDeletedParams {
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  creditPlayerName: string | null;
  amount: number;
  deletedBy: string;
  deletedByRole: string;
  reason: string;
  eventId?: number | null;
  tile?: IconableTile | null;
}

export async function notifySubmissionDeleted(params: SubmissionDeletedParams): Promise<boolean> {
  // teamColor is accepted for call-site symmetry but deliberately unused: a removal reads as a
  // correction, so it's always red rather than the team's colour.
  const {
    eventName,
    tileLabel,
    teamName,
    creditPlayerName,
    amount,
    deletedBy,
    deletedByRole,
    reason,
    eventId,
    tile,
  } = params;

  const fields: DiscordEmbedField[] = [
    statField('Removed', `−${amount}`),
    field('By', `${deletedBy} (${deletedByRole})`),
    field('Reason', reason, false),
  ];

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: clamp(`🗑️ Submission removed — ${tileLabel}`, LIMIT.title),
    description: creditPlayerName
      ? `A submission credited to **${creditPlayerName}** was taken off **${teamName}**'s board.`
      : `A submission was taken off **${teamName}**'s board.`,
    color: EMBED_COLOR.red,
    fields,
  };

  return sendBingoWebhook({ embeds: [embed] });
}

interface TileCompletionNotifyParams {
  eventName: string;
  tileLabel: string;
  teamName: string;
  teamColor: string;
  tileType: string;
  trackedStat?: string | null;
  statType?: string | null;
  eventId?: number | null;
  tile?: IconableTile | null;
}

export async function notifyTileCompletion(params: TileCompletionNotifyParams): Promise<boolean> {
  const {
    eventName,
    tileLabel,
    teamName,
    teamColor,
    tileType,
    trackedStat,
    statType,
    eventId,
    tile,
  } = params;

  // What kind of goal was met — kept as one short field rather than the old four-field block, since
  // the event/tile/team now live in the author line and title.
  let typeDescription = 'Tile';
  if (tileType === 'drop') {
    typeDescription = 'Drop';
  } else if (tileType === 'stat' && statType === 'xp') {
    typeDescription = `XP goal${trackedStat ? ` (${trackedStat})` : ''}`;
  } else if (tileType === 'stat' && statType === 'kc') {
    typeDescription = `KC goal${trackedStat ? ` (${trackedStat})` : ''}`;
  } else if (tileType === 'stat') {
    typeDescription = `Stat goal${trackedStat ? ` (${trackedStat})` : ''}`;
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    ...tileThumbnail(tile),
    title: clamp(`✅ Tile complete — ${tileLabel}`, LIMIT.title),
    description: `**${teamName}** cleared it.`,
    color: teamColorToDecimal(teamColor),
    fields: [statField('Type', typeDescription)],
  };

  const boardUrl = eventId != null ? eventLeaderboardUrl(eventId) : null;
  if (boardUrl) embed.url = boardUrl;

  return sendBingoWebhook({ embeds: [embed] });
}

interface TilesRevealedNotifyParams {
  eventName: string;
  tiles: { label: string; points: number | null }[];
  /** Show per-tile point values (points-scoring events only). */
  pointsMode: boolean;
  /** Hidden tiles left after this reveal — the "more to come" teaser. */
  hiddenRemaining: number;
  /** 'bounty' posts a claim-framed title. */
  bounty?: boolean;
  /** Mission announce (mid-event objective drop) — posts mission-framed wording. */
  mission?: boolean;
  /** Links the author line + title to the board. */
  eventId?: number | null;
}

// Reveal-engine post: fired once per reveal batch (scheduled due-times, interval draws, bounty
// next-tile, mission announces). One embed per batch, not per tile, so an interval batch of 5 is a
// single post.
export async function notifyTilesRevealed(params: TilesRevealedNotifyParams): Promise<boolean> {
  const { eventName, tiles, pointsMode, hiddenRemaining, bounty, mission, eventId } = params;
  if (tiles.length === 0) return false;

  const noun = mission ? 'mission' : 'tile';
  const lines = tiles
    .slice(0, 15)
    .map((t) => `• **${t.label}**${pointsMode && t.points != null ? ` — ${t.points} pts` : ''}`);
  if (tiles.length > 15) lines.push(`…and ${tiles.length - 15} more`);
  const remaining = mission
    ? '' // missions drop from their own pool; a "still hidden" count would spoil the surprise
    : hiddenRemaining > 0
      ? `\n\n${hiddenRemaining} tile${hiddenRemaining === 1 ? '' : 's'} still hidden…`
      : '';

  const title = mission
    ? tiles.length === 1
      ? '⚡ New mission is live!'
      : `⚡ ${tiles.length} new missions are live!`
    : bounty
      ? '🎯 New bounty tile is up!'
      : tiles.length === 1
        ? '🔓 New tile revealed!'
        : `🔓 ${tiles.length} new ${noun}s revealed!`;

  const boardUrl = eventId != null ? eventLeaderboardUrl(eventId) : null;
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title,
    description: clamp(`${lines.join('\n')}${remaining}`, LIMIT.description),
    color: EMBED_COLOR.gold,
    ...(boardUrl ? { url: boardUrl } : {}),
  };

  return sendBingoWebhook({ embeds: [embed] });
}

interface BountyClaimNotifyParams {
  eventName: string;
  tileLabel: string;
  points: number | null;
  /** The player who was first to finish the mission and locked it. */
  rsn: string;
  eventId?: number | null;
}

// Fired when a lock-out (bounty) mission is claimed — the first player to finish it locks everyone
// else out. Posts to the same bingo channel as the reveal announcement; the reveal engine calls it
// fire-and-forget from handleBountyClaim, once, for the completion that actually closed the tile.
export async function notifyBountyClaim(params: BountyClaimNotifyParams): Promise<boolean> {
  const { eventName, tileLabel, points, rsn, eventId } = params;
  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: clamp(`🏆 Mission claimed — ${tileLabel}`, LIMIT.title),
    description: `**${rsn}** got there first.\n🔒 Locked — nobody else can claim it.`,
    color: EMBED_COLOR.gold,
    ...(points != null ? { fields: [statField('Points', points)] } : {}),
  };
  return sendBingoWebhook({ embeds: [embed] });
}

interface TeamWithPlayers {
  name: string;
  color: string;
  players: string[];
}

interface DraftCompleteNotifyParams {
  eventName: string;
  teams: TeamWithPlayers[];
  eventId?: number | null;
}

export async function notifyDraftComplete(params: DraftCompleteNotifyParams): Promise<boolean> {
  const { eventName, teams, eventId } = params;

  // One field per team — the roster is the point of this post, so it stays a field block.
  const fields: DiscordEmbedField[] = teams.map((team) =>
    field(team.name, team.players.length ? team.players.map((p) => `• ${p}`).join('\n') : '_No players_'),
  );

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🏆 Draft complete',
    description: `Rosters are locked for **${eventName}**.`,
    color: EMBED_COLOR.gold,
    fields,
  };

  return sendBingoWebhook({ embeds: [embed] });
}

interface DraftStartNotifyParams {
  eventName: string;
  teamCount?: number;
  eventId?: number | null;
}

export async function notifyDraftStart(params: DraftStartNotifyParams): Promise<boolean> {
  const { eventName, teamCount, eventId } = params;

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🎬 Draft started',
    description: `The draft for **${eventName}** is underway — captains, make your picks!`,
    color: EMBED_COLOR.blue,
    ...(teamCount ? { fields: [statField('Teams', teamCount)] } : {}),
  };

  // Ping members so captains show up for their picks (same reach as start/finish posts).
  return sendBingoWebhook({ ...(await memberPing()), embeds: [embed] });
}

interface TeamWinNotifyParams {
  eventName: string;
  teamName: string;
  teamColor: string;
  totalTiles: number;
  eventId?: number | null;
}

export async function notifyTeamWin(params: TeamWinNotifyParams): Promise<boolean> {
  const { eventName, teamName, teamColor, totalTiles, eventId } = params;

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName, teamName),
    title: '🎉 BLACKOUT!',
    description: `**${teamName}** has completed all ${totalTiles} tiles.`,
    color: teamColorToDecimal(teamColor),
  };

  return sendBingoWebhook({ embeds: [embed] });
}

// Role pinged on event start/finish posts so the whole clan is notified. Clan-specific, so it's
// settings-driven (admin UI) with an env fallback; no role is pinged when neither is set.
const MEMBER_ROLE_KEY = 'discord_member_ping_role_id';
async function memberPingRoleId(): Promise<string | null> {
  return (await getSettingUrl(MEMBER_ROLE_KEY)) || process.env.DISCORD_MEMBER_ROLE_ID?.trim() || null;
}

// Public site origin, derived from the OAuth redirect URI (cron has no request context to read a
// host header from). Used to build deep links into the app for Discord posts. Null if unconfigured.
function siteBaseUrl(): string | null {
  const uri = process.env.DISCORD_REDIRECT_URI;
  if (!uri) return null;
  try {
    return new URL(uri).origin;
  } catch {
    return null;
  }
}

// Live standings page for an event — the public board doubles as the leaderboard.
function eventLeaderboardUrl(eventId: number): string | null {
  const base = siteBaseUrl();
  return base ? `${base}/events/${eventId}` : null;
}

// The "go look at the board" call to action, as a trailing description line rather than the old
// standalone field — a full-width field for one link pushed every post taller than it needed to be.
// Empty string when the site URL is unconfigured, so it concatenates safely.
function boardLinkLine(eventId: number): string {
  const url = eventLeaderboardUrl(eventId);
  return url ? `\n\n[View live standings →](${url})` : '';
}

// Ping the member role: explicit allowed_mentions so it notifies reliably and nothing else pings.
// Returns no content when no role is configured, so the post simply goes out without a ping.
const memberPing = async (): Promise<Pick<DiscordWebhookPayload, 'content' | 'allowed_mentions'>> => {
  const roleId = await memberPingRoleId();
  if (!roleId) return {};
  return {
    content: `<@&${roleId}>`,
    allowed_mentions: { parse: [], roles: [roleId] },
  };
};

interface EventStartHeldNotifyParams {
  eventName: string;
  /** The start the admins scheduled (reached but not honored). */
  scheduledStart: string;
  blockers: StartBlockerCode[];
}

// The start-safeguard warning (lib/eventLifecycle): the scheduled start was reached while the event
// wasn't startable, so the start is being held. Posted to the bingo channel exactly once per hold
// (startHoldNotified latch) — it's the alert that reaches admins who scheduled a start and walked
// away, and it tells members why the countdown is stalling. No member ping: it's a heads-up, not a
// celebration.
export async function notifyEventStartHeld(params: EventStartHeldNotifyParams): Promise<boolean> {
  const { eventName, scheduledStart, blockers } = params;

  const embed: DiscordEmbed = {
    author: { name: eventName },
    title: '⏸️ Start held',
    description:
      `**${eventName}** was due to start ${discordTime(scheduledStart)} but isn't ready to go live:\n` +
      blockers.map((b) => `• ${startBlockerLabel(b)}`).join('\n') +
      '\n\nThe event will start automatically once this is resolved.',
    color: EMBED_COLOR.amber,
  };

  return sendBingoWebhook({ embeds: [embed] });
}

interface EventStartNotifyParams {
  eventId: number;
  eventName: string;
  startDate: string;
  endDate?: string | null;
}

export async function notifyEventStart(params: EventStartNotifyParams): Promise<boolean> {
  const { eventId, eventName, startDate, endDate } = params;

  const fields: DiscordEmbedField[] = [field('Started', discordTime(startDate))];

  if (endDate) {
    // Exact end time + a live countdown that ticks down in everyone's client.
    fields.push(field('Ends', `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`));
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🚀 Event started',
    description: `**${eventName}** has begun. Good luck to all teams!${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.green,
    fields,
    ...(eventLeaderboardUrl(eventId) ? { url: eventLeaderboardUrl(eventId)! } : {}),
  };

  return sendBingoWebhook({ ...(await memberPing()), embeds: [embed] });
}

interface EventEndNotifyParams {
  eventId: number;
  eventName: string;
  // `tilesCompleted`/`totalTiles` carry summed point weights for points-scoring
  // events; `unit` controls the label (defaults to 'tiles').
  standings: { teamName: string; tilesCompleted: number }[];
  totalTiles: number;
  unit?: string;
  // Optional fun end-of-event "superlatives" (MVP, biggest drop, most kills, …) to celebrate in the
  // end post. Each is one pre-formatted line: emoji, award title, the winner, and their number.
  superlatives?: { emoji: string; title: string; winner: string; valueLabel: string }[];
}

export async function notifyEventForceEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventId, eventName, standings, totalTiles, unit = 'tiles' } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🛑 Event force-ended',
    description: `**${eventName}** was ended early by an admin.${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.red,
    fields: [field('Final standings', standingsText || 'No completions', false)],
  };

  // No member ping on an admin force-end (abnormal termination, not a celebratory finish).
  return sendBingoWebhook({ embeds: [embed] });
}

export async function notifyEventEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventId, eventName, standings, totalTiles, unit = 'tiles', superlatives } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const fields: DiscordEmbedField[] = [field('Final standings', standingsText || 'No completions', false)];
  if (superlatives && superlatives.length > 0) {
    const awardsText = superlatives
      .map((a) => `${a.emoji} **${a.title}** — ${a.winner} _(${a.valueLabel})_`)
      .join('\n');
    fields.push(field('🏅 Superlatives', awardsText, false));
  }

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    title: '🏁 Event ended',
    description: `**${eventName}** has concluded. Well played!${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.gold,
    fields,
  };

  return sendBingoWebhook({ ...(await memberPing()), embeds: [embed] });
}

interface PayoutNotifyParams {
  eventId: number;
  eventName: string;
  // Total gp actually paid out (sum of paid rows).
  totalPaid: number;
  // Paid recipients, grouped for display. `place` orders them (1 = winner); `amount` is gp.
  recipients: { rsn: string; teamName: string | null; place: number | null; amount: number }[];
}

// Announce the prize payouts to the bingo channel once the winners have been paid. Fired
// automatically when the last pending payout is marked paid, and re-runnable from the admin
// "Announce" button. Mirrors notifyEventEnd's medal styling.
export async function notifyPayout(params: PayoutNotifyParams): Promise<boolean> {
  const { eventId, eventName, totalPaid, recipients } = params;

  // Order by place (nulls/manual last), then by amount desc within a place.
  const ordered = [...recipients].sort(
    (a, b) => (a.place ?? 99) - (b.place ?? 99) || b.amount - a.amount,
  );
  const lines = ordered.map((r) => {
    const medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : '•';
    const team = r.teamName ? ` _(${r.teamName})_` : '';
    return `${medal} **${r.rsn}**${team} — ${r.amount.toLocaleString()} gp`;
  });

  const fields: DiscordEmbedField[] = [
    statField('Total paid out', `${totalPaid.toLocaleString()} gp`),
    field('Winners', lines.join('\n') || 'No payouts', false),
  ];

  const embed: DiscordEmbed = {
    ...eventAuthor(eventId, eventName),
    ...{ thumbnail: { url: itemIconUrl(995) } }, // coins — the payout's own icon
    title: '💰 Prizes paid out',
    description: `Congratulations to the winners of **${eventName}**. Prizes have been sent.${boardLinkLine(eventId)}`,
    color: EMBED_COLOR.gold,
    fields,
  };

  return sendBingoWebhook({ ...(await memberPing()), embeds: [embed] });
}

// ---- Weekly competitions (SOTW / BOTW) — post to the dedicated weekly webhook ----

function weeklyKind(type: string): string {
  if (type === 'efficiency') return 'Efficiency of the Week';
  return type === 'skill' ? 'Skill of the Week' : 'Boss of the Week';
}

// The competition's own icon: the skill's wiki icon for a SOTW, the boss's signature drop for a
// BOTW. Efficiency spans everything, so it gets none.
function weeklyThumbnail(type: string, metric: string): Pick<DiscordEmbed, 'thumbnail'> {
  if (type === 'skill') {
    const url = skillIconUrl(metric);
    return url ? { thumbnail: { url } } : {};
  }
  if (type === 'boss') {
    const itemId = bossItemForStatKey(metric);
    return itemId != null ? { thumbnail: { url: itemIconUrl(itemId) } } : {};
  }
  return {};
}

interface WeeklyStartParams {
  type: string;   // 'skill' | 'boss'
  title: string;
  metric: string; // e.g. 'attack', 'zulrah'
  endDate: string;
}

export async function notifyWeeklyStart(params: WeeklyStartParams): Promise<boolean> {
  const { type, title, metric, endDate } = params;
  const kind = weeklyKind(type);
  const emoji = type === 'efficiency' ? '⏱️' : type === 'skill' ? '📈' : '⚔️';

  const embed: DiscordEmbed = {
    author: { name: kind },
    ...weeklyThumbnail(type, metric),
    // Just the admin-set title — no raw metric key (e.g. "lunarChests").
    title: clamp(`${emoji} ${title}`, LIMIT.title),
    description: 'Live now. Enroll in-game with the Anvil plugin and start grinding!',
    color: EMBED_COLOR.green,
    fields: [
      // Exact end time + a live countdown that ticks down in everyone's client.
      field('Ends', `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`),
    ],
  };

  return sendWeeklyWebhook({ embeds: [embed] });
}

interface WeeklyResultsParams {
  type: string;
  title: string;
  metric: string;
  // Pre-ranked, gains floored at 0. First entry is the winner.
  standings: { rsn: string; gained: number }[];
}

// Fired when a weekly competition ends — announces the winner and the final standings (top 10).
export async function notifyWeeklyResults(params: WeeklyResultsParams): Promise<boolean> {
  const { type, title, metric, standings } = params;
  const kind = weeklyKind(type);
  const winner = standings[0];
  // Human unit, not the raw metric key. Efficiency is stored in milli-hours, so its values are
  // scaled back to hours where they're rendered below.
  const unit = type === 'efficiency' ? 'hours' : type === 'skill' ? 'XP' : 'KC';

  const fmt = (gained: number) =>
    type === 'efficiency' ? formatEfficiencyHours(gained) : gained.toLocaleString();

  const standingsText = standings
    .slice(0, 10)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.rsn}** — +${fmt(s.gained)}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    author: { name: `${kind} · results` },
    ...weeklyThumbnail(type, metric),
    title: clamp(`🏁 ${title}`, LIMIT.title),
    description: winner
      ? `🥇 **${winner.rsn}** takes it with **+${fmt(winner.gained)}** ${unit}.`
      : 'It has ended — nobody posted a gain.',
    color: EMBED_COLOR.gold,
    fields: [field('Final standings', standingsText || 'No participants', false)],
  };

  return sendWeeklyWebhook({ embeds: [embed] });
}
