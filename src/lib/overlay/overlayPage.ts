// The stream overlay's page: one self-contained HTML document for an OBS "Browser source".
//
// Served by a route handler (app/overlay/[key]/route.ts), not a React page, on purpose: the root
// layout wraps every page in the site's nav, footer and providers, and an overlay wants none of it —
// a transparent page with a few hundred bytes of script. A route handler sits outside every layout,
// so nothing has to opt out of anything, and OBS's embedded Chromium loads no framework at all.
//
// Pure (no database): the page holds no data, only the options; the script polls
// /api/overlay/<key> for the payload (lib/overlay/overlayData), with an ETag so an unchanged board
// costs a 304. It also opens a socket to the push server (push/server.ts, same path the plugin uses)
// that carries nothing but a nudge when the event moves: on one it fetches at once, and while the
// socket is up the timer slows to a minute. No socket (blocked, push down, local dev) = the plain poll. Every value from the payload is put on the page with textContent / setAttribute,
// never as markup, and the CSP allows only this page's own nonce'd script and same-origin images.

import { inkOn } from '../artPalette';
import { OVERLAY_LIVE_POLL_MS, OVERLAY_POLL_MS, type OverlayOptions, type OverlayTheme } from './overlayView';

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
  const cfg = scriptJson({ key, view: opts.view, limit: opts.limit, title: opts.title, poll: OVERLAY_POLL_MS, livePoll: OVERLAY_LIVE_POLL_MS, celebrate: opts.celebrate });
  const px = (n: number) => `${Math.round(n * opts.scale * 10) / 10}px`;
  // The board has no lower-third form (a grid does not fit a bar): it draws as glass there.
  const theme: OverlayTheme = opts.theme === 'lower' && opts.view === 'board' ? 'glass' : opts.theme;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anvil overlay</title>
<style>
:root{--accent:${opts.accent};--ink:${inkOn(opts.accent)};--fs:${px(28)};--fs-s:${px(20)};--cell:${px(64)};--gap:${px(8)}}
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
#cel{position:fixed;left:0;right:0;bottom:${px(52)};display:flex;justify-content:center;pointer-events:none;z-index:9}
.cb{--c:var(--accent);display:flex;align-items:center;gap:${px(10)};max-width:90vw;padding:${px(10)} ${px(20)};border-radius:${px(14)};background:rgba(16,13,12,.86);box-shadow:0 0 0 ${px(3)} var(--c),0 0 ${px(26)} var(--c);animation:pop .55s cubic-bezier(.2,1.6,.4,1)}
.cb span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cb.out{animation:fade .5s ease-in forwards}
.cs{color:var(--c);font-size:1.1em}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes fade{to{opacity:0;transform:translateY(${px(10)})}}
.pop{animation:glow 1.8s ease-out}
.item.pop{animation:in .5s ease-out,glow 1.8s ease-out}
@keyframes glow{0%{filter:brightness(2) drop-shadow(0 0 ${px(10)} var(--accent))}100%{filter:none}}
.cell .dots i{width:${px(9)};height:${px(9)};border-radius:50%;box-shadow:0 0 0 ${px(1.5)} #000}
${themeCss(theme, px)}
</style>
</head>
<body class="t-${theme}">
<div id="wrap"><div id="head" class="o"><span id="name"></span><span id="clock"></span></div>
<div id="body"></div></div>
<div id="cel" aria-live="polite"></div>
<div id="mark"><img src="/icon-48.png" alt=""><span><span class="pb">Powered by</span><span class="nm">Anvil</span><span class="url">anvilosrs.com</span></span></div>
<script id="cfg" type="application/json">${cfg}</script>
<script nonce="${nonce}">${CLIENT}</script>
</body>
</html>`;
}

/**
 * Each theme is CSS over the same markup (#wrap > #head + #body), so the script and the data are one
 * for all of them. Classic adds nothing: it is the page as it always was.
 */
function themeCss(theme: OverlayTheme, px: (n: number) => string): string {
  switch (theme) {
    case 'glass':
      return `.t-glass{font-weight:700}
.t-glass #wrap{display:inline-block;min-width:${px(380)};max-width:100%;box-sizing:border-box;padding:${px(14)} ${px(18)};border-radius:${px(18)};background:rgba(15,12,11,.58);-webkit-backdrop-filter:blur(${px(10)});backdrop-filter:blur(${px(10)});box-shadow:inset 0 0 0 ${px(1)} rgba(255,255,255,.12),0 0 0 ${px(2)} color-mix(in srgb,var(--accent) 60%,transparent)}
.t-glass .o{-webkit-text-stroke:0;text-shadow:none}
.t-glass .team{flex:none}
.t-glass .bar{min-width:${px(120)}}
.t-glass .bar{background:rgba(255,255,255,.12);box-shadow:none}
.t-glass .cell:not(.done){background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 ${px(1)} rgba(255,255,255,.14)}`;
    case 'lower':
      return `.t-lower{padding:0;font-weight:700}
.t-lower #wrap{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:stretch;min-height:${px(60)};background:rgba(12,10,9,.9)}
.t-lower #head{margin:0;padding:0 ${px(18)};display:flex;align-items:center;gap:${px(10)};flex:none;background:var(--accent);color:var(--ink);text-transform:uppercase;letter-spacing:.04em}
.t-lower #name{color:inherit}
.t-lower #clock{opacity:.8}
.t-lower .o{-webkit-text-stroke:0;text-shadow:none}
.t-lower #body{display:flex;align-items:center;gap:${px(28)};padding:0 ${px(20)};overflow:hidden;white-space:nowrap;flex:1;font-size:var(--fs-s)}
.t-lower .row,.t-lower .item{margin:0;flex:none;animation:none}
.t-lower .bar{display:none}
.t-lower .team{max-width:10em}
.t-lower .item img{width:${px(26)};height:${px(26)}}
.t-lower #cel{bottom:${px(76)}}`;
    case 'pixel':
      return `.t-pixel{font-family:"Courier New",ui-monospace,monospace;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#ffe9a8}
.t-pixel #wrap{display:inline-block;min-width:${px(380)};box-sizing:border-box;padding:${px(12)} ${px(14)};background:#2b231a;border:${px(4)} solid #0e0b08;box-shadow:inset 0 0 0 ${px(3)} #5a4a33}
.t-pixel .o{-webkit-text-stroke:0;text-shadow:${px(2)} ${px(2)} 0 #000}
.t-pixel .team{flex:none}
.t-pixel .bar{min-width:${px(120)}}
.t-pixel .bar{border-radius:0;box-shadow:0 0 0 ${px(2)} #0e0b08;background:#1a140f}
.t-pixel .cell{border-radius:0;background:#1a140f}
.t-pixel .cell:not(.done){box-shadow:inset 0 0 0 ${px(2)} #5a4a33}
.t-pixel .cb{border-radius:0}`;
    default:
      return '';
  }
}

// The page's whole script. Plain ES2017 for OBS's Chromium; builds every node with textContent.
const CLIENT = `(function(){
var cfg=JSON.parse(document.getElementById('cfg').textContent);
var head=document.getElementById('head'),nameEl=document.getElementById('name'),clockEl=document.getElementById('clock'),bodyEl=document.getElementById('body'),markEl=document.getElementById('mark');
if(!cfg.title)head.style.display='none';
var etag=null,last=null,seen={},first=true;
var celEl=document.getElementById('cel'),celQ=[],celOn=false,prevS=null,prevB=null;
function celNext(){var it=celQ.shift();if(!it){celOn=false;return;}celOn=true;celEl.textContent='';
 var b=el('div','cb o');if(it.c)b.style.setProperty('--c',it.c);b.appendChild(el('span','cs','\u2605'));b.appendChild(el('span',null,it.t));celEl.appendChild(b);
 setTimeout(function(){b.className='cb o out';},3400);setTimeout(celNext,3900);}
function celebrate(list,many){if(!cfg.celebrate||!list.length)return;
 if(list.length>3)list=[{t:list.length+' '+many,c:null}];
 list.forEach(function(x){celQ.push(x);});while(celQ.length>4)celQ.shift();if(!celOn)celNext();}
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;}
function left(ms){var m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d>0?d+'d '+h+'h':h>0?h+'h '+mm+'m':mm+'m';}
function clock(){if(!last)return;var h=last.header,now=Date.now(),t='';
 if(h.stage==='run'&&h.endsAt){var e=Date.parse(h.endsAt.indexOf('T')>0?h.endsAt:h.endsAt.replace(' ','T')+'Z');t=e>now?left(e-now)+' left':'';}
 else if(h.stage==='build'&&h.startsAt){var s=Date.parse(h.startsAt.indexOf('T')>0?h.startsAt:h.startsAt.replace(' ','T')+'Z');t=s>now?'starts in '+left(s-now):'';}
 else if(h.stage==='wrap')t='final';
 clockEl.textContent=t;}
function notice(txt){bodyEl.textContent='';bodyEl.appendChild(el('div','notice o',txt));}
function standings(b){bodyEl.textContent='';var now={},wins=[];b.rows.forEach(function(r){var row=el('div','row');
 now[r.name]=r.score;var was=prevS?prevS[r.name]:undefined;
 if(cfg.celebrate&&was!=null&&r.score>was){row.className='row pop';var d=r.score-was,u=d===1&&/s$/.test(r.unit)&&r.unit!=='pts'?r.unit.slice(0,-1):r.unit;wins.push({t:r.name+' +'+d+' '+u,c:r.color});}
 row.appendChild(el('span','rank o',String(r.rank)));var n=el('span','team o',r.name);n.style.color=r.color;row.appendChild(n);
 var bar=el('span','bar'),fill=el('i');fill.style.width=r.pct+'%';fill.style.background=r.color;bar.appendChild(fill);row.appendChild(bar);
 row.appendChild(el('span','score o',r.score+(r.total?'/'+r.total:'')+' '+r.unit));bodyEl.appendChild(row);});
 prevS=now;celebrate(wins,'teams scored');if(!b.rows.length)notice('No teams yet');}
function feed(b){bodyEl.textContent='';b.items.forEach(function(it){var row=el('div','item');if(!first&&seen[it.id])row.style.animation='none';else if(!first&&cfg.celebrate)row.className='item pop';seen[it.id]=1;
 if(it.icon){var img=el('img');img.src=it.icon;img.alt='';row.appendChild(img);}
 var txt=el('div');txt.appendChild(el('div','o',it.text));var who=el('div','who o',it.who||'');
 if(it.team){var tg=el('span','tag',' · '+it.team);tg.style.color=it.color;who.appendChild(tg);}txt.appendChild(who);row.appendChild(txt);bodyEl.appendChild(row);});
 if(!b.items.length)notice('Waiting for the first drop');first=false;}
function board(b){bodyEl.textContent='';var g=el('div','grid');g.style.gridTemplateColumns='repeat('+b.cols+',var(--cell))';
 var now={},wins=[],nth={};
 b.cells.forEach(function(c){var cell=el('div','cell'+(c.done.length?' done':''));
 var k=c.label+'#'+(nth[c.label]=(nth[c.label]||0)+1);now[k]=c.done.join(',');var was=prevB?prevB[k]:undefined;
 if(cfg.celebrate&&was!=null&&c.done.length>(was?was.split(',').length:0)){var fresh=c.done.filter(function(col){return was.split(',').indexOf(col)<0;});
  cell.className+=' pop';wins.push({t:c.label+' done',c:fresh[0]||c.done[c.done.length-1]});}cell.title=c.label;if(c.done.length)cell.style.setProperty('--c',c.done[0]);
 if(c.icon){var img=el('img');img.src=c.icon;img.alt='';cell.appendChild(img);}else cell.appendChild(el('span','lbl o',c.label));
 if(c.done.length>1){var d=el('div','dots');c.done.forEach(function(col){var i=el('i');i.style.background=col;d.appendChild(i);});cell.appendChild(d);}
 g.appendChild(cell);});bodyEl.appendChild(g);prevB=now;celebrate(wins,'tiles done');}
function render(p){last=p;nameEl.textContent=p.header.name;clock();markEl.style.display=p.mark?'flex':'none';var b=p.body;
 if(b.notice!=null)return notice(b.notice);
 if(p.view==='standings')standings(b);else if(p.view==='feed')feed(b);else board(b);}
var pollT=null,busy=false,again=false,dead=false,ws=null,live=false,tries=0;
function soon(ms){clearTimeout(pollT);pollT=setTimeout(poll,ms);}
function poll(){if(busy){again=true;return;}busy=true;var h={};if(etag)h['If-None-Match']=etag;
 fetch('/api/overlay/'+encodeURIComponent(cfg.key)+'?view='+cfg.view+'&limit='+cfg.limit,{headers:h,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})
 .then(function(r){if(r.status===304)return null;if(r.status===404){etag=null;last=null;dead=true;if(ws)ws.close();head.style.display='none';notice('This overlay link was reset or removed. Copy the new one from your Anvil dashboard.');return null;}
  if(!r.ok)return null;etag=r.headers.get('ETag');return r.json();})
 .then(function(p){if(p){if(cfg.title)head.style.display='';render(p);}})
 .catch(function(){})
 .then(function(){busy=false;if(again){again=false;soon(0);}else soon(live?cfg.livePoll:cfg.poll);});}
function connect(){if(dead||!window.WebSocket)return;var s;
 try{s=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/plugin/push/ws?overlay='+encodeURIComponent(cfg.key));}catch(e){return retry();}
 ws=s;s.onopen=function(){live=true;tries=0;};
 s.onmessage=function(m){var d=null;try{d=JSON.parse(m.data);}catch(e){}if(d&&(d.t==='nudge'||d.t==='hello'))soon(0);};
 s.onclose=function(){if(ws===s)ws=null;var was=live;live=false;if(was)soon(cfg.poll);retry();};}
function retry(){if(dead)return;tries++;var ms=Math.min(300000,2000*Math.pow(2,Math.min(tries,8)));setTimeout(connect,ms/2+Math.random()*ms/2);}
setInterval(clock,30000);poll();connect();
})();`;
