'use client';

import { useState, useEffect } from 'react';

const SETTING_KEY = 'show_kill_count';

// Stored as the string 'off' when disabled; anything else (incl. empty) means on.
export default function KillCountToggle() {
  const [enabled, setEnabled] = useState(true);
  const [original, setOriginal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          const on = data[SETTING_KEY] !== 'off';
          setEnabled(on);
          setOriginal(on);
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
        body: JSON.stringify({ [SETTING_KEY]: enabled ? '' : 'off' }),
      });
      if (res.ok) {
        setOriginal(enabled);
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

  const hasChanges = enabled !== original;

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-gold"
        />
        <span className="text-sm font-medium">Show kill count on rare-drop posts</span>
      </label>
      <p className="text-xs text-text-muted">
        When on, a drop notification includes the boss/raid kill count the drop landed on (read from
        the in-game &quot;kill count is&quot; message). Turn off to hide it.
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
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {!hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
    </div>
  );
}
