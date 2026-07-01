import { db } from '@/db';
import { settings, events, tiles } from '@/db/schema';
import { count, inArray } from 'drizzle-orm';

// The four "zero-to-first-bingo" milestones a fresh clan needs to hit. Step status is
// always computed live from real data (settings + counts) so the dashboard checklist and
// the wizard's Done screen can never disagree or go stale. The `setup_completed` flag is
// only advisory — it decides whether we auto-open the wizard / show the card, never
// whether a step is "done".

export interface SetupStep {
  key: 'clan' | 'discord' | 'event' | 'tiles';
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export interface SetupStatus {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  /** The owner finished or dismissed the wizard at least once. */
  dismissed: boolean;
  /** Brand-new clan: no clan name, no webhook, never dismissed — safe to auto-open once. */
  isFresh: boolean;
  /** Prefill values for the wizard, so it opens showing whatever is already set. */
  values: {
    clanName: string;
    inviteUrl: string;
    webhookUrl: string;
    rareDrops: string;
    deaths: string;
  };
}

const WANTED_KEYS = [
  'clan_name',
  'discord_webhook_url',
  'discord_invite_url',
  'webhook_rare_drops',
  'webhook_deaths',
  'setup_completed',
];

export async function getSetupStatus(): Promise<SetupStatus> {
  const rows = await db.select().from(settings).where(inArray(settings.key, WANTED_KEYS));
  const map = new Map(rows.map((r) => [r.key, r.value || '']));
  const get = (k: string) => map.get(k) || '';

  const clanName = get('clan_name');
  const webhookUrl = get('discord_webhook_url');
  const dismissed = !!get('setup_completed');

  const [[ec], [tc]] = await Promise.all([
    db.select({ c: count() }).from(events),
    db.select({ c: count() }).from(tiles),
  ]);
  const eventsCount = ec?.c ?? 0;
  const tilesCount = tc?.c ?? 0;

  const steps: SetupStep[] = [
    {
      key: 'clan',
      label: 'Name your clan',
      hint: 'What shows up across the site and in Discord posts.',
      done: !!clanName,
      href: '/admin/setup',
    },
    {
      key: 'discord',
      label: 'Connect Discord',
      hint: 'Let Anvil post event announcements to your server.',
      done: !!webhookUrl,
      href: '/admin/setup',
    },
    {
      key: 'event',
      label: 'Create your first event',
      hint: 'Spin up a bingo board, Leagues board, or tile race.',
      done: eventsCount > 0,
      href: '/admin/events/new',
    },
    {
      key: 'tiles',
      label: 'Add tiles to a board',
      hint: 'Fill your board with the tasks players will chase.',
      done: tilesCount > 0,
      href: '/admin/events',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allDone: completedCount === steps.length,
    dismissed,
    isFresh: !clanName && !webhookUrl && !dismissed,
    values: {
      clanName,
      inviteUrl: get('discord_invite_url'),
      webhookUrl,
      rareDrops: get('webhook_rare_drops'),
      deaths: get('webhook_deaths'),
    },
  };
}
