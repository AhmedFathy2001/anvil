# Release notes

Production only ships as a release. `scripts/promote.sh` refuses to push to production unless beta
carries a new `releases/<version>.md` (one with no `v<version>` tag yet), shows it, and asks the
owner to type the version back. Once the production build is live it announces the release once:
#anvil-announcements, every clan's "Anvil updates" channel, /changelog, and a one-time line in the
plugin at each player's next login. Beta never announces anything.

**Nothing ships or announces without the owner's approval of that exact note.**

## Who reads this

Players and clan leaders. Write what they can now do, what got better and what got fixed, in plain
words. Not for: internal reasons, business goals ("nudge", "conversion", "make people pay"), file
names, PR numbers, commit speak, or anything not live yet.

One release covers the site **and** the plugin. Mark plugin-only lines with `[Plugin]`. Set
`plugin:` only when that plugin version is live on the RuneLite plugin hub.

## Silent releases

Add `silent: true` to the front matter to ship a release without posting it anywhere (Discord, clans'
Anvil updates, /changelog, the plugin's login line). It goes out with the next release that isn't
silent, oldest first, or when staff press **Announce now** on /staff/releases.

## Format

```
---
version: 1.15.0
title: In-game chat feed and a clan page worth visiting
plugin: 1.15.0
---
## Highlights
- One line each: the two or three things worth knowing.

## New
- [Plugin] Big drops from other players on your board show in your chat while you play.

## Improved
- Clan pages show what's live and let visitors open it.

## Fixed
- Countdowns over a day read "4d 4h" instead of "100:15:48".
```

Sections are optional, but there has to be at least one line under Highlights, New, Improved or
Fixed. Check a file with `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-release.mts < releases/1.15.0.md`.
