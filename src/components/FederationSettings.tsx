'use client';

import { useEffect, useState } from 'react';
import Select from '@/components/Select';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';

// Federation scalars (docs/FEDERATION.md). Persisted via the generic /api/admin/settings PUT under
// the whitelisted keys below; read back through the typed helpers in lib/pluginConfig.ts. The
// outbound broker /assoc push these gate is owned by a separate (broker) track — see the TODO note.
const KEY_SHARED_CREDIT = 'federation_shared_credit';
const KEY_EXCHANGE_POLICY = 'federation_exchange_policy';
const KEY_ASSOCIATION_PUSH = 'federation_association_push';
const KEY_BROKER_TRUST = 'federation_broker_trust';

export default function FederationSettings() {
  const [sharedCredit, setSharedCredit] = useState('accept');
  const [exchangePolicy, setExchangePolicy] = useState('auto-guest');
  const [associationPush, setAssociationPush] = useState(false);
  const [brokerTrust, setBrokerTrust] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSettings();
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
      } catch {
        /* ignore — fields keep their defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
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

  if (loading) return <div className="text-text-muted text-sm">Loading settings…</div>;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1">Cross-clan crediting</label>
        <p className="text-xs text-text-muted mb-2">
          When a member plays in several connected clans at once, does a drop count here too?{' '}
          <span className="text-foreground/80">Accept</span> credits regardless;{' '}
          <span className="text-foreground/80">Exclusive</span> declines an event the player is
          simultaneously crediting elsewhere.
        </p>
        <Select
          value={sharedCredit}
          onChange={setSharedCredit}
          ariaLabel="Cross-clan crediting"
          options={[
            { value: 'accept', label: 'Accept — credit regardless (default)' },
            { value: 'exclusive', label: 'Exclusive — skip if credited elsewhere' },
          ]}
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="block text-sm font-medium mb-1">Guest-on-exchange policy</label>
        <p className="text-xs text-text-muted mb-2">
          What happens when a broker vouches for a Discord identity that isn&apos;t a member yet.{' '}
          <span className="text-foreground/80">Auto-guest</span> connects them read-only (never
          auto-placed on a team); <span className="text-foreground/80">Request to join</span> queues
          them; <span className="text-foreground/80">Reject</span> refuses. Only takes effect once
          identity federation (L2) is enabled.
        </p>
        <Select
          value={exchangePolicy}
          onChange={setExchangePolicy}
          ariaLabel="Guest-on-exchange policy"
          options={[
            { value: 'auto-guest', label: 'Auto-guest — connect read-only (default)' },
            { value: 'request-to-join', label: 'Request to join — queue for approval' },
            { value: 'reject', label: 'Reject — refuse non-members' },
          ]}
        />
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={associationPush}
            onChange={(e) => setAssociationPush(e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          <span className="text-sm font-medium">Association push</span>
        </label>
        <p className="text-xs text-text-muted mt-1">
          Tells the broker &ldquo;this Discord id is a member here&rdquo; so the plugin can
          auto-populate the member&apos;s clan list. Carries only the (discord_id, instanceId) pair —
          never board or game data. Default off for self-hosted (sovereignty). The outbound call is a
          separate track; this flag stores the preference.
        </p>
      </div>

      <div className="border-t border-card-border pt-4">
        <label className="block text-sm font-medium mb-1">Trusted brokers</label>
        <p className="text-xs text-text-muted mb-2">
          Brokers whose identity assertions this instance will accept at L2, as a JSON array of{' '}
          <code className="text-foreground/80">{'{ "iss": "...", "jwksUrl": "..." }'}</code>. Leave
          blank to trust none (identity federation disabled). Normally set by the broker at
          registration.
        </p>
        <textarea
          value={brokerTrust}
          onChange={(e) => setBrokerTrust(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={'[\n  { "iss": "https://admin.anvil.gg", "jwksUrl": "https://admin.anvil.gg/api/federation/v1/jwks.json" }\n]'}
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
          disabled={saving}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-yellow-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
