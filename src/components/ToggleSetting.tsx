'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';

interface ToggleSettingProps {
  settingKey: string;
  label: string;
  helpText?: string;
  /** What an UNSET setting means. Most toggles are opt-in, so this defaults to off. */
  defaultOn?: boolean;
}

/**
 * A boolean clan setting, stored as the string 'true' / 'false'.
 *
 * Saves on toggle rather than behind a Save button: a checkbox that silently needs a second click
 * elsewhere to take effect is how people end up believing they changed something they didn't.
 */
export default function ToggleSetting({ settingKey, label, helpText, defaultOn = false }: ToggleSettingProps) {
  const [enabled, setEnabled] = useState(defaultOn);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        const raw = data[settingKey];
        setEnabled(raw === undefined || raw === '' ? defaultOn : raw === 'true' || raw === '1');
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [settingKey, defaultOn]);

  async function save(next: boolean) {
    setSaving(true);
    setMessage(null);
    const previous = enabled;
    setEnabled(next); // optimistic — reverted below if the write fails
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next ? 'true' : 'false' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      invalidateSettings();
      setMessage({ type: 'success', text: 'Saved' });
    } catch (err) {
      setEnabled(previous);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => save(e.target.checked)}
          className="h-4 w-4 accent-gold"
        />
        <span className="text-sm font-medium">{label}</span>
        {saving && <span className="text-xs text-text-muted">Saving…</span>}
        {!saving && message?.type === 'success' && <span className="text-xs text-green-400">{message.text}</span>}
      </label>
      {helpText && <p className="text-xs text-text-muted leading-snug">{helpText}</p>}
      {message?.type === 'error' && <p className="text-xs text-red-400">{message.text}</p>}
    </div>
  );
}
