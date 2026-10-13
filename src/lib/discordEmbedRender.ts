// The clan hall outside Anvil: an iframe card and an SVG badge, for clan websites, forums and
// READMEs. Counts only — never names: these render on pages that belong to somebody else.
//
// Pure string builders (no React, no database) so the routes stay thin and the output is testable.

export interface EmbedCounts {
  discord: number;
  inGame: number;
  voice: number;
}

export interface EmbedClan {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number | null;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Only https URLs reach an attribute; anything else is dropped rather than escaped into one. */
function safeUrl(u: string | null | undefined): string | null {
  return u && /^https:\/\//.test(u) ? escapeHtml(u) : null;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * The iframe card: the clan's banner across the top (a warm gradient without one), its logo (the
 * generated crest without one), three live numbers and a Join button.
 */
export function renderEmbedHtml(opts: {
  clan: EmbedClan;
  counts: EmbedCounts;
  clanUrl: string;
  inviteUrl: string | null;
}): string {
  const { clan, counts } = opts;
  const name = escapeHtml(clan.name);
  const banner = safeUrl(clan.bannerUrl);
  const logo = safeUrl(clan.logoUrl);
  const invite = safeUrl(opts.inviteUrl);
  const clanUrl = escapeHtml(opts.clanUrl);
  const pos = Math.min(100, Math.max(0, clan.bannerPosition ?? 50));
  const crest = logo
    ? `<img class="crest" src="${logo}" alt="">`
    : `<span class="crest gen" style="background:hsl(${hue(clan.name)} 34% 44%)">${escapeHtml(initials(clan.name))}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} · Discord</title>
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box}html,body{margin:0;background:transparent}
body{font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f0e7d6}
.card{border:1px solid #332a22;border-radius:16px;overflow:hidden;background:#1c1714;max-width:420px}
.banner{position:relative;height:112px;background:linear-gradient(120deg,#3a2412,#7a5f18 60%,#2a1a10)}
.banner img{width:100%;height:100%;object-fit:cover;display:block}
.banner:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,#1c1714,transparent 75%)}
.body{position:relative;margin-top:-30px;padding:0 18px 16px;display:flex;flex-direction:column;gap:12px}
.crest{width:54px;height:54px;border-radius:15px;border:3px solid #1c1714;object-fit:cover;display:grid;place-items:center;font:600 18px ui-monospace,monospace;color:#100d0c}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.name{font:600 18px Georgia,"Times New Roman",serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f0e7d6;text-decoration:none}
.join{background:#e0aa1e;color:#100d0c;border-radius:9px;padding:7px 12px;font-weight:600;font-size:12.5px;text-decoration:none;white-space:nowrap}
.join:hover{background:#ffd35c}
.nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.nums div{border:1px solid #251f1a;border-radius:10px;padding:8px 10px;background:#231d18}
.nums b{display:block;font:600 20px Georgia,serif;font-variant-numeric:tabular-nums}
.nums span{font-size:11px;color:#a89b86}
.foot{font:10px ui-monospace,monospace;letter-spacing:.06em;color:#6e6355;text-decoration:none}
.foot:hover{color:#a89b86}
</style></head><body>
<div class="card">
<div class="banner">${banner ? `<img src="${banner}" alt="" style="object-position:50% ${pos}%">` : ''}</div>
<div class="body">
${crest}
<div class="row"><a class="name" href="${clanUrl}" target="_blank" rel="noopener">${name}</a>${invite ? `<a class="join" href="${invite}" target="_blank" rel="noopener">Join</a>` : ''}</div>
<div class="nums">
<div><b>${counts.discord}</b><span>on Discord</span></div>
<div><b style="color:#ffd35c">${counts.inGame}</b><span>in game</span></div>
<div><b style="color:#7f8cff">${counts.voice}</b><span>in voice</span></div>
</div>
<div class="row"><span></span><a class="foot" href="${clanUrl}" target="_blank" rel="noopener">ANVILOSRS.COM</a></div>
</div></div>
<script>
// Fresh numbers every two minutes, but only while the card is on screen.
setInterval(function(){if(document.visibilityState==='visible')location.reload()},120000);
</script>
</body></html>`;
}

/** Rough Verdana 11px advance — the classic badge font — so the halves fit their text. */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[A-Z0-9MW@#%]/.test(ch) ? 7.5 : /[ilj.,:'!| ]/.test(ch) ? 3.6 : 6.4;
  return Math.ceil(w);
}

/** A two-part badge, "<label> | <value>", in the site's gold. */
export function renderBadgeSvg(label: string, value: string): string {
  const l = label.length > 28 ? `${label.slice(0, 27)}…` : label;
  const lw = textWidth(l) + 16;
  const vw = textWidth(value) + 16;
  const w = lw + vw;
  const el = escapeHtml(l);
  const ev = escapeHtml(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${el}: ${ev}">
<title>${el}: ${ev}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="4"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#2b2f3a"/><rect x="${lw}" width="${vw}" height="20" fill="#e0aa1e"/></g>
<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14" fill="#fff">${el}</text>
<text x="${lw + vw / 2}" y="14" fill="#100d0c" font-weight="bold">${ev}</text>
</g></svg>`;
}
