'use client';

import { useEffect, useState } from 'react';
import PluginPlayerTokenClient from './PluginPlayerTokenClient';
import LinkAccountClient from './LinkAccountClient';
import IgnoredAccountsClient from './IgnoredAccountsClient';
import RenameRequestClient from './RenameRequestClient';
import ConnectedPluginsClient from './ConnectedPluginsClient';

// Everything that used to BE this page: the token, the manual linking paths, the accounts you told
// us weren't yours, and name changes. None of it is gone — it's just no longer what a member sees
// first, because none of it is what they came for after the first day.
//
// It opens itself when something links here (the connect card's "link by name instead", the player
// card's "manage token"), because a collapsed drawer scrolled into view is a dead end.
const HASH = '#account-security';

export default function SecurityDrawer({
  accounts,
  ignored,
  federationEnabled,
  defaultOpen,
}: {
  accounts: { id: number; rsn: string }[];
  ignored: { id: number; rsn: string; lastSeenAt: string }[];
  federationEnabled: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === HASH) setOpen(true);
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    // A second click on the same anchor changes no hash and fires no event, so catch the click too.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.('a[href$="#account-security"]');
      if (link) setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', openIfTargeted);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <details
      id="account-security"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group border border-card-border rounded-xl bg-card-bg mt-5"
    >
      <summary className="cursor-pointer select-none list-none px-5 py-4 flex items-center gap-2.5 font-semibold">
        <span className="transition-transform group-open:rotate-90 text-text-muted" aria-hidden>
          ▸
        </span>
        Account &amp; security
        <span className="font-normal text-xs text-text-muted">token, linking, name changes</span>
      </summary>

      <div className="px-5 pb-5 grid gap-5">
        <div>
          <div className="font-semibold text-sm">Plugin token</div>
          <PluginPlayerTokenClient />
        </div>

        <div className="h-px bg-card-border" />

        <div>
          <div className="font-semibold text-sm">Not using RuneLite?</div>
          <p className="text-xs text-text-muted mt-0.5 mb-3 max-w-[70ch]">
            On mobile or the official client, link by name: gain a little XP and we&rsquo;ll confirm it from
            the hiscores, or ask a moderator to check it by hand.
          </p>
          <LinkAccountClient />
        </div>

        {accounts.length > 0 && (
          <>
            <div className="h-px bg-card-border" />
            <RenameRequestClient accounts={accounts} />
          </>
        )}

        {ignored.length > 0 && (
          <>
            <div className="h-px bg-card-border" />
            <IgnoredAccountsClient initial={ignored} />
          </>
        )}

        {/* Federation-only: cross-clan tokens minted for the broker sign-in flow. Until this clan
            turns federation on the plugin has nowhere to use them, so it isn't shown at all. */}
        {federationEnabled && <ConnectedPluginsClient />}
      </div>
    </details>
  );
}
