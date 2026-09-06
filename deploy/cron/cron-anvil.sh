#!/bin/sh
# Box cron -> the site, directly. Install to /opt/anvil/cron-anvil.sh, chmod 755.
#
# There is no dispatcher any more: it existed to fan a job out across one container per clan, and one
# database now holds every clan. Each job runs ONCE, total. This is the exact script the box runs;
# deploy.sh does not install it, so after editing here, copy it to the box by hand (see README).
LOG=/opt/anvil/cron.log
job="$1"
S=$(grep -m1 "^CRON_SECRET=" /opt/anvil/site.env | cut -d= -f2-)
start=$(date +%s)
code=$(curl -sS -m 900 -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $S" "https://anvilosrs.com/api/cron/$job" 2>>"$LOG" || echo 000)
printf "%s job=%s status=%s dur=%ss\n" "$(date -u +%FT%TZ)" "$job" "$code" "$(( $(date +%s) - start ))" >> "$LOG"
if [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 10000 ]; then
  tail -n 5000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
