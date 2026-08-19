#!/bin/sh
# Call one of the deployment's cron endpoints. Install to /opt/anvil/site-cron.sh, chmod 755.
#
#   /opt/anvil/site-cron.sh stats
#
# Replaces cron-dispatch.sh, which asked the control plane which clans were due and called each
# clan's container. There is one container now, and every job below is already global — so this
# calls it once and gets out of the way. No clan list, no fan-out, nothing to keep in sync when a
# clan is added.
set -eu

JOB="${1:?usage: site-cron.sh <flush-notifications|stats|weekly|backup>}"
LOG="${ANVIL_CRON_LOG:-/opt/anvil/site-cron.log}"
ENV_FILE="${ANVIL_ENV_FILE:-/opt/anvil/site.env}"
BASE="${ANVIL_CRON_BASE:-https://anvilosrs.com}"

# A missing log directory must not stop the job reporting why it failed.
touch "$LOG" 2>/dev/null || LOG=/dev/stderr

SECRET=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
if [ -z "${SECRET:-}" ]; then
  printf '%s job=%s status=no-secret\n' "$(date -u +%FT%TZ)" "$JOB" >> "$LOG"
  exit 1
fi

# The apex, deliberately. These jobs belong to no clan — they sweep every clan's rows — so calling
# them on a clan's host would imply a scope they do not have, and would break the moment that clan
# was renamed or removed.
start=$(date +%s)
code=$(curl -sS -m 900 -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $SECRET" "$BASE/api/cron/$JOB" 2>>"$LOG" || echo 000)

printf '%s job=%-20s status=%s dur=%ss\n' \
  "$(date -u +%FT%TZ)" "$JOB" "$code" "$(( $(date +%s) - start ))" >> "$LOG"

# Keep the log bounded — flush-notifications writes a line every minute.
if [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 10000 ]; then
  tail -n 5000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

# A non-2xx is worth failing on so cron's own mail/journal carries it.
case "$code" in
  2*) exit 0 ;;
  *)  exit 1 ;;
esac
