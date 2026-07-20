'use client';

import { useEffect, useState } from 'react';
import RoleSelect from '@/components/RoleSelect';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';

interface RoleSettingProps {
  settingKey: string;
  label: string;
  helpText?: string;
  noneLabel?: string;
}

// A single role setting backed by the settings table, picked from a role dropdown. Auto-saves on
// change — a lone dropdown doesn't need a separate Save button.
export default function RoleSetting({ settingKey, label, helpText, noneLabel }: RoleSettingProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        setValue(data[settingKey] || '');
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [settingKey]);

  async function change(next: string) {
    setValue(next);
    setStatus('saving');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next }),
      });
      if (res.ok) {
        invalidateSettings();
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <RoleSelect
        value={value}
        onChange={change}
        noneLabel={noneLabel ?? 'No role'}
        ariaLabel={label}
        className="max-w-sm"
      />
      <div className="flex items-center gap-2 mt-1">
        {helpText && <p className="text-xs text-text-muted">{helpText}</p>}
        {status === 'saving' && <span className="text-xs text-text-muted shrink-0">Saving…</span>}
        {status === 'saved' && <span className="text-xs text-green-400 shrink-0">Saved</span>}
        {status === 'error' && <span className="text-xs text-red-400 shrink-0">Failed to save</span>}
      </div>
    </div>
  );
}
