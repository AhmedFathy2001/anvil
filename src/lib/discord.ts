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

  const title =
    tileType === 'timed' ? '⏱️ New Timed Clear Submitted!'
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

const BINGO_ROLE_ID = '1466184936934609008';

interface EventStartNotifyParams {
  eventName: string;
  startDate: string;
  endDate?: string | null;
}

export async function notifyEventStart(params: EventStartNotifyParams): Promise<boolean> {
  const { eventName, startDate, endDate } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Started', value: new Date(startDate).toLocaleString(), inline: true },
  ];

  if (endDate) {
    fields.push({ name: 'Ends', value: new Date(endDate).toLocaleString(), inline: true });
  }

  const embed: DiscordEmbed = {
    title: '🚀 Bingo Event Started!',
    description: `**${eventName}** has begun! Good luck to all teams!\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0x00ff00, // Green
    fields,
    timestamp: new Date().toISOString(),
  };

  // Tag bingo role
  return sendBingoWebhook({ content: `<@&${BINGO_ROLE_ID}>`, embeds: [embed] });
}

interface EventEndNotifyParams {
  eventName: string;
  // `tilesCompleted`/`totalTiles` carry summed point weights for points-scoring
  // events; `unit` controls the label (defaults to 'tiles').
  standings: { teamName: string; tilesCompleted: number }[];
  totalTiles: number;
  unit?: string;
}

export async function notifyEventForceEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventName, standings, totalTiles, unit = 'tiles' } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    title: '🛑 Bingo Event Force-Ended!',
    description: `**${eventName}** has been force-ended by an admin.\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xff0000, // Red
    fields: [
      { name: 'Final Standings', value: standingsText || 'No completions', inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ embeds: [embed] });
}

export async function notifyEventEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventName, standings, totalTiles, unit = 'tiles' } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} ${unit}`;
    })
    .join('\n');

  const embed: DiscordEmbed = {
    title: '🏁 Bingo Event Ended!',
    description: `**${eventName}** has concluded!\n━━━━━━━━━━━━━━━━━━━━`,
    color: 0xffd700, // Gold
    fields: [
      { name: 'Final Standings', value: standingsText || 'No completions', inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  return sendBingoWebhook({ embeds: [embed] });
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
      { name: 'Ends', value: new Date(endDate).toLocaleString(), inline: true },
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
