'use client';

import { useState, useEffect } from 'react';

const SETTING_KEY = 'always_notify_items';

// Baked into the plugin already — shown here so admins know they don't need to re-add them.
const BAKED_IN = [
  'Infernal cape',
  "Dizana's quiver",
  'Ancient blood ornament kit',
  'Sanguine ornament kit',
  'Holy ornament kit',
  'Sanguine dust',
  'Radiant sigil',
];

export default function AlwaysNotifyItems() {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          setValue(data[SETTING_KEY] || '');
          setOriginal(data[SETTING_KEY] || '');
        }
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
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [SETTING_KEY]: value }),
      });
      if (res.ok) {
        setOriginal(value);
        setMessage({ type: 'success', text: 'Saved! Members pick this up on their next login.' });
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

  const hasChanges = value !== original;

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="always-notify-items" className="block text-sm font-medium mb-2">
          Extra always-notify items
        </label>
        <textarea
          id="always-notify-items"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          placeholder={"One item name per line, e.g.\nTumeken's ornament kit\nVoidwaker"}
          className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm font-mono focus:outline-none focus:border-gold"
        />
        <p className="text-xs text-text-muted mt-1">
          One item name per line. Matching is case-insensitive and partial, so &quot;ornament kit&quot;
          matches every kit. These are <em>added to</em> the plugin&apos;s built-in list — no need to
          repeat the items below.
        </p>
      </div>

      <div className="text-xs text-text-muted">
        <span className="font-medium text-text">Built-in (always on):</span>{' '}
        {BAKED_IN.join(', ')}
      </div>

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
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {original && !hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
    </div>
  );
}
