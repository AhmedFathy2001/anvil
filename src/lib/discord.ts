import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { log } from '@/lib/logger';

interface DiscordEmbed {
  title: string;
  description: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  image?: { url: string };
  timestamp?: string;
}

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

async function getSettingUrl(key: string): Promise<string | null> {
  try {
    const setting = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    return setting?.value || null;
  } catch (error) {
    log.warn('discord.db-read-fail', { key }, error);
    return null;
  }
}

const MAX_RETRY_MS = 5000;

async function postWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<Response> {
  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  // attachment:// reference. sendToWebhook is JSON-only, so this path posts directly.
  try {
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content: content || undefined, embeds, allowed_mentions }));
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

// General / plugin-updates channel — clan-roster sync summaries and other non-event posts.
export async function sendDiscordWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await getSettingUrl(GENERAL_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

// Bingo-event channel; falls back to the general webhook when no dedicated bingo webhook is set so
// existing single-webhook clans keep getting bingo posts until they split the channel.
export async function sendBingoWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = (await getSettingUrl(BINGO_WEBHOOK_KEY)) || (await getSettingUrl(GENERAL_WEBHOOK_KEY));
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

// Dedicated weekly-competition webhook (no fallback — weekly posts simply don't fire when unset
// rather than spilling into another channel).
export async function sendWeeklyWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await getSettingUrl(WEEKLY_WEBHOOK_KEY);
  if (!webhookUrl) return false;
  return sendToWebhook(webhookUrl, payload);
}

export async function sendTestWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ Webhook Test Successful!',
          description: 'Your Discord webhook is configured correctly.',
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send test webhook:', error);
    return false;
  }
}

// Color hex to decimal (Discord uses decimal colors)
function teamColorToDecimal(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  return parseInt(hex, 16) || 0x5865f2; // Default to Discord blurple
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
}

function formatClearTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Event', value: eventName, inline: true },
    { name: 'Tile', value: tileLabel, inline: true },
    { name: 'Team', value: teamName, inline: true },
  ];

  if (creditPlayerName) {
    fields.push({ name: 'Player', value: creditPlayerName, inline: true });
  }

  if (tileType === 'timed' && durationSeconds != null) {
    fields.push({ name: 'Clear Time', value: formatClearTime(durationSeconds), inline: true });
  } else if (tileType === 'kill') {
    fields.push({
      name: 'Kills',
      value: requiredAmount ? `${amount} submitted (${currentTotal}/${requiredAmount} total)` : `${amount} submitted`,
      inline: true,
    });
  } else if (requiredAmount) {
    fields.push({
      name: 'Progress',
      value: `${amount} submitted (${currentTotal}/${requiredAmount} total)`,
      inline: true
    });
  }

  if (note) {
    fields.push({ name: 'Note', value: note, inline: false });
  }

  if (completed) {
    fields.push({ name: '​', value: '✅ **This completed the tile!**', inline: false });
  }

  const title = completed
    ? '✅ Tile Completed!'
    : tileType === 'timed' ? '⏱️ New Timed Clear Submitted!'
    : tileType === 'kill' ? '⚔️ New Kill Submitted!'
    : '🎯 New Drop Submitted!';

  const embed: DiscordEmbed = {
    title,
    description: '━━━━━━━━━━━━━━━━━━━━',
    color: teamColorToDecimal(teamColor),
    fields,
    timestamp: new Date().toISOString(),
  };

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

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
}

export async function notifySubmissionDeleted(params: SubmissionDeletedParams): Promise<boolean> {
  const {
    eventName,
    tileLabel,
    teamName,
    teamColor,
    creditPlayerName,
    amount,
    deletedBy,
    deletedByRole,
    reason,
  } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Event', value: eventName, inline: true },
    { name: 'Tile', value: tileLabel, inline: true },
    { name: 'Team', value: teamName, inline: true },
  ];

  if (creditPlayerName) {
    fields.push({ name: 'Player', value: creditPlayerName, inline: true });
  }

  fields.push({ name: 'Amount Removed', value: `x${amount}`, inline: true });
  fields.push({ name: 'Deleted By', value: `${deletedBy} (${deletedByRole})`, inline: true });
  fields.push({ name: 'Reason', value: reason, inline: false });

  const embed: DiscordEmbed = {
    title: '🗑️ Submission Deleted',
    description: '━━━━━━━━━━━━━━━━━━━━',
    color: teamColorToDecimal(teamColor),
    fields,
    timestamp: new Date().toISOString(),
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
  } = params;

  let typeDescription = 'Standard tile';
  if (tileType === 'drop') {
    typeDescription = 'Drop tile';
  } else if (tileType === 'stat' && statType === 'xp') {
    typeDescription = `XP goal${trackedStat ? ` (${trackedStat})` : ''}`;
  } else if (tileType === 'stat' && statType === 'kc') {
    typeDescription = `KC goal${trackedStat ? ` (${trackedStat})` : ''}`;
  } else if (tileType === 'stat') {
    typeDescription = `Stat goal${trackedStat ? ` (${trackedStat})` : ''}`;
  }

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Event', value: eventName, inline: true },
    { name: 'Tile', value: tileLabel, inline: true },
    { name: 'Team', value: teamName, inline: true },
    { name: 'Type', value: typeDescription, inline: true },
  ];

  const embed: DiscordEmbed = {
    title: '✅ Tile Completed!',
    description: '━━━━━━━━━━━━━━━━━━━━',
    color: teamColorToDecimal(teamColor),
    fields,
    timestamp: new Date().toISOString(),
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
}

export async function notifyDraftComplete(params: DraftCompleteNotifyParams): Promise<boolean> {
  const { eventName, teams } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  for (const team of teams) {
    const playerList = team.players.length > 0
      ? team.players.map(p => `• ${p}`).join('\n')
      : '• No players';
    fields.push({
      name: team.name,
      value: playerList,
      inline: true,
    });
  }

  const embed: DiscordEmbed = {
    title: '🏆 Draft Complete!',
    description: `**${eventName}**\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xffd700, // Gold
    fields,
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ embeds: [embed] });
}

interface TeamWinNotifyParams {
  eventName: string;
  teamName: string;
  teamColor: string;
  totalTiles: number;
}

export async function notifyTeamWin(params: TeamWinNotifyParams): Promise<boolean> {
  const { eventName, teamName, teamColor, totalTiles } = params;

  const embed: DiscordEmbed = {
    title: '🎉 BLACKOUT! 🎉',
    description: `**${teamName}** has completed all ${totalTiles} tiles!\n━━━━━━━━━━━━━━━━━━━━`,
    color: teamColorToDecimal(teamColor),
    fields: [
      { name: 'Event', value: eventName, inline: true },
      { name: 'Winner', value: teamName, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ embeds: [embed] });
}

// Role pinged on event start/finish posts. The member role so the whole clan is notified.
const MEMBER_ROLE_ID = '1441294849369309274';

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

// A clickable "Leaderboard" field, appended when the site URL is known. Mutates `fields`.
function pushLeaderboardField(fields: { name: string; value: string; inline?: boolean }[], eventId: number) {
  const url = eventLeaderboardUrl(eventId);
  if (url) fields.push({ name: 'Leaderboard', value: `[View live standings →](${url})`, inline: false });
}

// Ping the member role: explicit allowed_mentions so it notifies reliably and nothing else pings.
const memberPing = (): Pick<DiscordWebhookPayload, 'content' | 'allowed_mentions'> => ({
  content: `<@&${MEMBER_ROLE_ID}>`,
  allowed_mentions: { parse: [], roles: [MEMBER_ROLE_ID] },
});

interface EventStartNotifyParams {
  eventId: number;
  eventName: string;
  startDate: string;
  endDate?: string | null;
}

export async function notifyEventStart(params: EventStartNotifyParams): Promise<boolean> {
  const { eventId, eventName, startDate, endDate } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Started', value: discordTime(startDate), inline: true },
  ];

  if (endDate) {
    // Exact end time + a live countdown that ticks down in everyone's client.
    fields.push({ name: 'Ends', value: `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`, inline: true });
  }

  pushLeaderboardField(fields, eventId);

  const embed: DiscordEmbed = {
    title: '🚀 Bingo Event Started!',
    description: `**${eventName}** has begun! Good luck to all teams!\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0x00ff00, // Green
    fields,
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ ...memberPing(), embeds: [embed] });
}

interface EventEndNotifyParams {
  eventId: number;
  eventName: string;
  // `tilesCompleted`/`totalTiles` carry summed point weights for points-scoring
  // events; `unit` controls the label (defaults to 'tiles').
  standings: { teamName: string; tilesCompleted: number }[];
  totalTiles: number;
  unit?: string;
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

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Final Standings', value: standingsText || 'No completions', inline: false },
  ];
  pushLeaderboardField(fields, eventId);

  const embed: DiscordEmbed = {
    title: '🛑 Bingo Event Force-Ended!',
    description: `**${eventName}** has been force-ended by an admin.\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xff0000, // Red
    fields,
    timestamp: new Date().toISOString(),
  };

  // No member ping on an admin force-end (abnormal termination, not a celebratory finish).
  return sendBingoWebhook({ embeds: [embed] });
}

export async function notifyEventEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventId, eventName, standings, totalTiles, unit = 'tiles' } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Final Standings', value: standingsText || 'No completions', inline: false },
  ];
  pushLeaderboardField(fields, eventId);

  const embed: DiscordEmbed = {
    title: '🏁 Bingo Event Ended!',
    description: `**${eventName}** has concluded!\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xffd700, // Gold
    fields,
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ ...memberPing(), embeds: [embed] });
}

// ---- Weekly competitions (SOTW / BOTW) — post to the dedicated weekly webhook ----

function weeklyKind(type: string): string {
  return type === 'skill' ? 'Skill of the Week' : 'Boss of the Week';
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
  const emoji = type === 'skill' ? '📈' : '⚔️';

  const embed: DiscordEmbed = {
    title: `${emoji} ${kind} has started!`,
    description: `**${title}** is live — tracking **${metric}**.\nEnroll in-game with the Anvil plugin and start grinding!\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0x00ff00, // Green
    fields: [
      { name: 'Metric', value: metric, inline: true },
      // Exact end time + a live countdown that ticks down in everyone's client.
      { name: 'Ends', value: `${discordTime(endDate)}\n${discordTime(endDate, 'R')}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
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

  const standingsText = standings
    .slice(0, 10)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.rsn}** — +${s.gained.toLocaleString()}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    title: `🏁 ${kind} Results — ${title}`,
    description: winner
      ? `🥇 **${winner.rsn}** wins with **+${winner.gained.toLocaleString()}** ${metric}!\n━━━━━━━━━━━━━━━━━━━━`
      : `**${title}** has ended.\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xffd700, // Gold
    fields: [
      { name: 'Final Standings', value: standingsText || 'No participants', inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  return sendWeeklyWebhook({ embeds: [embed] });
}
