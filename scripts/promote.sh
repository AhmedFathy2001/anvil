#!/bin/sh
# Promote what beta is running to production.
#
# The whole flow, so it does not live in anyone's memory:
#
#   work  →  push to beta  →  CI builds, deploys beta.anvilosrs.com
#         →  look at it
#         →  scripts/promote.sh  →  fast-forwards main to that commit
#         →  CI RETAGS the image beta was tested on and deploys anvilosrs.com
#
# Production therefore runs the exact bytes beta ran, not a rebuild of the same source. That is why
# this insists on a fast-forward: if main has drifted, the commit beta tested is not the commit main
# would end up at, and the guarantee is gone. Merge it yourself and push beta again rather than
# letting this paper over it.
#
#   scripts/promote.sh            # promote whatever beta is at
#   scripts/promote.sh --dry-run  # say what it would do
set -eu

DRY=""
[ "${1:-}" = "--dry-run" ] && DRY=1

REMOTE="${ANVIL_REMOTE:-origin}"
git fetch -q "$REMOTE" main beta

BETA="$(git rev-parse "$REMOTE/beta")"
MAIN="$(git rev-parse "$REMOTE/main")"

if [ "$BETA" = "$MAIN" ]; then
  echo "Nothing to promote — main is already on $(git rev-parse --short "$BETA")."
  exit 0
fi

# Fast-forward only. Anything else means main has commits beta does not, and promoting would either
# lose them or produce a merge nobody tested.
if ! git merge-base --is-ancestor "$MAIN" "$BETA"; then
  echo "Refusing: main is not an ancestor of beta, so this would not be a fast-forward." >&2
  echo "  main $(git rev-parse --short "$MAIN") has $(git rev-list --count "$BETA..$MAIN") commit(s) beta lacks." >&2
  echo "  Merge main into beta, push beta, let it deploy, then promote." >&2
  exit 1
fi

echo "Promoting $(git rev-parse --short "$MAIN") -> $(git rev-parse --short "$BETA")"
echo
git --no-pager log --no-merges --format='  - %s' "$MAIN..$BETA"
echo

# Is beta actually serving this commit? Promoting something beta never ran defeats the point of
# having a beta. A warning rather than a refusal: the check depends on the host being reachable, and
# a network blip is not a reason to block a release.
LIVE="$(curl -sS -m 10 https://beta.anvilosrs.com/api/version 2>/dev/null | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p' || true)"
if [ -z "$LIVE" ]; then
  echo "! Could not reach beta.anvilosrs.com to confirm what it is running."
elif [ "$LIVE" != "$BETA" ]; then
  echo "! beta is serving $(echo "$LIVE" | cut -c1-8), not $(echo "$BETA" | cut -c1-8) — its deploy may still be running."
else
  echo "beta is serving this commit."
fi
echo

if [ -n "$DRY" ]; then
  echo "(dry run — nothing pushed)"
  exit 0
fi

git push "$REMOTE" "$BETA:refs/heads/main"
echo
echo "Pushed. CI will retag the image beta tested and deploy anvilosrs.com."
echo "Watch: gh run list --repo AhmedFathy2001/anvil --limit 2"
