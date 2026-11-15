'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import Select from '@/components/Select';

interface TierSettingProps {
  settingKey: string;
  label: string;
  helpText: string;
  /** The tiers to offer, loosest first. '' (the first option) clears the setting: Anvil's default. */
  options: { value: string; label: string }[];
}

// A clan's default tier for one kind of post (combat tasks, quests, diaries), stored as a settings
// key. Members follow it until they pick their own in /settings (lib/notifyPrefs tierGates).
export default function TierSetting({ settingKey, label, helpText, options }: TierSettingProps) {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = ((await loadSettings())[settingKey] ?? '').trim().toUpperCase();
        const known = options.some((o) => o.value === stored) ? stored : '';
        setValue(known);
        setOriginal(known);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
    // The option list is fixed per use; only the key decides what to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey]);

  async function save(next: string) {
    setValue(next);
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal(next);
        setMessage({ type: 'success', text: 'Saved. Members pick this up within about a minute.' });
      } else {
        const data = await res.json().catch(() => ({}));
        setValue(original);
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setValue(original);
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted text-sm">Loading settings...</div>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Select value={value} onChange={(v) => void save(v)} options={options} disabled={saving} ariaLabel={label} className="w-56 shrink-0" />
      </div>
      <p className="text-xs text-text-muted">{helpText}</p>
      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>{message.text}</p>
      )}
    </div>
  );
}
