'use client';

import { useState, useEffect } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { DISCORD_LOCALES } from '@/lib/discordI18n';

/**
 * Which language the bot answers in.
 *
 * The default — blank, "follow the member" — is the right answer for nearly every clan: Discord
 * tells us each member's own client language on every interaction, so a Danish member gets Danish
 * and the Norwegian next to them gets Norwegian, with nothing to configure.
 *
 * The override exists for the two cases detection can't cover. Discord has no Arabic client
 * language, so an Arabic-speaking clan's members all report English and would never otherwise
 * reach the Arabic translation. And a server that would rather have one voice than fifteen can say
 * so. Either way it's a deliberate choice, which is why it isn't the default.
 */
export default function DiscordLanguageSetting() {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        setValue(data.discord_language || '');
        setOriginal(data.discord_language || '');
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
        body: JSON.stringify({ discord_language: value }),
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
  const chosen = DISCORD_LOCALES.find((l) => l.code === value);

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="setting-discord_language" className="block text-sm font-medium mb-2">
          Bot language
        </label>
        <select
          id="setting-discord_language"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
        >
          <option value="">Follow each member (recommended)</option>
          {DISCORD_LOCALES.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.label} — {locale.english}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted mt-1">
          Left alone, the bot replies in whatever language each member has their own Discord set to, and
          falls back to English for anything it doesn&apos;t speak. Pick a language to make every answer use
          it instead.
        </p>
        {chosen && chosen.discord.length === 0 && (
          <p className="text-xs text-gold mt-1">
            Discord has no {chosen.english} client language, so this is the only way members can get{' '}
            {chosen.english} answers.
          </p>
        )}
        {chosen && !chosen.reviewed && (
          <p className="text-xs text-text-muted mt-1">
            The {chosen.english} translation hasn&apos;t been checked by a native speaker yet.{' '}
            <a href="/feedback" className="text-gold hover:text-gold-light">
              Tell us
            </a>{' '}
            if a line reads wrong.
          </p>
        )}
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
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>
    </div>
  );
}
