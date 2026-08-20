#!/bin/sh
# Run the test suites ONE AT A TIME.
#
# `npm test` fans out across all of them and each DB-backed suite stands up its own Postgres
# database and pool; together that exhausts memory on Ahmed's machine. Sequential is slower and
# finishes.
#
#   run-suites.sh              every suite
#   run-suites.sh a b c        just those (substring match on the filename)
set -eu
cd "$(dirname "$0")/.."

pass=0
fail=0
failed=''

for f in tests/*.test.ts; do
  name=$(basename "$f" .test.ts)
  if [ $# -gt 0 ]; then
    match=0
    for want in "$@"; do
      case "$name" in *"$want"*) match=1 ;; esac
    done
    [ "$match" = 1 ] || continue
  fi

  # A few suites test pure functions from modules that import @/db at load, which reads
  # DATABASE_URL and throws if it is absent. They never connect — the placeholder just has to exist.
  out=$(DATABASE_URL="${DATABASE_URL:-postgres://unused@127.0.0.1:1/unused}" npx tsx --test "$f" 2>&1) || true
  if printf '%s' "$out" | grep -qE '^# fail 0'; then
    pass=$((pass + 1))
    printf '  ok    %s\n' "$name"
  else
    fail=$((fail + 1))
    failed="$failed $name"
    printf '  FAIL  %s\n' "$name"
    printf '%s\n' "$out" | grep -E 'not ok|AssertionError|Error:' | head -4 | sed 's/^/          /'
  fi
done

printf '\n  %s passed, %s failed\n' "$pass" "$fail"
[ -n "$failed" ] && printf '  failed:%s\n' "$failed"
exit 0
