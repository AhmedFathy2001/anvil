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

export default function FederationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [acceptWrites, setAcceptWrites] = useState(true);
  const [sharedCredit, setSharedCredit] = useState('accept');
  const [exchangePolicy, setExchangePolicy] = useState('auto-guest');
  const [associationPush, setAssociationPush] = useState(false);
  const [brokerTrust, setBrokerTrust] = useState('');
  // finding #4: three-state load status. Editable fields default to `enabled=false` etc., so a TRANSIENT
  // load failure must NOT let a Save go through — it would PUT `federation_enabled=false` clan-wide and
  // force-write `accept_writes:'on'` from values that were never actually loaded. We render an error
  // state (not the form) on failure and disable Save until a successful load populates every field.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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
      // Pretty-print stored JSON if present, else leave blank.
      const raw = s[KEY_BROKER_TRUST];
      if (raw) {
        try {
          setBrokerTrust(JSON.stringify(JSON.parse(raw), null, 2));
        } catch {
          setBrokerTrust(raw);
        }
      }
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

    // Validate broker trust JSON before sending (stored verbatim; malformed JSON would just be
    // dropped by the reader, so warn the admin instead of silently discarding it).
    let brokerTrustValue = '';
    const trimmed = brokerTrust.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) throw new Error('must be an array');
        for (const b of parsed) {
          if (!b || typeof b.iss !== 'string' || typeof b.jwksUrl !== 'string') {
            throw new Error('each entry needs { iss, jwksUrl }');
          }
        }
        brokerTrustValue = JSON.stringify(parsed);
      } catch (e) {
        setMessage({ type: 'err', text: `Broker trust: ${e instanceof Error ? e.message : 'invalid JSON'}` });
        setSaving(false);
        return;
      }
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

  return (
    <div className="space-y-5">
      <div>
        <Checkbox
          checked={enabled}
          onChange={setEnabled}
          label="Connect to the Anvil network"
          description="The main switch. On: your clan joins the network — members who also play in other connected clans see those clans in the plugin, and their drops can count across them. Off: everything stays private to this clan and nothing is shared."
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="block text-sm font-medium mb-1">Counting drops from other clans</label>
        <p className="text-xs text-text-muted mb-2">
          If a member is doing the same boss for two connected clans at once, should the drop count for
          your clan too?
        </p>
        <Select
          value={sharedCredit}
          onChange={setSharedCredit}
          ariaLabel="Counting drops from other clans"
          options={[
            { value: 'accept', label: 'Always count it (default)' },
            { value: 'exclusive', label: 'Skip it if it already counts for another clan' },
          ]}
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <Checkbox
          checked={acceptWrites}
          onChange={setAcceptWrites}
          label="Accept completions relayed from other clans"
          description="When another connected clan tells us a member completed something, count it toward your board too (we still re-check it against your own tiles, proof and thresholds). Turn this off to watch other clans without ever taking credit from them. On by default."
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="block text-sm font-medium mb-1">Visitors from other clans</label>
        <p className="text-xs text-text-muted mb-2">
          What to do when someone from another connected clan — not a member here — shows up. (Only
          applies once member linking is turned on.)
        </p>
        <Select
          value={exchangePolicy}
          onChange={setExchangePolicy}
          ariaLabel="Visitors from other clans"
          options={[
            { value: 'auto-guest', label: 'Let them view, read-only (default)' },
            { value: 'request-to-join', label: 'Add them to a queue for you to approve' },
            { value: 'reject', label: 'Keep them out' },
          ]}
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <Checkbox
          checked={associationPush}
          onChange={setAssociationPush}
          label="Let members' plugins find this clan automatically"
          description="Tells the network that a member belongs here, so their plugin can list your clan for them without setup. Only their Discord account and your clan are shared — never board or game data. Off by default."
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="block text-sm font-medium mb-1">
          Trusted identity servers <span className="text-text-muted font-normal">(advanced)</span>
        </label>
        <p className="text-xs text-text-muted mb-2">
          The servers this clan trusts to confirm who a member is. You normally don&apos;t touch this —
          it&apos;s filled in automatically when you connect. Leave blank to trust none.
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
