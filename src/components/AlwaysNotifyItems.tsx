'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import Textarea from '@/components/Textarea';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { clanFetch } from '@/lib/clanFetch';
import {
  ALWAYS_NOTIFY_LEGACY_KEY,
  ALWAYS_NOTIFY_LIST_KEY,
  DEFAULT_ALWAYS_NOTIFY,
  effectiveAlwaysNotify,
  parseItemLines,
  storedAlwaysNotify,
} from '@/lib/alwaysNotify';

// The clan's whole always-post list, defaults included, so admins can remove an item as well as add one.
const DEFAULTS_TEXT = DEFAULT_ALWAYS_NOTIFY.join('\n');
const same = (a: string, b: string) => parseItemLines(a).join('\n').toLowerCase() === parseItemLines(b).join('\n').toLowerCase();

export default function AlwaysNotifyItems() {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        const text = effectiveAlwaysNotify(data[ALWAYS_NOTIFY_LIST_KEY], data[ALWAYS_NOTIFY_LEGACY_KEY]).join('\n');
        setValue(text);
        setOriginal(text);
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
      // The full list replaces the old extras, which are cleared so nothing is counted twice.
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [ALWAYS_NOTIFY_LIST_KEY]: storedAlwaysNotify(value), [ALWAYS_NOTIFY_LEGACY_KEY]: null }),
      });
      if (res.ok) {
        invalidateSettings();
        const saved = parseItemLines(value).join('\n');
        setValue(saved);
        setOriginal(saved);
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

  const hasChanges = !same(value, original);
  useUnsavedChanges(hasChanges);
  const isDefault = same(value, DEFAULTS_TEXT);

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="always-notify-items" className="block text-sm font-medium mb-2">
          Items that always post
        </label>
        <Textarea
          id="always-notify-items"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={10}
          placeholder={"One item name per line, e.g.\nTumeken's ornament kit\nVoidwaker"}
          className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm font-mono focus:outline-none focus:border-gold"
        />
        <p className="text-xs text-text-muted mt-1">
          One item name per line. Matching is case-insensitive and partial, so &quot;ornament kit&quot; matches every
          kit. The list starts with Anvil&apos;s defaults: remove any you don&apos;t want posted, or add your own. Leave it
          empty and nothing posts on this list alone.
        </p>
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

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setValue(DEFAULTS_TEXT)}
          disabled={saving || isDefault}
          className="px-4 py-2 border border-card-border rounded-lg text-sm text-text-muted hover:text-text hover:border-gold/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset to defaults
        </button>
        <UnsavedIndicator dirty={hasChanges} />
      </div>
    </div>
  );
}
