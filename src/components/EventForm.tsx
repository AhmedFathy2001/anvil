'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EventForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [boardSize, setBoardSize] = useState(5);
  const [format, setFormat] = useState<'bingo' | 'tilerace'>('bingo');
  const [scoringMode, setScoringMode] = useState<'tiles' | 'points'>('tiles');
  const [tileLabelsRaw, setTileLabelsRaw] = useState('');
  const [tileIcons, setTileIcons] = useState<string[]>([]);
  const [importedFile, setImportedFile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRace = format === 'tilerace';
  // A grid is N×N; a race is a flat ordered sequence of `boardSize` tiles.
  const totalTiles = isRace ? boardSize : boardSize * boardSize;

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const board = json?.data?.getBingoBoard ?? json;

        if (board.name) setName(board.name);

        const layout: string[][] | undefined = board.layout;
        if (!layout || !Array.isArray(layout)) {
          setError('JSON has no layout array');
          return;
        }
        const size = layout.length;
        setBoardSize(size);

        const tileMap = new Map<string, { name: string; icon: string }>();
        if (Array.isArray(board.tiles)) {
          for (const t of board.tiles) {
            tileMap.set(String(t.id), {
              name: (t.name ?? '').trim(),
              icon: t.icon ?? '',
            });
          }
        }

        const labels: string[] = [];
        const icons: string[] = [];
        for (const row of layout) {
          for (const id of row) {
            const tile = tileMap.get(String(id));
            labels.push(tile?.name || `Tile ${id}`);
            icons.push(tile?.icon || '');
          }
        }

        setTileLabelsRaw(labels.join('\n'));
        setTileIcons(icons);
        setImportedFile(file.name);
        setError('');
      } catch {
        setError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const tileLabels = tileLabelsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Two paths: JSON-imported labels must match board size exactly; blank create
    // sends no labels and lets the API auto-name them.
    if (tileLabels.length > 0 && tileLabels.length !== totalTiles) {
      setError(`Imported board has ${tileLabels.length} tiles but board size is ${totalTiles}. Adjust board size or re-import.`);
      setLoading(false);
      return;
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tileLabels.length > 0
          ? { name, boardSize, tileLabels, tileIcons, scoringMode, format }
          : { name, boardSize, scoringMode, format },
      ),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create event');
      setLoading(false);
      return;
    }

    // Land on the new event's detail page if the API returns an id; otherwise just
    // bounce back to the events index. Either way we refresh so the new row shows up.
    const data: { id?: number } = await res.json().catch(() => ({}));
    router.push(data.id ? `/admin/events/${data.id}` : '/admin/events');
    router.refresh();
  }

  // Two creation modes:
  //   - "blank": just name + board size, tiles auto-named "Tile 1..N", configured per-tile
  //     after creation via the existing TileTrackingConfig editor on the event detail page.
  //     This is the right path for any tile that needs item drops, stat tracking, etc.
  //     since the textarea couldn't capture that anyway.
  //   - "json": power users drop a fully-shaped board.json that fills name/size/labels/icons
  //     in one go, preserving the bulk-import workflow.
  const importedLabels = tileLabelsRaw.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  const hasImportedLabels = importedLabels.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {!isRace && (
        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-1.5">Import from JSON (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-brown-light border border-dashed border-card-border rounded-lg px-4 py-3 text-sm text-text-muted hover:border-gold hover:text-gold transition-colors w-full text-center"
          >
            {importedFile ? (
              <span className="text-gold">{importedFile} loaded · {importedLabels.length} tiles</span>
            ) : (
              'Choose board.json file…'
            )}
          </button>
          <p className="text-xs text-text-muted mt-1">
            Imports name, board size, tile labels, and icons in one shot. Otherwise create a blank board and
            configure tiles individually.
          </p>
        </div>
      )}

      <div className={isRace ? 'space-y-4' : 'border-t border-card-border pt-4 space-y-4'}>
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

        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-1.5">Format</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormat('bingo')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                format === 'bingo'
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              Bingo grid
            </button>
            <button
              type="button"
              onClick={() => setFormat('tilerace')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                format === 'tilerace'
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'border-card-border text-text-muted hover:border-gold/50'
              }`}
            >
              Tile race
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {isRace
              ? 'An ordered track — teams must complete tiles in sequence, and a team’s standing is the furthest tile it has reached.'
              : 'A classic N×N grid where teams complete tiles in any order.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/70 mb-1.5">
            {isRace ? 'Track Length' : 'Board Size'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={boardSize}
              onChange={(e) => setBoardSize(parseInt(e.target.value, 10) || (isRace ? 10 : 5))}
              min={isRace ? 3 : 2}
              max={isRace ? 50 : 10}
              required
              className="w-24 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
            />
            <span className="text-sm text-text-muted">
              {isRace ? `${totalTiles} tiles in sequence` : `${boardSize}×${boardSize} = ${totalTiles} tiles`}
            </span>
          </div>
        </div>

        {!isRace && (
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Scoring Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScoringMode('tiles')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  scoringMode === 'tiles'
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Classic (tile count)
              </button>
              <button
                type="button"
                onClick={() => setScoringMode('points')}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  scoringMode === 'points'
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'border-card-border text-text-muted hover:border-gold/50'
                }`}
              >
                Points (Leagues-style)
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {scoringMode === 'points'
                ? 'Each tile carries a point value (set per-tile after creation). A team’s score is the sum of points for completed tiles — harder tiles are worth more.'
                : 'Every completed tile counts equally toward a team’s score.'}
            </p>
          </div>
        )}

        {hasImportedLabels ? (
          <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm">
            <div className="font-medium text-gold">{importedLabels.length} tiles loaded from JSON</div>
            <div className="text-xs text-text-muted mt-0.5">Labels and icons applied; you can refine each tile after creation.</div>
          </div>
        ) : (
          <div className="rounded-lg border border-card-border bg-brown-dark/30 px-3 py-2.5 text-sm">
            <div className="font-medium text-foreground/80">Tiles will be auto-named</div>
            <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
              You&apos;ll land on the event page where you can click each tile to set its label, type
              (standard, drop, stat-tracked), tracked items, target amount, and tracking mode (team or individual).
            </div>
          </div>
        )}
      </div>

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
