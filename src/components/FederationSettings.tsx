'use client';

import { useCallback, useEffect, useState } from 'react';
import Select from '@/components/Select';
import Checkbox from '@/components/Checkbox';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';

// Federation scalars (docs/FEDERATION.md). Persisted via the generic /api/admin/settings PUT under
// the whitelisted keys below; read back through the typed helpers in lib/pluginConfig.ts. The
// outbound broker /assoc push these gate is owned by a separate (broker) track — see the TODO note.
// Master switch (WIRE §10.1) + inbound-relayed-write kill-switch (FEDERATION_SECURITY.md §3). Both
// persist through the same generic settings PUT; the getters getFederationEnabled /
// getAcceptFederatedWrites read them back. NOTE the accept-writes toggle stores the STRING 'off' (not
// '' — which the PUT would fold to NULL and the getter would then read back as the default "accept").
const KEY_ENABLED = 'federation_enabled';
const KEY_ACCEPT_WRITES = 'federation_accept_writes';
const KEY_SHARED_CREDIT = 'federation_shared_credit';
const KEY_EXCHANGE_POLICY = 'federation_exchange_policy';
const KEY_ASSOCIATION_PUSH = 'federation_association_push';
const KEY_BROKER_TRUST = 'federation_broker_trust';
// Not federation, but the same question ("what does the outside world see of this clan?"): whether
// the public /api/public/showcase serves this clan's name + aggregate counts to the "clans on Anvil"
// page. Default ON, stored as explicit 'on'/'off' — '' would be folded to NULL by the settings PUT
// and read back as the default (mirrors KEY_ACCEPT_WRITES).
const KEY_PUBLIC_SHOWCASE = 'public_showcase';

// The stored trust entries are { iss, jwksUrl }, but jwksUrl is pure convention off the server
// address — so the UI speaks "one server URL per line" and derives the rest. A rare custom keys URL
// survives round-trips as a second token on the line ("https://broker https://elsewhere/keys.json").
const JWKS_PATH = '/api/federation/v1/jwks.json';

function trustJsonToLines(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    return parsed
      .filter((b) => b && typeof b.iss === 'string')
      .map((b) => {
        const iss = b.iss.replace(/\/+$/, '');
        return b.jwksUrl === `${iss}${JWKS_PATH}` ? iss : `${iss} ${b.jwksUrl}`;
      })
      .join('\n');
  } catch {
    return raw; // mid-edit / legacy junk — surface as-is rather than losing it
  }
}

function trustLinesToJson(text: string): string {
  const entries: { iss: string; jwksUrl: string }[] = [];
  for (const line of text.split('\n')) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const iss = tokens[0].replace(/\/+$/, '');
    let issUrl: URL;
    try {
      issUrl = new URL(iss);
    } catch {
      throw new Error(`“${tokens[0]}” isn't a URL`);
    }
    if (issUrl.protocol !== 'https:') throw new Error(`“${tokens[0]}” must be https`);
    const jwksUrl = tokens[1] ?? `${iss}${JWKS_PATH}`;
    try {
      if (new URL(jwksUrl).protocol !== 'https:') throw new Error('keys URL must be https');
    } catch {
      throw new Error(`“${jwksUrl}” isn't a valid keys URL`);
    }
    entries.push({ iss, jwksUrl });
  }
  return entries.length > 0 ? JSON.stringify(entries) : '';
}

export default function FederationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [acceptWrites, setAcceptWrites] = useState(true);
  const [sharedCredit, setSharedCredit] = useState('accept');
  const [exchangePolicy, setExchangePolicy] = useState('auto-guest');
  const [associationPush, setAssociationPush] = useState(false);
  const [brokerTrust, setBrokerTrust] = useState('');
  const [publicShowcase, setPublicShowcase] = useState(true);
  // finding #4: three-state load status. Editable fields default to `enabled=false` etc., so a TRANSIENT
  // load failure must NOT let a Save go through — it would PUT `federation_enabled=false` clan-wide and
  // force-write `accept_writes:'on'` from values that were never actually loaded. We render an error
  // state (not the form) on failure and disable Save until a successful load populates every field.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const s = await loadSettings();
      setEnabled(s[KEY_ENABLED] === 'on');
      // Default ON: only an explicit 'off' opts out (mirrors getAcceptFederatedWrites).
      setAcceptWrites(s[KEY_ACCEPT_WRITES] !== 'off');
      setSharedCredit(s[KEY_SHARED_CREDIT] === 'exclusive' ? 'exclusive' : 'accept');
      setExchangePolicy(
        s[KEY_EXCHANGE_POLICY] === 'request-to-join' || s[KEY_EXCHANGE_POLICY] === 'reject'
          ? s[KEY_EXCHANGE_POLICY]
          : 'auto-guest',
      );
      setAssociationPush(s[KEY_ASSOCIATION_PUSH] === 'on');
      // Default ON: only an explicit 'off' opts out (mirrors getPublicShowcase).
      setPublicShowcase(s[KEY_PUBLIC_SHOWCASE] !== 'off');
      // Present the stored JSON as friendly one-server-per-line text.
      const raw = s[KEY_BROKER_TRUST];
      if (raw) setBrokerTrust(trustJsonToLines(raw));
      setStatus('ready');
    } catch {
      // Never fall through to editable defaults — that's the silent-disable bug (finding #4).
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    // Guard: never Save from a not-yet-loaded / failed fetch — the fields don't reflect real settings.
    if (status !== 'ready') return;
    setSaving(true);
    setMessage(null);

    // Convert the friendly one-server-per-line text back to the stored JSON; validate so a typo'd
    // URL warns the admin instead of being silently dropped by the reader.
    let brokerTrustValue = '';
    try {
      brokerTrustValue = trustLinesToJson(brokerTrust);
    } catch (e) {
      setMessage({ type: 'err', text: `Identity servers: ${e instanceof Error ? e.message : 'invalid entry'}` });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [KEY_ENABLED]: enabled ? 'on' : '',
          // Persist 'on'/'off' explicitly (never '') so the off state survives the PUT's null-folding.
          [KEY_ACCEPT_WRITES]: acceptWrites ? 'on' : 'off',
          [KEY_SHARED_CREDIT]: sharedCredit,
          [KEY_EXCHANGE_POLICY]: exchangePolicy,
          [KEY_ASSOCIATION_PUSH]: associationPush ? 'on' : '',
          [KEY_BROKER_TRUST]: brokerTrustValue,
          // Explicit 'on'/'off' so the opt-out survives the PUT's null-folding.
          [KEY_PUBLIC_SHOWCASE]: publicShowcase ? 'on' : 'off',
        }),
      });
      if (res.ok) {
        invalidateSettings();
        setMessage({ type: 'ok', text: 'Saved.' });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'err', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'err', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <div className="text-text-muted text-sm">Loading settings…</div>;

  // finding #4: on a load failure, show an error + Retry — NEVER the editable form (whose defaults would
  // let a Save silently disable federation clan-wide).
  if (status === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400">
          Couldn&apos;t load federation settings. Editing is disabled until they load, so a save
          can&apos;t overwrite them with defaults.
        </p>
        <button
          onClick={load}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-yellow-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Friendly summary of the trusted servers — hostnames only; the raw editor stays available for
  // self-hosters pointing at a different broker.
  //
  // `brokerTrust` holds the LINE form ("<iss> [jwksUrl]" per line, via jsonToTrustLines), not the
  // stored JSON. Parsing it as JSON threw on every valid value, leaving trustedHosts empty — which
  // made a correctly-connected clan permanently display "Not finished connecting — no identity
  // server is trusted yet" while the right URL sat in the box underneath it. Read the same shape the
  // textarea holds and the save path consumes.
  const trustedHosts: string[] = brokerTrust
    .split('\n')
    .map((line) => line.trim().split(/\s+/).filter(Boolean)[0])
    .filter((token): token is string => !!token)
    .map((token) => {
      try {
        return new URL(token).hostname;
      } catch {
        return null; // mid-edit, or junk the save will reject with a clearer message
      }
    })
    .filter((h): h is string => !!h);

  return (
    <div className="space-y-5">
      <div>
        <Checkbox
          checked={enabled}
          onChange={setEnabled}
          label="Connect to the Anvil network"
          description="Join the shared Anvil network: members who also play in other connected clans see all their clans in one plugin, and progress can count across them."
        />
        {!enabled && (
          <p className="text-xs text-text-muted mt-2 ml-6">
            Your clan is fully private — nothing is shared. Turn this on to choose how connecting
            works; turning it back off leaves the network again.
          </p>
        )}
      </div>

      {/* Outside the `enabled` gate on purpose: being counted on the public Anvil page has nothing to
          do with joining the network, and a clan that stays private should still be able to say
          "yes, you can list us". */}
      <div className="border-t border-card-border pt-4">
        <Checkbox
          checked={publicShowcase}
          onChange={setPublicShowcase}
          label="Let Anvil list this clan publicly"
          description="Shows this clan on the “clans on Anvil” page at anvilosrs.com — clan name, when you started, and totals like members, events run and tiles completed. Never any player names, drops or board details."
        />
      </div>

      {enabled && (
        <>
          <div className="border-t border-card-border pt-4">
            <Checkbox
              checked={associationPush}
              onChange={setAssociationPush}
              label="Make this clan easy to find"
              description="Members' plugins list this clan automatically, with no setup. The only thing shared is “this Discord account belongs here” — never boards or game data."
            />
          </div>

          <div className="border-t border-card-border pt-4">
            <Checkbox
              checked={acceptWrites}
              onChange={setAcceptWrites}
              label="Count progress earned in other clans"
              description="If a member gets a drop while playing another connected clan's event, it can count on your board too (it's still checked against your own tiles and rules first). Turn off to watch other clans without ever taking credit from them."
            />
          </div>

          {acceptWrites && (
            <div className="border-t border-card-border pt-4">
              <label className="block text-sm font-medium mb-1">…even when the same drop also counts elsewhere?</label>
              <p className="text-xs text-text-muted mb-2">
                Say a member has the same tile live on your board and another clan&apos;s, and the drop lands
                once: should one drop be allowed to complete both?
              </p>
              <Select
                value={sharedCredit}
                onChange={setSharedCredit}
                ariaLabel="Accept drops that also count for another clan"
                options={[
                  { value: 'accept', label: 'Yes — a shared drop counts here as well (default)' },
                  { value: 'exclusive', label: 'No — only count drops that are ours alone' },
                ]}
              />
            </div>
          )}

          <div className="border-t border-card-border pt-4">
            <label className="block text-sm font-medium mb-1">When someone from another clan visits</label>
            <p className="text-xs text-text-muted mb-2">
              A player from a connected clan who isn&apos;t a member here.
            </p>
            <Select
              value={exchangePolicy}
              onChange={setExchangePolicy}
              ariaLabel="When someone from another clan visits"
              options={[
                { value: 'auto-guest', label: 'They can look around, read-only (default)' },
                { value: 'request-to-join', label: 'They wait in a queue until you approve them' },
                { value: 'reject', label: 'They can’t get in at all' },
              ]}
            />
          </div>

          {/* An empty trust list while connected means no other clan can reach this one: their
              relayed /exchange is refused, so this clan never appears in anyone's plugin. It happens
              when the one-shot registration at join time failed. Saying so plainly beats hiding it
              behind "Advanced", and saving now re-runs the registration that repairs it. */}
          {trustedHosts.length === 0 && (
            <div className="border-t border-card-border pt-4">
              <p className="text-sm text-yellow-400">
                Not finished connecting — no identity server is trusted yet.
              </p>
              <p className="text-xs text-text-muted mt-1">
                Until this completes, other clans can&apos;t connect to yours and this clan won&apos;t show up
                in members&apos; plugins. Press <span className="text-foreground/80">Save</span> to try again. If
                it keeps failing, the site can&apos;t reach the Anvil network — check the server logs for
                <span className="font-mono"> federation.register</span>.
              </p>
            </div>
          )}

          <div className="border-t border-card-border pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              {showAdvanced ? '▾' : '▸'} Advanced
              {!showAdvanced && (
                <span className="ml-2 text-xs">
                  {trustedHosts.length > 0
                    ? `identity confirmed by ${trustedHosts.join(', ')}`
                    : 'no identity server trusted'}
                </span>
              )}
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Trusted identity servers</label>
                <p className="text-xs text-text-muted mb-2">
                  Who this clan trusts to vouch for a visiting member&apos;s Discord identity. Filled in
                  automatically when you connect — only self-hosters using a different broker ever edit
                  this. Leave blank to trust none.
                </p>
                <textarea
                  value={brokerTrust}
                  onChange={(e) => setBrokerTrust(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder={'[\n  { "iss": "https://anvilosrs.com", "jwksUrl": "https://anvilosrs.com/api/federation/v1/jwks.json" }\n]'}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm font-mono"
                />
              </div>
            )}
          </div>
        </>
      )}

      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-accent-green-light' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}

      <div>
        <button
          onClick={handleSave}
          disabled={saving || status !== 'ready'}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-yellow-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
