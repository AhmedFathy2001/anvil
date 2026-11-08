'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

const SETTING_KEY = 'drop_default_mode';

// The clan's default for how its members' two drop thresholds combine. Stored as 'and' for "both";
// blank means either one is enough.
export default function DropModeToggle() {
  const [both, setBoth] = useState(false);
  const [original, setOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const on = (await loadSettings())[SETTING_KEY] === 'and';
        setBoth(on);
        setOriginal(on);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [SETTING_KEY]: both ? 'and' : '' }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal(both);
        setMessage({ type: 'success', text: 'Saved! Members pick this up within about a minute.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = both !== original;
  if (loading) return <div className="text-text-muted text-sm">Loading settings...</div>;

  return (
    <div className="space-y-4">
      <Checkbox checked={both} onChange={setBoth} label="Require both: worth the minimum value and rarer than the rarity" className="text-sm font-medium" />
      <p className="text-xs text-text-muted">
        Off (the default): a drop posts when it is worth at least the value <strong>or</strong> rarer than the rarity.
        On: it must be worth at least the value <strong>and</strong> rarer than the rarity. Members follow this
        until they choose for themselves; a threshold that is switched off isn&apos;t required.
      </p>
      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {!hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
    </div>
  );
}
