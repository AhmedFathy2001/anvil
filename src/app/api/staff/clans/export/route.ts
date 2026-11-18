import { requirePlatformApi } from '@/lib/platformAccess';
import { clansWithHealth } from '@/lib/clanHealthDb';
import { csvResponse, toCsv } from '@/lib/csv';
import { operatorEmail } from '@/lib/staffSight';

export const dynamic = 'force-dynamic';

/**
 * Every clan as a spreadsheet, with how it is doing (lib/clanHealth). The same rows as /staff/clans;
 * the owner's email is whole for the top platform role only, as on the page (lib/staffSight).
 */
export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const { clans, health } = await clansWithHealth();
  return csvResponse(
    `anvil-clans-${new Date().toISOString().slice(0, 10)}`,
    toCsv(
      ['Clan id', 'Name', 'Address', 'Status', 'Plan', 'Billing', 'Health', 'Why', 'Flags', 'Members', 'Guests', 'Boards', 'Running now', 'On the plugin 7d', 'Last active', 'Created', 'Owner', 'Owner Discord', 'Owner email'],
      clans.map((c) => {
        const h = health[c.id];
        return [
          c.id,
          c.name,
          c.host,
          c.status,
          c.plan || 'free',
          h?.billing ?? '',
          h?.label ?? '',
          h?.reason ?? '',
          h?.flags.join(' ') ?? '',
          c.members,
          c.guests,
          c.events,
          h?.running ?? 0,
          h?.plugin7d ?? 0,
          h?.lastActiveAt ?? '',
          c.createdAt,
          c.owner,
          c.ownerDiscordUsername,
          operatorEmail(gate.actor.role, c.ownerEmail),
        ];
      }),
    ),
  );
}
