# Load profile → k6

How many players can the box carry, at the traffic mix it actually sees?

Three steps: **record** what real traffic looks like (Caddy access log), **profile** it (who is
there, and what one of them asks for per minute), then **replay** that per-person mix in k6 at
rising headcounts until latency or errors break.

```
Caddy access log ──► loadtest/profile.mjs ──► .out/profile.json ──► loadtest/k6/anvil.js ──► ceiling
                                                 ▲
                         loadtest/seed.mjs ──► .out/fixtures.json (clan, board, N plugin tokens)
```

Most of the load comes from the plugin (config/board polls, stat pushes, the push socket), and
`analytics_events` never sees it. That is why the profile is built from the proxy log and not from
`/staff/analytics`.

## 1. Record: turn on the access log (box)

On since 2026-10-27, in the `:8080` (Cloudflare Tunnel) block of the live `/opt/anvil/Caddyfile`,
writing `/data/tunnel-access.log`. All public traffic enters there. `caddy-access-log.caddy` records
the exact config. Credentials are **hashed** (8 hex characters, enough to tell sessions apart, useless
as a token). RSN/account headers and Referer are dropped. `client_ip` stays in clear for the abuse
blocklist. Logs are kept for a week.

Check after the reload (must print `0`):

```sh
docker exec anvil-caddy-1 sh -c "grep -cE '\"(Authorization\":\\[\"Bearer|Cookie\":\\[\"[^\"]*=)' /data/tunnel-access.log"
```

Leave it on for a few days, including **an event evening**. That evening is the shape worth modelling.

## 2. Profile

```sh
ssh anvil 'docker exec anvil-caddy-1 sh -c "cd /data && tar c tunnel-access*"' | tar x -C access-logs
npm run load:profile -- access-logs/tunnel-access* --host '^(anvilosrs\.com|[a-z0-9-]+\.anvilosrs\.com)$'
```

First run without a window and read the hourly table, then re-run on the busy stretch:
`--from 2026-10-25T18:00Z --to 2026-10-25T23:00Z`. Leave beta out with `--host` (it shares the Caddy).
For each class (plugin, web) the summary gives:

- **present peak / p95 / median**: concurrent people. A person counts as present from their first
  request to their last, with gaps of up to 10 minutes bridged.
- **/actor-min**: what one present person sends to that route per minute. k6 replays this number.
- p50/p95 latency and the 304 share for each route, as observed in production. This is the baseline
  the load test is compared against.
- peak minute, held sockets, and unmatched paths (probes, removed routes).

`profile.mjs` refuses to read a log that has a credential in the clear.

## 3. Replay

**Never against prod or beta.** Both run on one box, and a ramp would hit real clans and the shared
Postgres. The k6 script refuses `*.anvilosrs.com` unless `ALLOW_LIVE=1` is set. Point it at a copy of
the box (`Anvil/deploy/migrate/export-box.sh` → `restore-box.sh` on a throwaway server) or a local
build. The target should run **without** Discord/WOM credentials, so a write can't post anywhere and
the hiscores budget isn't spent.

```sh
DATABASE_URL=postgres://…/anvil_loadtest npm run load:seed -- --players 400   # ≥ the most VUs you'll run
BASE_URL=http://target:3000 npm run load:run
```

Useful env: `MULTS=0.5,1,2,3,5,8` (headcount stages as multiples of the observed peak), `RAMP=1m`,
`HOLD=3m`, `P95_MS=1500`, `MAX_FAIL=0.02`, `PEAK_PLUGIN` / `PEAK_WEB` (override the observed peaks),
`CLASSES=plugin`. Add `K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=loadtest/.out/report.html` for a
timeline. The run **aborts** when a class's p95 or error rate crosses its threshold. The "max VUs
reached" figure at abort is the ceiling at this mix (one VU = one present person). If no stage
breaks, raise `MULTS`.

### Reading the result honestly

- The setup line `x% of observed requests NOT replayed` is traffic the run leaves out on purpose:
  writes with side effects outside the server (notify, moments, clip, claims, clan sync,
  link/auth flows), the push socket, static assets (Cloudflare serves those) and bots. The real
  ceiling is somewhat lower than the measured one by roughly that share.
- Web pages are fetched **signed out**. Signed-in pages do more work.
- `CF-Connecting-IP` is set per VU so the IP-keyed limiters see separate players. That only works on
  a target reached directly; behind Cloudflare the header is overwritten and IP limits will trip.
  `rate_limited` counts 429s separately and they are not failures. Many 429s means the app's limiter
  is the ceiling, not the box.
- Background jobs (stats sweep, crons) run on the target too, and should, because they compete for
  the same Postgres. Seeded players have no real hiscores, so the sweep's share is understated.
- Run k6 from a different machine than the target, or the two compete for CPU.

## Files

| file | what |
| --- | --- |
| `caddy-access-log.caddy` | the log snippet + box edit |
| `routes.mjs` | raw path → route pattern, from the `src/app` tree |
| `profile-core.mjs` | the aggregation (pure; tested in `tests/load-profile.test.ts`) |
| `profile.mjs` | CLI: logs → `.out/profile.json` + summary |
| `seed.mjs` | clan + running board + N claimed characters with plugin tokens → `.out/fixtures.json` |
| `k6/anvil.js` | the replay |

`.out/` is gitignored. `fixtures.json` holds live tokens for the target DB.
