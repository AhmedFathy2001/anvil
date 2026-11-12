'use client';

import { useEffect, useState } from 'react';
import ClanLink from '@/components/ClanLink';
import NewPluginToken from '@/components/NewPluginToken';

/**
 * The fallback for when in-plugin sign-in doesn't work: an Account Token, made right here in the
 * guide, ready to paste into the Anvil panel. (There is no Site URL any more — the plugin always talks
 * to anvilosrs.com.)
 *
 * Tokens are stored only as hashes, so this cannot show "your" token — it makes a new one for this
 * client, shown once. It never appears in the public guide's server HTML.
 */
export default function PluginSetupValues({ tokenLabel }: { tokenLabel: string }) {
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/profile/plugin-token', { cache: 'no-store' })
      .then((response) => alive && setSignedOut(response.status === 401))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="my-5 rounded-xl border border-gold/30 bg-gold/[0.04] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gold/80">
        Your token
      </div>

      <div>
        {loading ? (
          <p className="text-sm text-text-muted">Checking whether you&rsquo;re signed in…</p>
        ) : signedOut ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-text-muted">Sign in with Discord to make a token here.</span>
            <ClanLink
              href="/settings/in-game#plugin"
              className="rounded-lg bg-gold px-3 py-2 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Sign in
            </ClanLink>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">{tokenLabel}</div>
            <NewPluginToken />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Treat the token like a password.{' '}
        <ClanLink href="/settings/in-game#plugin" className="text-gold hover:text-gold-light">
          Open token settings
        </ClanLink>{' '}
        to sign every client out if one leaks.
      </p>
    </div>
  );
}
