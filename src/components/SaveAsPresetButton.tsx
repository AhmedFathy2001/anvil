'use client';

import { useState } from 'react';
import Input from '@/components/Input';

// Capture the current event (shape + tiles) as a reusable template that shows up in the
// create gallery. Admin-only surface; the API re-checks the role.
export default function SaveAsPresetButton({
  eventId,
  defaultName,
}: {
  eventId: number;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/save-preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg({ type: 'err', text: data.error || 'Could not save template.' });
        return;
      }
      setMsg({ type: 'ok', text: 'Saved! It will appear as a template when creating an event.' });
      setOpen(false);
    } catch {
      setMsg({ type: 'err', text: 'Could not save template.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-card-border pt-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:border-gold hover:text-gold transition-colors"
        >
          ⭐ Save this event as a template
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 max-w-lg">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="flex-1 min-w-[12rem]"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="text-sm px-3 py-2 rounded-lg bg-gold hover:bg-gold-light text-brown-dark font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save template'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm px-3 py-2 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      <p className="text-xs text-text-muted mt-2">
        Captures this event&apos;s type, size and every tile so you can spin up an identical board in one click.
      </p>
      {msg && (
        <p className={`text-sm mt-2 ${msg.type === 'ok' ? 'text-accent-green-light' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
