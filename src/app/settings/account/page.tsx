import ClanLink from '@/components/ClanLink';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { pluginLinks, users } from '@/db/schema';
import { clansOfPerson } from '@/lib/myClans';
import SignOutEverywhereClient from '@/app/profile/SignOutEverywhereClient';
import { ActionButton } from '../_client';
import { SettingsBlock, SettingsGroup, SettingsRow, SettingsTitle } from '../_ui';
import { settingsSession } from '@/app/settings/settingsSession';

function day(stamp: string | null): string {
  if (!stamp) return 'never';
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? 'unknown' : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default async function AccountSettingsPage() {
  const session = await settingsSession();
  const [user, links, clans] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db
      .select({ id: pluginLinks.id, createdAt: pluginLinks.createdAt, lastUsedAt: pluginLinks.lastUsedAt })
      .from(pluginLinks)
      .where(and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)))
      .orderBy(desc(pluginLinks.createdAt)),
    clansOfPerson(session.playerId, session.userId),
  ]);
  const ownsAClan = clans.some((c) => c.role === 'owner');

  return (
    <>
      <SettingsTitle title="Login & devices">
        Signed in with Discord as <b className="text-foreground">{user?.discordUsername ?? user?.displayName}</b>. Discord is the only way in, so
        there is no password to change.
      </SettingsTitle>

      <SettingsGroup
        title="Plugin sign-ins"
        id="plugin-sign-ins"
        note="Your main plugin token is on Plugin connection. These are extra sign-ins made with “Sign in with Discord” from the panel."
      >
        {links.length === 0 && <SettingsRow label="No extra sign-ins" description="Only your plugin token is in use." />}
        {links.map((l, i) => (
          <SettingsRow
            key={l.id}
            label={`RuneLite sign-in ${links.length - i}`}
            description={`Created ${day(l.createdAt)} · last used ${day(l.lastUsedAt)}`}
          >
            <ActionButton
              url={`/api/auth/my-plugin-tokens?id=${l.id}`}
              method="DELETE"
              tone="danger"
              confirm={{
                title: 'Revoke this sign-in?',
                body: 'The plugin using it is signed out and has to sign in again.',
                confirmLabel: 'Revoke',
              }}
            >
              Revoke
            </ActionButton>
          </SettingsRow>
        ))}
        <SettingsRow
          label="Link another computer"
          description="In RuneLite, press “Sign in with Discord” in the Anvil panel. It shows a code and opens this page; if the page didn’t open, enter the code here."
        >
          <ClanLink href="/link-device" className="rounded-lg border border-card-border bg-card-bg-hover px-3 py-1.5 text-[13px] hover:border-gold/40">
            Enter a code
          </ClanLink>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Sessions" id="sessions">
        <SettingsBlock>
          <SignOutEverywhereClient />
        </SettingsBlock>
      </SettingsGroup>

      {/* Only for clan owners: subscriptions are per hosted clan, and a player never pays for one. */}
      {ownsAClan && (
        <SettingsGroup title="Clan billing" id="clan-billing">
          <SettingsRow label="Billing & your clan plan" description="Subscription, invoices and the tier each clan you host is on.">
            <ClanLink href="/portal" className="rounded-lg border border-card-border bg-card-bg-hover px-3 py-1.5 text-[13px] hover:border-gold/40">
              Open portal →
            </ClanLink>
          </SettingsRow>
        </SettingsGroup>
      )}
    </>
  );
}
