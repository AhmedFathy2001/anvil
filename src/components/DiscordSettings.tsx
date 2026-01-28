'use client';

import { useState, useEffect } from 'react';

export default function DiscordSettings() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.discord_webhook_url || '');
        setOriginalUrl(data.discord_webhook_url || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_webhook_url: webhookUrl }),
      });
      if (res.ok) {
        setOriginalUrl(webhookUrl);
        setMessage({ type: 'success', text: 'Settings saved!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!webhookUrl) {
      setMessage({ type: 'error', text: 'Please enter a webhook URL first' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', webhook_url: webhookUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Test message sent!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send test message' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send test message' });
    } finally {
      setTesting(false);
    }
  }

  const hasChanges = webhookUrl !== originalUrl;

  if (loading) {
    return (
      <div className="text-text-muted text-sm">Loading settings...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="webhook-url" className="block text-sm font-medium mb-2">
          Discord Webhook URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="w-full px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
        />
        <p className="text-xs text-text-muted mt-1">
          Get a webhook URL from your Discord server settings → Integrations → Webhooks
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

      <div className="flex gap-2 items-center">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !webhookUrl}
          className="px-4 py-2 bg-card-bg-hover border border-card-border text-text font-semibold rounded-lg text-sm hover:border-gold/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing...' : 'Test Webhook'}
        </button>
        {originalUrl && !hasChanges && (
          <span className="text-xs text-green-400">Saved</span>
        )}
        {hasChanges && webhookUrl && (
          <span className="text-xs text-yellow-400">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
