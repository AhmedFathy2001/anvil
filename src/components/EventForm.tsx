'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TILE_CSV_COLUMNS, parseTileCsv, type TileCsvRow } from '@/lib/csvTiles';
import { EVENT_MODES as MODES, type EventMode as Mode } from '@/lib/eventModes';

export default function EventForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('classic');
  const [size, setSize] = useState(5);
  const [csv, setCsv] = useState<{ rows: TileCsvRow[]; labels: string[]; fileName: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = MODES.find((m) => m.key === mode)!;

  function changeMode(next: Mode) {
    const m = MODES.find((x) => x.key === next)!;
    setMode(next);
    setSize(m.default);
    setCsv(null); // tile count semantics differ per mode; re-import if needed
    setError('');
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const parsed = parseTileCsv(text);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      const count = parsed.labels.length;
      if (meta.square) {
        const n = Math.sqrt(count);
        if (!Number.isInteger(n)) {
          setError(`Classic bingo needs a square number of rows (4, 9, 16, 25…). Your CSV has ${count}.`);
          return;
        }
        setSize(n);
      } else {
        if (count < meta.min || count > meta.max) {
          setError(`${meta.label} supports ${meta.min}–${meta.max} tiles. Your CSV has ${count}.`);
          return;
        }
        setSize(count);
      }
      setCsv({ rows: parsed.rows, labels: parsed.labels, fileName: file.name });
    } catch {
      setError('Could not read the CSV file.');
    }
  }

  function downloadTemplate() {
    const header = TILE_CSV_COLUMNS.join(',');
    const sample = [
      'Bandos chestplate,Any unique from Bandos,drop,10,GWD,false,1,,,',
      'Mining 50k XP,,standard,5,Skilling,false,,mining,skill,50000',
    ];
    const blob = new Blob([[header, ...sample].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anvil-tiles-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          boardSize: size,
          format: meta.format,
          scoringMode: meta.scoringMode,
          ...(csv ? { tileLabels: csv.labels } : {}),
        }),
      });
      const data: { id?: number; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || 'Failed to create event');
        setLoading(false);
        return;
      }

      // If a CSV was provided, apply the rich per-tile config (points, type, stats…) via the
      // shared, documented importer. The event already exists with the right labels, so a
      // failed import is non-fatal — the admin can re-import from the Tiles tab.
      if (csv) {
        await fetch(`/api/events/${data.id}/tiles/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: csv.rows }),
        }).catch(() => {});
      }

      router.push(`/admin/events/${data.id}`);
      router.refresh();
    } catch {
      setError('Failed to create event');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Event Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
          placeholder="The AFK Spot Bingo"
        />
      </div>

      {/* Mode — one choice drives format + scoring */}
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Type</label>
        <div className="grid sm:grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => changeMode(m.key)}
              className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                mode === m.key ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{meta.blurb}</p>
      </div>

      {/* Size — mode-aware */}
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">{meta.sizeLabel}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={size}
            onChange={(e) => {
              setSize(parseInt(e.target.value, 10) || meta.default);
              setCsv(null);
            }}
            min={meta.min}
            max={meta.max}
            required
            disabled={!!csv}
            className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold disabled:opacity-60"
          />
          <span className="text-sm text-text-muted">
            {csv ? `from ${csv.fileName}` : meta.sizeHelp(size)}
          </span>
        </div>
      </div>

      {/* CSV import — the one documented format */}
      <div className="border-t border-card-border pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground/70">Import tiles from CSV (optional)</label>
          <button type="button" onClick={downloadTemplate} className="text-xs text-gold hover:underline">
            Download template
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsv} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-brown-light border border-dashed border-card-border rounded-lg px-4 py-3 text-sm text-text-muted hover:border-gold hover:text-gold transition-colors w-full text-center"
        >
          {csv ? (
            <span className="text-gold">{csv.fileName} · {csv.labels.length} tiles loaded</span>
          ) : (
            'Choose a .csv file…'
          )}
        </button>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          Sets the tile count, labels and per-tile config in one go — ideal for Leagues boards. Columns:{' '}
          <span className="text-gold">{TILE_CSV_COLUMNS.join(', ')}</span>. One row per tile.
          {csv && (
            <>
              {' '}
              <button type="button" onClick={() => setCsv(null)} className="text-red-400 hover:underline">
                clear
              </button>
            </>
          )}
        </p>
      </div>

      {!csv && (
        <div className="rounded-lg border border-card-border bg-brown-dark/30 px-3 py-2.5 text-sm">
          <div className="font-medium text-foreground/80">Tiles will be auto-named</div>
          <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
            You&apos;ll land on the event&apos;s Tiles tab to configure each one (or bulk-import a CSV there).
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold hover:bg-gold-light text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Event'}
      </button>
    </form>
  );
}
