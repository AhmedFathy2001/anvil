#!/usr/bin/env node
// Submit the site's URLs to IndexNow (Bing, Yandex, Seznam, Naver) so they re-crawl now.
//
//   npm run seo:indexnow                       # every URL in the apex sitemap
//   npm run seo:indexnow -- https://theafkspot.anvilosrs.com/login https://...   # specific URLs
//
// Specific URLs are grouped by host and submitted under that host's own key file — which is how a
// legacy clan hostname's stale results get re-crawled and their 301 seen. The key is read from the
// live site (/indexnow.txt), so this needs nothing but network access. ANVIL_APEX_DOMAIN picks the
// site (default anvilosrs.com).

const apex = process.env.ANVIL_APEX_DOMAIN || 'anvilosrs.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function text(url) {
  const res = await fetch(url, { redirect: 'manual' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function submit(host, urls) {
  const key = (await text(`https://${host}/indexnow.txt`)).trim();
  // The protocol caps a request at 10,000 URLs.
  for (let i = 0; i < urls.length; i += 10000) {
    const urlList = urls.slice(i, i + 10000);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `https://${host}/indexnow.txt`, urlList }),
    });
    // 200 = accepted, 202 = accepted pending key validation. Anything else is worth seeing.
    console.log(`${host}: ${urlList.length} URL(s) → ${res.status} ${res.status >= 300 ? await res.text() : ''}`);
  }
}

const args = process.argv.slice(2);
const urls = args.length
  ? args
  : [...(await text(`https://${apex}/sitemap.xml`)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const byHost = new Map();
for (const u of urls) {
  const host = new URL(u).host;
  byHost.set(host, [...(byHost.get(host) ?? []), u]);
}
for (const [host, list] of byHost) await submit(host, list);
