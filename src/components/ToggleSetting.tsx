'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

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
      {/* The save state rides in the label: this toggle writes immediately, so "Saving…" belongs
          beside the thing being saved rather than somewhere else on the page. */}
      <Checkbox
        checked={enabled}
        disabled={saving}
        onChange={save}
        label={
          <>
            {label}
            {saving && <span className="ml-2 text-xs font-normal text-text-muted">Saving…</span>}
            {!saving && message?.type === 'success' && (
              <span className="ml-2 text-xs font-normal text-green-400">{message.text}</span>
            )}
          </>
        }
      />
      {helpText && <p className="text-xs text-text-muted leading-snug">{helpText}</p>}
      {message?.type === 'error' && <p className="text-xs text-red-400">{message.text}</p>}
    </div>
  );
}
