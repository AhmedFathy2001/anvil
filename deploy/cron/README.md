# Scheduled work, after the clans share one deployment

Two files, both installed by hand on the host that runs the deployment. **`deploy.sh` does not touch
cron** — it is hand-managed, so after editing either file here, copy it to the box (below).

| file | goes to | mode |
|---|---|---|
| `anvil-cron` | `/etc/cron.d/anvil-cron` | root-owned, `0644` |
| `cron-anvil.sh` | `/opt/anvil/cron-anvil.sh` | `0755` |

`cron-anvil.sh <job>` reads `CRON_SECRET` from `/opt/anvil/site.env` and calls
`https://anvilosrs.com/api/cron/<job>` with it — one call, whole-database, no per-clan fan-out.

## One deployment, one call per job

The control-plane dispatcher existed because each clan was its own container, so something had to know
the list and call each one. With one deployment that is not merely unnecessary, it is harmful: every
job already sweeps the whole database and takes each row's clan from the row, so fanning out per clan
would run the *same global sweep* once per clan — N passes over the same accounts, all hitting the
Jagex hiscores. One call is the whole point.

| job | what it walks |
|---|---|
| `stats` | every event, every weekly participant, every account due a hiscores poll |
| `weekly` | every competition's lifecycle — enrol, flip status, announce |
| `flush-notifications` | the pending-notification queue, and scheduled event start/end posts |
| `forge-consume` | the Forge data-plane queue |
| `backup` | the database (`pg_dump` to object storage) |
| `discord-commands` | the shared bot's global slash-command set — a daily reconcile with the code (boot registers it too via `instrumentation.ts`; this self-heals drift or a boot that couldn't reach Discord) |

## Installing / updating on the box

```sh
scp deploy/cron/cron-anvil.sh anvil:/opt/anvil/cron-anvil.sh && ssh anvil chmod 755 /opt/anvil/cron-anvil.sh
scp deploy/cron/anvil-cron    anvil:/etc/cron.d/anvil-cron   && ssh anvil chown root:root /etc/cron.d/anvil-cron
```

cron re-reads `/etc/cron.d` every minute, so there is nothing to reload. Confirm with
`tail -f /opt/anvil/cron.log` — `flush-notifications` should log `status=200` within a minute, `stats`
and `weekly` within fifteen.

> Legacy note: the box's file was once named `/etc/cron.d/anvil-dispatch` (from the dispatcher era)
> and paired with `cron-dispatch.sh`. Both are dead — the live pair is the two files above.

## `backup` needs pg_dump in the image

`/api/cron/backup` and the boot-time pre-migration snapshot shell out to `pg_dump`. The Dockerfile
installs `postgresql-client-18` from PGDG, pinned to the server's major (pg_dump refuses to dump from
a server newer than itself). If the Postgres major is bumped, bump that pin in the same change.
