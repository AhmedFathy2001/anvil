'use client';

import { useState, useEffect } from 'react';
import Input from '@/components/Input';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';

interface PlainSettingProps {
  // Which settings key this field reads/writes (must be whitelisted in /api/admin/settings).
  settingKey: string;
  label: string;
  placeholder?: string;
  helpText?: string;
}

// A single labelled text setting backed by the settings table — no webhook create/test, unlike
// WebhookField. Used for plain values like the Discord invite URL or a role ID.
export default function PlainSetting({ settingKey, label, placeholder, helpText }: PlainSettingProps) {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        setValue(data[settingKey] || '');
        setOriginal(data[settingKey] || '');
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [settingKey]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: value }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal(value);
        setMessage({ type: 'success', text: 'Saved!' });
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

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`setting-${settingKey}`} className="block text-sm font-medium mb-2">
          {label}
        </label>
        <Input
          id={`setting-${settingKey}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
        />
        {helpText && <p className="text-xs text-text-muted mt-1">{helpText}</p>}
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
          {saving ? 'Saving…' : 'Save'}
        </button>
        {original && !hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
    </div>
  );
}
