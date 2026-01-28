'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EventForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [boardSize, setBoardSize] = useState(5);
  const [tileLabelsRaw, setTileLabelsRaw] = useState('');
  const [tileIcons, setTileIcons] = useState<string[]>([]);
  const [importedFile, setImportedFile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalTiles = boardSize * boardSize;

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

    if (tileLabels.length !== totalTiles) {
      setError(`Expected ${totalTiles} tile labels (one per line), got ${tileLabels.length}`);
      setLoading(false);
      return;
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, boardSize, tileLabels, tileIcons }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create event');
      setLoading(false);
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Import from JSON</label>
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
            <span className="text-gold">{importedFile} loaded</span>
          ) : (
            'Choose board.json file...'
          )}
        </button>
        <p className="text-xs text-text-muted mt-1">Auto-fills everything including tile icons</p>
      </div>

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
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Board Size (N for NxN)</label>
        <input
          type="number"
          value={boardSize}
          onChange={(e) => setBoardSize(parseInt(e.target.value, 10) || 5)}
          min={2}
          max={10}
          required
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold"
        />
        <p className="text-xs text-text-muted mt-1">{boardSize}x{boardSize} = {totalTiles} tiles</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Tile Labels (one per line, {totalTiles} total)</label>
        <textarea
          value={tileLabelsRaw}
          onChange={(e) => setTileLabelsRaw(e.target.value)}
          rows={Math.min(totalTiles, 15)}
          required
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold font-mono text-sm"
          placeholder={"Fire Cape\nBarrows Gloves\nDragon Warhammer\n..."}
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold hover:bg-yellow-500 text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}
