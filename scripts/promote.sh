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

# PRODUCTION ONLY SHIPS AS A RELEASE. The newest releases/<version>.md on beta that has no v<version>
# tag yet is what this promotion ships; without one, nothing goes out. The note is user-facing (what
# players can now do, what got better, what got fixed) and the owner approves it, so this asks a
# person at the keyboard to type the version back before anything is pushed.
git fetch -q --tags "$REMOTE"
RELEASE=""
for f in $(git ls-tree --name-only "$BETA" releases/ 2>/dev/null | sed -n 's#^releases/\([0-9]*\.[0-9]*\.[0-9]*\)\.md$#\1#p' | sort -t. -k1,1nr -k2,2nr -k3,3nr); do
  if ! git rev-parse -q --verify "refs/tags/v$f" >/dev/null; then RELEASE="$f"; break; fi
done
if [ -z "$RELEASE" ]; then
  echo "Refusing: production only ships as a release, and beta has no new release note." >&2
  echo "  Write releases/<next version>.md on beta (see releases/README.md), get it approved, then promote." >&2
  exit 1
fi
NOTE="$(git show "$BETA:releases/$RELEASE.md" | node --experimental-strip-types scripts/check-release.mts)" || exit 1

echo "Release $RELEASE — this is what players will read:"
echo
echo "$NOTE" | sed 's/^/  /'
echo
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

# The owner's yes, at the keyboard. No terminal (a script, an agent) means no release.
if [ ! -r /dev/tty ]; then
  echo "Refusing: shipping a release needs a person at the keyboard to approve it." >&2
  exit 1
fi
printf 'Type %s to ship this release: ' "$RELEASE" > /dev/tty
read -r CONFIRM < /dev/tty
if [ "$CONFIRM" != "$RELEASE" ]; then
  echo "Not shipped." >&2
  exit 1
fi

# The tag first, so the production build describes itself as this version.
git tag -a "v$RELEASE" "$BETA" -m "Anvil $RELEASE"
git push "$REMOTE" "refs/tags/v$RELEASE"
git push "$REMOTE" "$BETA:refs/heads/main"
echo
echo "Pushed v$RELEASE. CI will retag the image beta tested and deploy anvilosrs.com; the build"
echo "announces the release once it is live (#anvil-announcements, clans' Anvil updates, /changelog)."
echo "Watch: gh run list --repo AhmedFathy2001/anvil --limit 2"
