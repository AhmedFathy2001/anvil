'use client';

import { useEffect, useState } from 'react';

import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

/**
 * What the clan is called — on the site, and in the game.
 *
 * This lived on the ROSTER, behind an "Edit clan settings" toggle above the member table. Two names
 * that change about once a year sat on top of the list read every day, and — since People and Clan
 * became separate hubs — it was clan-entity configuration filed under the people in it. The Profile
 * tab is where the clan describes itself, so it is where this belongs.
 */
export default function ClanNameSettings() {
  // Two INDEPENDENT values. `clanName` is the display name (site, plugin, Discord posts);
  // `inGameClanName` is the exact OSRS clan name the roster sync must report.
  const [clanName, setClanName] = useState('');
  const [inGameClanName, setInGameClanName] = useState('');
  const [clanNameOriginal, setClanNameOriginal] = useState('');
  const [inGameNameOriginal, setInGameNameOriginal] = useState('');
  // Whether anyone has proved this clan IS the in-game clan it names. An unverified clan cannot sync
  // its roster, and finding that out from a 403 in the plugin is a poor way to learn it.
  const [verification, setVerification] = useState<
    { verified: boolean; verifiedAt: string | null; inGameName: string | null } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    clanFetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!alive || !s) return;
        setClanName(s.clan_name ?? '');
        setInGameClanName(s.clan_ingame_name ?? '');
        setClanNameOriginal(s.clan_name ?? '');
        setInGameNameOriginal(s.clan_ingame_name ?? '');
        setVerification(s._verification ?? null);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await clanFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clan_name: clanName, clan_ingame_name: inGameClanName }),
    });
    if (res.ok) {
      setClanNameOriginal(clanName);
      setInGameNameOriginal(inGameClanName);
      setMessage({ type: 'ok', text: 'Saved.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: 'err', text: data.error || 'Failed to save' });
    }
    setSaving(false);
  }

  if (!loaded) return null;

  return (
    <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Name
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        Your display name and your in-game clan name can differ — the site shows one, the plugin
        matches the other.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Display name</label>
          <Input
            type="text"
            value={clanName}
            onChange={(e) => {
              setClanName(e.target.value);
              setMessage(null);
            }}
            placeholder="e.g. The Golden Arrows"
            className="w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-text-muted">
            What the site, the plugin and Discord posts call your clan.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-muted">In-game clan name</label>
          <Input
            type="text"
            value={inGameClanName}
            onChange={(e) => {
              setInGameClanName(e.target.value);
              setMessage(null);
            }}
            placeholder="e.g. Golden Arrows CC"
            className="w-full rounded border border-card-border bg-brown-dark px-3 py-2 text-sm"
          />
          {verification && (
            <p className={`mt-1 text-[11px] ${verification.verified ? 'text-accent-green-light' : 'text-yellow-400'}`}>
              {verification.verified ? (
                <>✓ Verified as &ldquo;{verification.inGameName}&rdquo; in game.</>
              ) : (
                <>
                  {/* Any rank: lib/clanVerification dropped the owner-tier rule, and this line
                      still asking for Owner or Deputy Owner turned away admins setting a clan up. */}
                  Not verified yet: this clan can&apos;t load its member list until it is. With the
                  Anvil RuneLite plugin signed in, open your clan window in OSRS and press the{' '}
                  <strong>Anvil</strong> button in its title bar. Any rank works, as long as you are
                  in the clan, and it only has to happen once.{' '}
                  <ClanLink href="/admin/setup" className="underline">
                    Step-by-step
                  </ClanLink>
                </>
              )}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            The plugin&apos;s roster-sync payload must match this exactly.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={saving || (clanName === clanNameOriginal && inGameClanName === inGameNameOriginal)}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-yellow-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'ok' ? 'text-accent-green-light' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
