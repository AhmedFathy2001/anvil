'use client';

import { useEffect, useState } from 'react';
import type { TierBand } from '@/lib/tileFilter';
import Input from '@/components/Input';

// Admin editor for the difficulty-tier bands (points → tier). Backed by /api/admin/tier-bands.
// Rows are { label, min }; the key is derived server-side from the label. The lowest band must
// start at 0 so every tile lands in a tier. Members/plugin pick up changes on their next fetch.

interface Row {
  label: string;
  min: string; // kept as a string for the input; parsed on save
}

export default function TierBandsSetting() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function load(bands: TierBand[]) {
    setRows(
      [...bands]
        .sort((a, b) => a.min - b.min)
        .map((b) => ({ label: b.label, min: String(b.min) })),
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tier-bands');
        if (res.ok) {
          const data = await res.json();
          load(Array.isArray(data.bands) ? data.bands : []);
        }
      } catch (e) {
        console.error('Failed to load tier bands:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { label: '', min: '' }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const bands = rows
      .map((r) => ({ label: r.label.trim(), min: Number(r.min) }))
      .filter((b) => b.label && Number.isFinite(b.min));
    try {
      const res = await fetch('/api/admin/tier-bands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bands }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        load(data.bands ?? bands);
        setMessage({ type: 'success', text: 'Saved! Members pick this up on their next login.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/tier-bands', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        load(Array.isArray(data.bands) ? data.bands : []);
        setMessage({ type: 'success', text: 'Reset to the default bands.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to reset' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading tier bands...</div>;
  }

  // Sorted preview of each band's effective range, so admins see where tiles will fall.
  const sorted = [...rows]
    .map((r) => ({ label: r.label.trim(), min: Number(r.min) }))
    .filter((b) => b.label && Number.isFinite(b.min))
    .sort((a, b) => a.min - b.min);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_120px_32px] gap-2 text-xs text-text-muted px-1">
          <span>Tier name</span>
          <span>Min points</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
            <Input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(i, { label: e.target.value })}
              placeholder="e.g. Hard"
              className="px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
            />
            <Input
              type="number"
              min={0}
              value={row.min}
              onChange={(e) => updateRow(i, { min: e.target.value })}
              placeholder="0"
              className="px-3 py-2 bg-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
            />
            <button
              onClick={() => removeRow(i)}
              aria-label="Remove tier"
              className="w-8 h-8 grid place-items-center rounded-lg border border-card-border text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={addRow}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
        >
          + Add tier
        </button>
      </div>

      <p className="text-xs text-text-muted">
        A tile&apos;s tier is the highest band whose min it meets. The lowest band <strong>must</strong>{' '}
        start at <code>0</code> so every tile lands in a tier; the top band is uncapped.
      </p>

      {sorted.length > 0 && (
        <div className="text-xs text-text-muted border border-card-border rounded-lg p-3 bg-bg/40 space-y-0.5">
          <div className="font-medium text-text mb-1">Preview</div>
          {sorted.map((b, i) => {
            const next = sorted[i + 1];
            const range = next ? `${b.min}–${next.min - 1}` : `${b.min}+`;
            return (
              <div key={i} className="flex justify-between">
                <span className="text-gold">{b.label}</span>
                <span>{range} pts</span>
              </div>
            );
          })}
        </div>
      )}

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
          disabled={saving || rows.length === 0}
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 border border-card-border text-text-muted font-medium rounded-lg text-sm hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
