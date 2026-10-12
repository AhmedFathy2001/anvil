#!/bin/bash
# Daily on-box backup of the production database. Install to /opt/anvil/backup-local.sh, chmod 755.
#
# The off-box copy (/api/cron/backup → R2 bucket anvil-backups) needs an R2 token that can write that
# bucket; until it has one this is the only daily copy. Same box as the database, so it covers a bad
# migration or a wrong DELETE, not a lost machine.
set -euo pipefail
# Full dumps hold every user's data: owner-only from the moment the file exists, not after a chmod.
umask 077
DIR=/opt/anvil/backups/daily
KEEP=14
mkdir -p -m 700 "$DIR"
chmod 700 "$DIR"
ts=$(date -u +%Y%m%dT%H%M%SZ)
out="$DIR/anvil-$ts.sql.gz"
docker exec anvil-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$out.tmp"
size=$(stat -c %s "$out.tmp")
# A dump of this database is megabytes; a few KB means pg_dump printed an error, not a database.
if [ "$size" -lt 100000 ]; then
  rm -f "$out.tmp"
  echo "$(date -u +%FT%TZ) job=backup-local status=FAILED size=$size" >> /opt/anvil/cron.log
  exit 1
fi
mv "$out.tmp" "$out"
ls -1t "$DIR"/anvil-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -u +%FT%TZ) job=backup-local status=ok file=$(basename "$out") size=$size" >> /opt/anvil/cron.log
