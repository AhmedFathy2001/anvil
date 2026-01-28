'use client';

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  uploaderName?: string | null;
  creditPlayerName?: string | null;
}

interface Tile {
  id: number;
  label: string;
  icon?: string | null;
}

interface Props {
  submissions: Submission[];
  tiles: Tile[];
  playerName: string;
}

export default function PlayerContributions({ submissions, tiles, playerName }: Props) {
  const tileMap = new Map(tiles.map((t) => [t.id, t]));

  // Group by tile
  const grouped = new Map<number, Submission[]>();
  for (const s of submissions) {
    const arr = grouped.get(s.tileId) || [];
    arr.push(s);
    grouped.set(s.tileId, arr);
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-4 text-text-muted text-sm">
        No contributions from {playerName} yet.
      </div>
    );
  }

  const totalAmount = submissions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">
        {playerName}&apos;s Contributions ({submissions.length} submissions, {totalAmount} total)
      </h3>
      {Array.from(grouped.entries()).map(([tileId, subs]) => {
        const tile = tileMap.get(tileId);
        const tileTotal = subs.reduce((sum, s) => sum + s.amount, 0);
        return (
          <div key={tileId} className="border border-card-border rounded-lg p-3 bg-card-bg">
            <div className="flex items-center gap-2 mb-2">
              {tile?.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.icon} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-sm font-medium">{tile?.label || `Tile #${tileId}`}</span>
              <span className="text-xs text-accent-green-light ml-auto">
                Total: x{tileTotal}
              </span>
            </div>
            <div className="space-y-1">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-gold font-medium">x{s.amount}</span>
                  {s.uploaderName && s.uploaderName !== s.creditPlayerName && (
                    <span className="text-text-muted">(uploaded by {s.uploaderName})</span>
                  )}
                  {s.note && <span className="truncate">&mdash; {s.note}</span>}
                  <span className="ml-auto flex-shrink-0">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  {s.imageUrl && (
                    <a
                      href={s.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:text-gold-light"
                    >
                      img
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
