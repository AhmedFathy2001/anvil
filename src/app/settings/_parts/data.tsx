import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { sessionIssuedAt } from '@/lib/auth';
import { clanPathOf } from '@/lib/clanScopedPaths';
import { eraseFactsFor } from '@/lib/erasePerson';
import { eraseBlockers, recentSessionUntil } from '@/lib/personData';
import { SITE } from '@/lib/site';
import { settingsSession } from '@/app/settings/settingsSession';
import DeleteAccountClient, { type DeleteBlockerView } from '../DeleteAccountClient';
import { BTN } from '../_client';
import { SettingsBlock, SettingsGroup, SettingsRow } from '../_ui';

/**
 * Your data: download everything Anvil holds about you, or delete the account (lib/exportPerson,
 * lib/erasePerson). What stops a deletion is worked out here, on the server, so the page can say so
 * before anything is asked; POST /api/profile/delete-account checks all of it again.
 */
export async function DataGroups() {
  const session = await settingsSession();
  const [facts, issued, user] = await Promise.all([
    eraseFactsFor(session.userId),
    sessionIssuedAt(),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, session.userId)).limit(1),
  ]);
  const viewingAsSomeoneElse = !!session.labViewAs || !!session.actingAs;
  const recentUntil = issued && issued.userId === session.userId ? recentSessionUntil(issued.issuedAtMs) : null;

  const blockers: DeleteBlockerView[] = (facts ? eraseBlockers(facts) : []).map((b) => {
    if (b.kind === 'owns-clan') {
      return {
        message: b.message,
        links: [
          ...b.clans.map((c) => ({ href: clanPathOf(c, '/admin/people/staff'), label: `Hand over ${c.name}`, external: false })),
          { href: SITE.supportDiscord, label: 'Ask Anvil to delete it', external: true },
        ],
      };
    }
    if (b.kind === 'active-plan') {
      return {
        message: b.message,
        links: [{ href: `https://gumroad.com/subscriptions/${encodeURIComponent(b.subscriptionId)}/manage`, label: 'Cancel on Gumroad', external: true }],
      };
    }
    return { message: b.message, links: [{ href: SITE.supportDiscord, label: 'Contact Anvil', external: true }] };
  });

  return (
    <>
      <SettingsGroup title="Download" id="download-my-data">
        <SettingsRow
          label="Download my data"
          description="One file with everything Anvil holds about you: your account, characters, clans and roles, event entries and results, the proofs you sent (as links), your settings, plugin sign-ins and Supporter status. Up to three times a day."
        >
          {/* clan-prefix: platform — the file is the person's, not any clan's. A plain link, so the browser saves it. */}
          <a href="/api/profile/data-export" download className={BTN}>
            Download
          </a>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Delete account" id="delete-account">
        <SettingsBlock>
          <div className="text-[14px] font-medium">Delete my account</div>
          <div className="mt-2 grid gap-3 text-[13px] text-text-muted sm:grid-cols-2">
            <div>
              <div className="mb-1 font-medium text-foreground">Removed for good</div>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Your login, email, and Discord name and picture</li>
                <li>Your link to your characters, and what your plugin synced for them</li>
                <li>Every plugin sign-in and linked computer</li>
                <li>Linked streaming accounts</li>
                <li>Supporter look, profile pictures and banners</li>
                <li>Your settings, saved goals and inbox</li>
                <li>Staff roles you hold in clans</li>
              </ul>
            </div>
            <div>
              <div className="mb-1 font-medium text-foreground">Stays with your clans</div>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Your in-game name on their rosters, as a name nobody has claimed</li>
                <li>Your event entries, completed tiles, standings and payouts</li>
                <li>Proof screenshots that are part of a clan&rsquo;s event</li>
              </ul>
              <p className="mt-1.5">
                This is each clan&rsquo;s own event history. It stays under your in-game name and no longer points at you. A ban that
                is still in force keeps working: Anvil keeps your Discord ID with it, and a clan&rsquo;s own note about why, and
                nothing else about you.
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-text-muted">This cannot be undone. Signing in again later starts a new, empty account.</p>

          <div className="mt-4">
            <DeleteAccountClient
              displayName={user[0]?.displayName ?? ''}
              blockers={blockers}
              recentUntil={recentUntil}
              disabledReason={viewingAsSomeoneElse ? 'Not available while you are viewing or acting as someone else.' : null}
            />
          </div>
        </SettingsBlock>
      </SettingsGroup>
    </>
  );
}
