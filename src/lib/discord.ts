import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

async function getWebhookUrl(): Promise<string | null> {
  try {
    const setting = await db.query.settings.findFirst({
      where: eq(settings.key, 'discord_webhook_url'),
    });
    if (!setting?.value) {
      console.log('[Discord] No webhook URL configured');
    }
    return setting?.value || null;
  } catch (error) {
    console.error('[Discord] Failed to fetch webhook URL from database:', error);
    return null;
  }
}

export async function sendDiscordWebhook(payload: DiscordWebhookPayload): Promise<boolean> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    console.log('[Discord] Skipping webhook - no URL configured');
    return false;
  }

  try {
    console.log('[Discord] Sending webhook...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error('[Discord] Webhook failed with status:', response.status, await response.text());
    } else {
      console.log('[Discord] Webhook sent successfully');
    }
    return response.ok;
  } catch (error) {
    console.error('[Discord] Failed to send webhook:', error);
    return false;
  }
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
  } = params;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Event', value: eventName, inline: true },
    { name: 'Tile', value: tileLabel, inline: true },
    { name: 'Team', value: teamName, inline: true },
  ];

  if (creditPlayerName) {
    fields.push({ name: 'Player', value: creditPlayerName, inline: true });
  }

  if (requiredAmount) {
    fields.push({
      name: 'Progress',
      value: `${amount} submitted (${currentTotal}/${requiredAmount} total)`,
      inline: true
    });
  }

  if (note) {
    fields.push({ name: 'Note', value: note, inline: false });
  }

  const embed: DiscordEmbed = {
    title: '🎯 New Drop Submitted!',
    description: '━━━━━━━━━━━━━━━━━━━━',
    color: teamColorToDecimal(teamColor),
    fields,
    timestamp: new Date().toISOString(),
  };

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  return sendDiscordWebhook({ embeds: [embed] });
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

  return sendDiscordWebhook({ embeds: [embed] });
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

  return sendDiscordWebhook({ embeds: [embed] });
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

  return sendDiscordWebhook({ embeds: [embed] });
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

  // Tag @everyone for team win
  return sendDiscordWebhook({ content: '@everyone', embeds: [embed] });
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
  return sendDiscordWebhook({ content: `<@&${BINGO_ROLE_ID}>`, embeds: [embed] });
}

interface EventEndNotifyParams {
  eventName: string;
  standings: { teamName: string; tilesCompleted: number }[];
  totalTiles: number;
}

export async function notifyEventEnd(params: EventEndNotifyParams): Promise<boolean> {
  const { eventName, standings, totalTiles } = params;

  const standingsText = standings
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${s.teamName}** - ${s.tilesCompleted}/${totalTiles} tiles`;
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

  // Tag @everyone for event end
  return sendDiscordWebhook({ content: '@everyone', embeds: [embed] });
}
