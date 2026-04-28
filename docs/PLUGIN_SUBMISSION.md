# Publishing to the RuneLite Plugin Hub

Follow these steps to get Anvil listed on the [RuneLite Plugin Hub](https://runelite.net/plugin-hub).

## 1. Push the plugin to its own public repository

The Plugin Hub references plugins by git URL. The `plugin/` folder here should
be pushed to a dedicated public repo (e.g. `github.com/AhmedFathy2001/anvil-plugin`)
with these files at the root:

```
build.gradle
settings.gradle
gradlew / gradlew.bat / gradle/
runelite-plugin.properties
README.md
LICENSE
src/
```

Tag the commit you want the Hub to install from:

```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
git rev-parse HEAD   # ← copy this SHA for step 3
```

## 2. Fork the plugin-hub repo

Fork https://github.com/runelite/plugin-hub and clone your fork.

## 3. Add the plugin manifest

Create a file at `plugins/anvil` (no extension) with this content, replacing
`<commit-sha>` with the SHA from step 1:

```
repository=https://github.com/AhmedFathy2001/anvil-plugin.git
commit=<commit-sha>
authors=AhmedFathy2001
tags=bingo,overlay,drops,loot,clan,event,screenshot
description=Companion plugin for the Anvil clan-events platform — codeword overlay, drop auto-submit, clan roster sync, weekly auto-enroll.
unethical=false
disableOnUpdate=false
```

Commit with a message like `New plugin: anvil`.

## 4. Open a PR against runelite/plugin-hub

A bot and maintainers will review. Expect feedback on:

- **Code style** (checkstyle / tabs, imports, no wildcard imports).
- **No external tracking** — plugin may only talk to user-configured hosts.
- **No auto-updating** from outside sources.
- **No credentials embedded in the jar.**

All four apply to this plugin. The only host contacted is the `Site URL` the
user configures, and the player token is stored via RuneLite's normal config
system (marked `secret = true`).

## 5. Bumping versions

After the PR is merged, future releases only require:

1. Push new commits to the plugin repo.
2. Tag a new commit.
3. Open a one-line PR against plugin-hub that updates the `commit=` line for
   `plugins/anvil`.

---

## Pre-submission checklist

- [x] `runelite-plugin.properties` — displayName, author, tags, plugins
- [x] `README.md` — user-facing setup and feature docs (including admin link flow)
- [x] `LICENSE` — BSD-2 (Plugin Hub compatible)
- [x] `build.gradle` — RuneLite client `compileOnly`, JDK 11 target
- [x] Handles `NpcLootReceived`, `LootReceived`, `PlayerLootReceived` with a 3s dedup window
- [x] Debounced config refresh (30s), exponential backoff on submission retry
- [x] Offline persistence of pending submissions across restarts
- [x] Secret-flagged `playerToken` and `adminPluginToken` config fields
- [x] Manual-submit fallback UI for drops auto-detect misses
- [x] Admin link flow — one-time 6-char code exchange, admin-token-gated actions
- [x] Weekly auto-enrollment attempted once per login, resettable on `LOGIN_SCREEN`
- [x] Clan roster scrape reads `ClanSettings`/`ClanMember` on the client thread, posts on executor
- [x] `plugin/hello` fires 3 s after `GameStateChanged → LOGGED_IN` so local player name is populated
- [x] All outbound requests go to the user-configured Site URL only
- [ ] Plugin repo pushed to `github.com/<you>/anvil-plugin` (do this next)
- [ ] Tagged release on that repo (e.g. `v1.0.0`)
- [ ] PR opened against `runelite/plugin-hub` with `plugins/anvil` manifest

## Ship-it runbook

```bash
# From the anvil-plugin repo (NOT from inside the site monorepo):
./gradlew clean build                  # sanity-check the jar still compiles
git tag -a v1.0.0 -m "Initial release"
git push origin main
git push origin v1.0.0
git rev-parse HEAD                     # record this SHA

# Then in your fork of runelite/plugin-hub:
cat > plugins/anvil <<'EOF'
repository=https://github.com/<you>/anvil-plugin.git
commit=<paste the SHA>
authors=<you>
tags=bingo,overlay,drops,loot,clan,event,screenshot
description=Companion plugin for the Anvil clan-events platform — codeword overlay, drop auto-submit, clan roster sync, weekly auto-enroll.
unethical=false
disableOnUpdate=false
EOF
git add plugins/anvil
git commit -m "New plugin: anvil"
git push
# Open PR against runelite/plugin-hub main
```
