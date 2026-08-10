'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';

// The event name shown as the page header on every event tab. Admins can rename in place
// (PATCH /api/events/[id] { name }); everyone else sees a plain heading. Non-admins never
// reach the edit affordance — matches the admin-only PATCH guard on the API.
export default function EventTitle({
  eventId,
  initialName,
  canEdit,
}: {
  eventId: number;
  initialName: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync when the server value changes under us (router.refresh, navigation between tabs).
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!canEdit) {
    return <h1 className="text-2xl sm:text-3xl font-bold text-gold">{name}</h1>;
  }

  function startEditing() {
    setDraft(name);
    setError('');
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Name can’t be empty.');
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setName(updated.name);
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not rename the event.');
      }
    } catch {
      setError('Could not rename the event.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
              }
            }}
            maxLength={100}
            disabled={saving}
            className="text-xl sm:text-2xl font-bold text-gold max-w-md"
          />
          <button
            onClick={() => void save()}
            disabled={saving}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title="Rename event"
      className="group inline-flex items-center gap-2 text-left"
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-gold">{name}</h1>
      <span
        aria-hidden
        className="text-text-muted text-base opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✎
      </span>
    </button>
  );
}
