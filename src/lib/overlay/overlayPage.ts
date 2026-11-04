// The stream overlay's page: one self-contained HTML document for an OBS "Browser source".
//
// Served by a route handler (app/overlay/[key]/route.ts), not a React page, on purpose: the root
// layout wraps every page in the site's nav, footer and providers, and an overlay wants none of it —
// a transparent page with a few hundred bytes of script. A route handler sits outside every layout,
// so nothing has to opt out of anything, and OBS's embedded Chromium loads no framework at all.
//
// Pure (no database): the page holds no data, only the options; the script polls
// /api/overlay/<key> for the payload (lib/overlay/overlayData), with an ETag so an unchanged board
// costs a 304. Every value from the payload is put on the page with textContent / setAttribute,
// never as markup, and the CSP allows only this page's own nonce'd script and same-origin images.

import { OVERLAY_POLL_MS, type OverlayOptions } from './overlayView';

/** JSON safe to sit inside a <script> element: no `<`, so no `</script>` and no `<!--`. */
export function scriptJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** The response's CSP: nothing but this document, its nonce'd script, its own API and its own images. */
export function overlayCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    "img-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    // The host's own dashboard previews it in an iframe; nothing else may frame it.
    "frame-ancestors 'self'",
  ].join('; ');
}

export function overlayHtml(key: string, opts: OverlayOptions, nonce: string): string {
  const cfg = scriptJson({ key, view: opts.view, limit: opts.limit, title: opts.title, poll: OVERLAY_POLL_MS });
  const px = (n: number) => `${Math.round(n * opts.scale * 10) / 10}px`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anvil overlay</title>
<style>
:root{--accent:${opts.accent};--fs:${px(28)};--fs-s:${px(20)};--cell:${px(64)};--gap:${px(8)}}
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
body{font-family:"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;font-weight:800;color:#fff;font-size:var(--fs);line-height:1.2;padding:${px(12)};text-align:${opts.align}}
.o{-webkit-text-stroke:${px(1.2)} #000;paint-order:stroke fill;text-shadow:0 ${px(2)} ${px(4)} rgba(0,0,0,.9),0 0 ${px(2)} #000}
#head{display:flex;gap:${px(12)};align-items:baseline;margin-bottom:${px(8)};${opts.align === 'right' ? 'justify-content:flex-end;' : ''}}
#name{color:var(--accent)}
#clock{font-size:var(--fs-s);opacity:.95}
.notice{font-size:var(--fs-s)}
.row{display:flex;align-items:center;gap:${px(12)};margin:${px(6)} 0;${opts.align === 'right' ? 'flex-direction:row-reverse;' : ''}}
.rank{min-width:1.6em;color:var(--accent)}
.team{flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:14em}
.score{font-size:var(--fs-s);white-space:nowrap}
.bar{flex:1 1 ${px(160)};min-width:${px(80)};height:${px(12)};border-radius:${px(6)};background:rgba(0,0,0,.55);box-shadow:0 0 0 ${px(2)} rgba(0,0,0,.8);overflow:hidden}
.bar>i{display:block;height:100%}
.item{display:flex;align-items:center;gap:${px(10)};margin:${px(6)} 0;animation:in .5s ease-out;${opts.align === 'right' ? 'flex-direction:row-reverse;' : ''}}
.item img{width:${px(36)};height:${px(36)};image-rendering:pixelated;filter:drop-shadow(0 0 ${px(2)} #000)}
.item .who{font-size:var(--fs-s);opacity:.95}
.tag{font-size:var(--fs-s)}
@keyframes in{from{opacity:0;transform:translateY(${px(-8)})}to{opacity:1;transform:none}}
.grid{display:inline-grid;gap:var(--gap)}
.cell{position:relative;width:var(--cell);height:var(--cell);border-radius:${px(8)};background:rgba(0,0,0,.6);box-shadow:inset 0 0 0 ${px(2)} rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;overflow:hidden}
.cell img{max-width:70%;max-height:70%;image-rendering:pixelated}
.cell .lbl{font-size:${px(11)};font-weight:700;padding:${px(2)};text-align:center;overflow:hidden;max-height:100%}
.cell.done{box-shadow:inset 0 0 0 ${px(4)} var(--c)}
.cell.done img{opacity:.55}
.cell .dots{position:absolute;bottom:${px(3)};left:0;right:0;display:flex;justify-content:center;gap:${px(3)}}
#mark{position:fixed;right:${px(10)};bottom:${px(8)};display:none;align-items:center;gap:${px(7)};padding:${px(5)} ${px(10)} ${px(5)} ${px(6)};border-radius:${px(10)};background:rgba(16,13,12,.72);box-shadow:0 0 0 ${px(1)} rgba(224,170,30,.45),0 ${px(2)} ${px(8)} rgba(0,0,0,.6);-webkit-text-stroke:0;text-shadow:none;font-weight:700;line-height:1.05}#mark img{width:${px(26)};height:${px(26)};image-rendering:pixelated}#mark .pb{display:block;font-size:${px(9)};letter-spacing:.08em;text-transform:uppercase;color:#cbbd9f;font-weight:600}#mark .nm{display:block;font-size:${px(14)};color:#ffd35c}#mark .url{display:block;font-size:${px(9)};color:#cbbd9f;font-weight:500}
.cell .dots i{width:${px(9)};height:${px(9)};border-radius:50%;box-shadow:0 0 0 ${px(1.5)} #000}
</style>
</head>
<body>
<div id="head" class="o"><span id="name"></span><span id="clock"></span></div>
<div id="body"></div>
<div id="mark"><img src="/icon-48.png" alt=""><span><span class="pb">Powered by</span><span class="nm">Anvil</span><span class="url">anvilosrs.com</span></span></div>
<script id="cfg" type="application/json">${cfg}</script>
<script nonce="${nonce}">${CLIENT}</script>
</body>
</html>`;
}

// The page's whole script. Plain ES2017 for OBS's Chromium; builds every node with textContent.
const CLIENT = `(function(){
var cfg=JSON.parse(document.getElementById('cfg').textContent);
var head=document.getElementById('head'),nameEl=document.getElementById('name'),clockEl=document.getElementById('clock'),bodyEl=document.getElementById('body'),markEl=document.getElementById('mark');
if(!cfg.title)head.style.display='none';
var etag=null,last=null,seen={},first=true;
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;}
function left(ms){var m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d>0?d+'d '+h+'h':h>0?h+'h '+mm+'m':mm+'m';}
function clock(){if(!last)return;var h=last.header,now=Date.now(),t='';
 if(h.stage==='run'&&h.endsAt){var e=Date.parse(h.endsAt.indexOf('T')>0?h.endsAt:h.endsAt.replace(' ','T')+'Z');t=e>now?left(e-now)+' left':'';}
 else if(h.stage==='build'&&h.startsAt){var s=Date.parse(h.startsAt.indexOf('T')>0?h.startsAt:h.startsAt.replace(' ','T')+'Z');t=s>now?'starts in '+left(s-now):'';}
 else if(h.stage==='wrap')t='final';
 clockEl.textContent=t;}
function notice(txt){bodyEl.textContent='';bodyEl.appendChild(el('div','notice o',txt));}
function standings(b){bodyEl.textContent='';b.rows.forEach(function(r){var row=el('div','row');
 row.appendChild(el('span','rank o',String(r.rank)));var n=el('span','team o',r.name);n.style.color=r.color;row.appendChild(n);
 var bar=el('span','bar'),fill=el('i');fill.style.width=r.pct+'%';fill.style.background=r.color;bar.appendChild(fill);row.appendChild(bar);
 row.appendChild(el('span','score o',r.score+(r.total?'/'+r.total:'')+' '+r.unit));bodyEl.appendChild(row);});
 if(!b.rows.length)notice('No teams yet');}
function feed(b){bodyEl.textContent='';b.items.forEach(function(it){var row=el('div','item');if(!first&&seen[it.id])row.style.animation='none';seen[it.id]=1;
 if(it.icon){var img=el('img');img.src=it.icon;img.alt='';row.appendChild(img);}
 var txt=el('div');txt.appendChild(el('div','o',it.text));var who=el('div','who o',it.who||'');
 if(it.team){var tg=el('span','tag',' · '+it.team);tg.style.color=it.color;who.appendChild(tg);}txt.appendChild(who);row.appendChild(txt);bodyEl.appendChild(row);});
 if(!b.items.length)notice('Waiting for the first drop');first=false;}
function board(b){bodyEl.textContent='';var g=el('div','grid');g.style.gridTemplateColumns='repeat('+b.cols+',var(--cell))';
 b.cells.forEach(function(c){var cell=el('div','cell'+(c.done.length?' done':''));cell.title=c.label;if(c.done.length)cell.style.setProperty('--c',c.done[0]);
 if(c.icon){var img=el('img');img.src=c.icon;img.alt='';cell.appendChild(img);}else cell.appendChild(el('span','lbl o',c.label));
 if(c.done.length>1){var d=el('div','dots');c.done.forEach(function(col){var i=el('i');i.style.background=col;d.appendChild(i);});cell.appendChild(d);}
 g.appendChild(cell);});bodyEl.appendChild(g);}
function render(p){last=p;nameEl.textContent=p.header.name;clock();markEl.style.display=p.mark?'flex':'none';var b=p.body;
 if(b.notice!=null)return notice(b.notice);
 if(p.view==='standings')standings(b);else if(p.view==='feed')feed(b);else board(b);}
function poll(){var h={};if(etag)h['If-None-Match']=etag;
 fetch('/api/overlay/'+encodeURIComponent(cfg.key)+'?view='+cfg.view+'&limit='+cfg.limit,{headers:h,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
 .then(function(r){if(r.status===304)return null;if(r.status===404){etag=null;last=null;head.style.display='none';notice('This overlay link was reset or removed. Copy the new one from your Anvil dashboard.');return null;}
  if(!r.ok)return null;etag=r.headers.get('ETag');return r.json();})
 .then(function(p){if(p){if(cfg.title)head.style.display='';render(p);}})
 .catch(function(){})
 .then(function(){setTimeout(poll,cfg.poll);});}
setInterval(clock,30000);poll();
})();`;
