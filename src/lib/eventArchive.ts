// Pure helpers for the event archive zip (api/admin/events/[eventId]/archive): file naming, CSV, and
// the offline index.html. No database, so they are tested directly (tests/event-archive.test.ts).

export interface ArchiveProof {
  kind: 'submission' | 'start' | 'payout' | 'fee';
  url: string;
  /** Path inside the zip, without extension. */
  path: string;
  tileId?: number;
  teamId?: number;
  caption: string;
  /** Path actually written (with extension), once fetched. */
  file?: string;
  status?: 'ok' | 'deleted' | 'missing' | 'external';
}

/** A string safe as one path segment on Windows, macOS and Linux, and not empty. */
export function safeName(s: string): string {
  const cleaned = s
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return (cleaned || 'untitled').slice(0, 80);
}

/** RFC 4180 CSV with a header row; null and undefined become empty cells. */
export function csvOf(header: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A self-contained page to browse the archive offline: each tile, each team, its proofs. */
export function archiveIndexHtml(input: {
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  tiles: { id: number; name: string }[];
  teams: { id: number; name: string; color: string | null }[];
  completions: { teamId: number; tileId: number }[];
  proofs: ArchiveProof[];
}): string {
  const done = new Set(input.completions.map((c) => `${c.teamId}:${c.tileId}`));
  const shot = (p: ArchiveProof) =>
    p.status === 'ok' && p.file
      ? `<figure><a href="${esc(p.file)}"><img src="${esc(p.file)}" loading="lazy" alt=""></a><figcaption>${esc(p.caption)}</figcaption></figure>`
      : `<figure class="gone"><div>${
          p.status === 'deleted' ? 'Deleted after 90 days' : p.status === 'external' ? `<a href="${esc(p.url)}">External link</a>` : 'Could not be downloaded'
        }</div><figcaption>${esc(p.caption)}</figcaption></figure>`;
  const tileSections = input.tiles
    .map((t) => {
      const rows = input.teams
        .map((team) => {
          const ps = input.proofs.filter((p) => p.kind === 'submission' && p.tileId === t.id && p.teamId === team.id);
          const complete = done.has(`${team.id}:${t.id}`);
          if (!ps.length && !complete) return '';
          return `<div class="team"><h3><span class="dot" style="background:${esc(team.color ?? '#888')}"></span>${esc(team.name)}${
            complete ? ' <span class="ok">✓ completed</span>' : ''
          }</h3><div class="grid">${ps.map(shot).join('')}</div></div>`;
        })
        .join('');
      return rows ? `<section><h2>${esc(t.name)}</h2>${rows}</section>` : '';
    })
    .join('');
  const other = (kind: ArchiveProof['kind'], title: string) => {
    const ps = input.proofs.filter((p) => p.kind === kind);
    return ps.length ? `<section><h2>${title}</h2><div class="grid">${ps.map(shot).join('')}</div></section>` : '';
  };
  const dates = [input.startDate, input.endDate].filter(Boolean).map((d) => esc(String(d).slice(0, 10))).join(' → ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.eventName)} — archive</title>
<style>
body{margin:0;padding:24px 16px;background:#141010;color:#f5efe6;font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto}h1{margin:0;color:#e0aa1e}p.meta{color:#a8956f;margin:4px 0 24px}
section{border:1px solid #3b3028;border-radius:12px;padding:12px 16px;margin:0 0 16px;background:#1c1612}
h2{font-size:17px;margin:0 0 8px}h3{font-size:14px;margin:12px 0 6px;display:flex;align-items:center;gap:6px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.ok{color:#7fd17f;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
figure{margin:0}img{width:100%;border-radius:6px;display:block;background:#2a221c}
figcaption{font-size:12px;color:#a8956f;margin-top:4px;overflow-wrap:anywhere}
.gone div{aspect-ratio:16/9;border:1px dashed #3b3028;border-radius:6px;display:grid;place-items:center;color:#a8956f;font-size:13px;text-align:center;padding:8px}
a{color:#e0aa1e}
</style></head><body><main>
<h1>${esc(input.eventName)}</h1><p class="meta">${dates}${dates ? ' · ' : ''}${input.proofs.filter((p) => p.status === 'ok').length} images · records in event.json and the CSV files</p>
${tileSections}${other('start', 'Starting shots')}${other('payout', 'Payouts')}${other('fee', 'Sign-up fees')}
</main></body></html>`;
}
