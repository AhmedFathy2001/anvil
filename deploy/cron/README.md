# Scheduled work, after the clans share one deployment

Two files, both installed on the host that runs the deployment:

| file | goes to | mode |
|---|---|---|
| `anvil-cron` | `/etc/cron.d/anvil-cron` | root-owned, `0644` |
| `site-cron.sh` | `/opt/anvil/site-cron.sh` | `0755` |

`site-cron.sh` reads `CRON_SECRET` from `/opt/anvil/site.env` (override with `ANVIL_ENV_FILE`) and
calls `https://anvilosrs.com/api/cron/<job>` (override with `ANVIL_CRON_BASE`).

## Why this replaces the dispatcher

The control-plane dispatcher existed because each clan was its own container, so something had to
know the list of them and call each one. It discovered clans from the control-plane database and
fanned out per clan.

With one deployment that is not merely unnecessary, it is harmful. Every job here already sweeps the
whole database and takes each row's clan from the row:

| job | what it walks |
|---|---|
| `stats` | every event, every weekly participant, every account due a hiscores poll |
| `weekly` | every competition's lifecycle — enrol, flip status, announce |
| `flush-notifications` | the pending-notification queue, and scheduled event start/end posts |
| `backup` | the database |

So calling them once per clan would run the *same global sweep* N times: N concurrent passes over
the same accounts, each one hitting the Jagex hiscores. The poll budget is the scarce resource in
this system — one call is the entire point.

Verified on the preview with both clans loaded: a single `/api/cron/weekly` enrolled 272 members
across the clans that needed it, and a single `/api/cron/stats` swept both. Neither took a clan
argument, and neither needed one.

## `backup` needs pg_dump in the image

Both `/api/cron/backup` and the boot-time pre-migration snapshot shell out to `pg_dump`, and it was
not in the runtime image — the backup 500s without it, and the snapshot warns and lets the migration
proceed unsnapshotted. The Dockerfile now installs `postgresql-client-18` from PGDG; it has to stay
pinned to the server's major, because pg_dump refuses to dump from a server newer than itself.

If the Postgres major is ever bumped, bump that pin in the same change or the backups stop.

## Cutover

The dispatcher and the shared cron must not both be live, or the sweep doubles.

1. Remove `/etc/cron.d/anvil-dispatch` (and `/opt/anvil/cron-dispatch.sh` once nothing calls it).
2. Install the two files above.
3. Confirm: `tail -f /opt/anvil/site-cron.log` should show `status=200` within a minute for
   `flush-notifications`, and within fifteen for `stats` and `weekly`.

Anvil.Admin keeps `/api/cron/dispatch/<job>` for as long as any single-clan container still exists.
It has nothing to dispatch to once they are gone.

## Staggering

`stats` and `weekly` both want the quarter hour and are deliberately five minutes apart. Run in the
same second, the weekly enrolment races the sweep that is about to read it — the enrolment wins or
loses by chance, and a competition's first tick either counts or does not. Five minutes is not a
lock, but it removes the coincidence.
