# Release notes

Production only ships as a release. `scripts/promote.sh` refuses to push to production unless beta
carries a new `releases/<version>.md` (one with no `v<version>` tag yet), shows it, and asks the
owner to type the version back. Once the production build is live it announces the release once:
#anvil-announcements, every clan's "Anvil updates" channel, /changelog, and a one-time line in the
plugin at each player's next login. Beta never announces anything.

A release file has two parts with two audiences:

- **News**: what gets *announced*. A few short sentences in Discord (#anvil-announcements, each
  clan's "Anvil updates") and the plugin's login line, with a link to the full notes:
  `Full changelog: https://anvilosrs.com/changelog#v<version>`.
- **Highlights / New / Improved / Fixed**: the detailed changelog. It lives on /changelog only and
  never goes to Discord or the plugin.

**Nothing ships or announces without the owner's approval of that exact note.**

## Who reads this

Players and clan leaders. Write what they can now do, what got better and what got fixed, in plain
words. Not for: internal reasons, business goals ("nudge", "conversion", "make people pay"), file
names, PR numbers, commit speak, or anything not live yet.

One release covers the site **and** the plugin. Mark plugin-only lines with `[Plugin]`. Set
`plugin:` only when that plugin version is live on the RuneLite plugin hub.

## News: what gets announced

Write it for a player or clan leader scrolling Discord: what they will notice, why it matters, where
to try it. Two to four sentences, plain words. No jargon, no version talk, no fix lists.

```
## News
Your clan page now shows what's on right now, so visitors can jump straight into a live board.
Open it from your clan's home page; there's nothing to set up.
```

Not this: "Refactored clan home; fixed 6 bugs; improved perf of /c/[slug]."

- Paragraphs are plain lines; a blank line starts a new one. `news: <one sentence>` in the front
  matter works too, for a one-liner.
- Under News, optional short lists `### New`, `### Improved`, `### Fixed` hold the few items worth
  announcing (they are merged across releases, see below). Keep the long lists for the changelog.
- No News? The announcement falls back to the Highlights, then to the first three New lines. It
  never uses Fixed.
- `whats_new: true` in the front matter adds a "What's new for you" link to /whats-new, when that
  page has an entry for this release.

### Several releases at once

Releases that ship close together (1.19.1, 1.19.2, 1.19.3) go out as **one post** covering everything
since the last *announced* version, headed by the newest ("Anvil 1.19.3: …") and linking its card on
/changelog. Their News is merged into one list and repeats are shown once (an item improved twice
shows once). The post must never read "1.19.1 broke it, 1.19.2 fixed it", so mark a fix with the
version the bug came from:

```
### Fixed
- Boost badges show on every clan page again. (from 1.19.1)
```

If that version was never announced (it is in the same batch), the item is left out of the post.
If it was (players saw it), the fix is news and stays. The marker is never shown to players; on
/changelog it reads as a small "follow-up to 1.19.1" note. Markers work in the detailed `## Fixed`
list too.

`scripts/promote.sh` shows the bundled post word for word, the plugin line, and every included
version's full changelog, so the owner approves exactly what goes out.

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
## News
Big drops from your clan now pop up in your game chat while you play a board, so nobody misses the
moment. Clan pages also show what's live, and visitors can open it in one click.

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
Fixed (News alone is not a changelog). Check a file, and see what it would announce, with
`node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-release.mts < releases/1.15.0.md`,
or a batch since the last announced version with `… scripts/check-release.mts releases 1.19.3 1.19.0`.
