# Anvil 1.18.3 supporter flair, media, boosts, panel, and feed handoff

Last reconciled: **7 November 2026 (Africa/Cairo)**

This file is the source of truth for the current multi-repository change. It is intentionally detailed so another session can resume without relying on chat history.

## Status legend

- `[x]` Observed as implemented. The surrounding section says whether it is committed Site work or uncommitted local Plugin work.
- `[ ]` Still required before the release is considered complete.
- **LOCAL** means code exists only in the Plugin working tree and has not been committed or pushed.
- **PARTIAL** means some foundation exists, but the reported behaviour is not fully fixed.
- **VERIFY** means code appears present, but the exact in-game/site behaviour still needs a focused check.

## Repository and release state

- Site repository: `Anvil.Site`
  - Branch: `beta`
  - Current commit: `ae979c6a fix: plugin ui banners`
  - `origin/beta` currently points at `ae979c6a`.
  - At reconciliation time, `origin/main` also pointed at `ae979c6a`. Do not run promotion blindly; first determine whether production was already advanced by an earlier operation.
  - The `v1.18.3` tag currently points at `1618fec2`, not the current branch tip.
  - Release note: `releases/1.18.3.md`, configured as a silent release.
- Plugin repository: `Anvil.Plugin`
  - Current working branch: `release/next`.
  - The working tree contains a large uncommitted supporter-flair/panel change across 17 Java/test files.
  - The full Plugin test suite passed after the latest local media changes, but more work below remains.
- Release constraint: no co-author trailer.
- Do not promote until every release-blocking item in this document is checked and both repositories are re-tested.

## Completed Site work already on `beta`

- [x] Add per-character supporter styles.
- [x] Add “same colour for all characters” versus per-character customization.
- [x] Add the initial dark-background contrast adaptation for supporter names.
- [x] Add the initial clan boost gifting fields and staff controls.
- [x] Add total-level icon support to the Site-to-Plugin UI protocol.
- [x] Add player panel media, display-case, and clan-media data to player lookup/profile views.
- [x] Add clan-panel links for weekly members and all-time top accounts.
- [x] Improve the initial clan banner crop/layout.
- [x] Make the 1.18.3 release note silent.
- [x] Add exact `w`/`h` handling to the player and clan Plugin media routes.
- [x] Gate animated profile media to eligible supporter tiers.
- [x] Gate animated clan media by boost level in the media route.
- [x] Increase the Plugin player-card avatar request/render target to 48 px.
- [x] Initial relevant Site tests passed before the latest handoff: image animation, Plugin UI, and supporter media.
- [x] Site build passed for the committed media-route work.

## Plugin work that exists locally but is not released

- [ ] **LOCAL — commit and push only after the remaining fixes are complete.**
- [x] The local implementation contains animated/static supporter name rendering across several game and panel surfaces.
- [x] The local implementation contains compact chat-flair protocol parsing and style-index support.
- [x] The local implementation contains feed icon and activity presentation work.
- [x] The local implementation switches total-level activity rows to `SpriteID.SKILL_TOTAL`.
- [x] The local media client now appends exact `w` and `h` parameters for Plugin media routes.
- [x] A local test currently covers collapsing a failed panel picture.
- [x] `./gradlew test` passed after those local changes.
- [ ] Replace the current failed-image collapse behaviour with hidden-until-success loading, as described below.

---

# Release-blocking implementation checklist

## 1. Supporter and clan-name colours

- [ ] Allow dark and black user-selected colours; do not reject them merely for being dark.
- [ ] Adapt dark colours independently for each background instead of mutating the stored colour.
- [ ] Use readable/lightened output on every dark Plugin side-panel surface, including signed-out/public views.
- [ ] Fix Tracking header name contrast; Lookup currently adapts correctly while Tracking can remain almost black.
- [ ] Fix signed-out Feed name contrast; the same public style must be readable without viewer authentication.
- [ ] Ensure pushed/live feed rows use the same contrast function as initially loaded rows.
- [ ] Apply the same contrast handling to clan names and future custom clan colours.
- [ ] Add a separate Site colour editor for the user’s main Anvil/Discord display name (for example “Ahmed”), while retaining per-RSN character editors.
- [ ] Ensure the active character’s style, not a stale account-wide fallback, is used in the Tracking header.
- [ ] Make Refresh immediately update the Tracking header, You tab, Feed, Lookup, and any visible animated label.
- [ ] Prevent a style refresh from requiring a tab switch before the visible name updates.
- [ ] Ensure other players’ colours work on every client, not only the signed-in user’s own characters.
- [ ] Verify all three known affected external users/characters (Nisbro, Muhammad, and Angerfist) after the refresh/cache fixes.
- [ ] Add clan-boost settings for customizing the clan name colour/gradient.
- [ ] Store custom clan-name colour data in the database with a migration.
- [ ] Include custom clan colour data in public Site pages, Plugin config, Plugin UI JSON, chat/clan interfaces, Lookup, and Feed.
- [ ] Apply static versus animated clan-name styling according to the clan’s effective boost level.

References:

![Original clan-list colours](images/clan-list-name-colors.png)

![Tracking header too dark](images/tracking-dark-name.png)

![Signed-out side-panel colour too dark](images/signed-out-dark-color.png)

![Supporter colour settings](images/supporter-color-settings.png)

![Cross-client colour mismatch](images/cross-client-color-mismatch.png)

![Other player colour missing](images/other-player-color-missing.png)

![You tab retains stale colour until tab switch](images/you-tab-stale-color.png)

## 2. Animation timing and resilient repainting

- [ ] Change **all** supporter/clan gradient animation surfaces to a 5-second cycle.
- [ ] Replace the local chat-specific 3-second constant (`GradientLabel.GAME_CYCLE_MS = 3000`) with 5 seconds.
- [ ] Keep animation phase consistent enough that two clients do not visibly jump when a panel refreshes.
- [ ] Fix clan title animation being overwritten by the game when members join/leave or the clan interface redraws.
- [ ] Reapply the decorated clan title when the game replaces the widget, without requiring a tab switch.
- [ ] Verify static fallback remains stable on parchment and other unsupported/light surfaces.

References:

![Panel animation appeared too fast](images/panel-animation-speed.png)

![Clan title reset to plain after a redraw](images/clan-title-reset-plain.png)

![Expected animated clan title](images/clan-title-animated.png)

## 3. Chat rendering correctness

- [ ] Fix occasional overlap between a decorated name and the chat message text.
- [ ] Make decoration idempotent: repainting an already decorated historical line must not add another star or another name-width shift.
- [ ] Fix the transient two-star state after changing a colour.
- [ ] Clear/rebuild chat decoration state when flair data changes, login state changes, or the active character changes.
- [ ] Refresh historical visible lines when the flair dataset changes; old pre-logout messages and new messages must render identically.
- [ ] Add a small off-screen scroll “runway” so lines just above/below the viewport are decorated before they become visible.
- [ ] Prevent names from snapping into a new colour only after scrolling them fully into view.
- [ ] Retain chat performance by limiting the runway and using cached/idempotent measurements.
- [ ] Add regression tests for duplicate stars, repeated decoration, historical-line refresh, and name/message spacing.

References:

![Name/message overlap](images/chat-overlap.png)

![Old messages broken while new messages are correct](images/chat-old-new-message-mismatch.png)

![Double-star transient after style change](images/chat-double-stars.png)

## 4. Clan and player media entitlement rules

- [ ] Animated clan banner and clan icon/logo require the chosen boosted threshold (current request: Level 2 or higher); below it, serve a static frame.
- [ ] Animated profile/avatar media require the chosen supporter tier (current committed rule: Champion or Patron); lower tiers receive a static frame.
- [ ] Confirm whether a static custom upload remains visible for lower tiers or whether only animation is downgraded. The user’s latest wording implies static media should remain available.
- [ ] Apply identical entitlement rules on Site pages, Plugin Clan, Feed, You, Lookup, and any Discord/render output.
- [ ] On entitlement downgrade, preserve uploaded assets and render them statically rather than deleting them.
- [ ] On later re-upgrade, resume animation without requiring a re-upload.
- [ ] Verify supporter tier loss/downgrade preserves colour settings and uploads while disabling only unavailable animated benefits.
- [ ] Verify a temporary Patron upgrade does not cancel/deactivate the user’s paid Supporter subscription.

## 5. Media loading, updates, caching, and visual quality

- [ ] Do not show an image and then instantly hide it.
- [ ] Start panel media hidden/collapsed and reveal it only after successful decode.
- [ ] Keep failed media collapsed without leaving a black rectangle or layout hole.
- [ ] Update the existing `UiViewTest` placeholder expectation to the hidden-until-success behaviour.
- [ ] Render circular profile images through an anti-aliased off-screen mask so the edge is smoothly rounded.
- [ ] Fix animated clan banner/icon and user banner/avatar disappearing after the initial frame/load.
- [ ] Verify the exact-size `w`/`h` route change fixes animated GIF rejection in the Plugin.
- [ ] Add media revision/cache-busting data so replacing an upload changes the Plugin UI JSON/URL.
- [ ] Include entitlement/boost state in the clan media cache key so a static cached response cannot survive an upgrade to Level 2/3.
- [ ] Clear in-memory thumbnail/UI caches on manual Refresh.
- [ ] Make manual Refresh redraw the current tab even when its structural JSON is otherwise unchanged.
- [ ] Make banner/icon/profile updates arrive automatically on the normal polling interval.
- [ ] Ensure old Plugin clients continue to receive a usable static image.
- [ ] Make the Plugin banner crop match the Site profile’s focal area as closely as the narrow panel allows.
- [ ] Fix banner, clan icon, and Feed header alignment.
- [ ] Keep the clan icon visible after initial Feed/Lookup rendering instead of showing and immediately hiding it.
- [ ] Confirm animated banner playback works in Clan, Feed, You, and Lookup, not only the Site.

References:

![Rough avatar clipping and hidden banner](images/profile-avatar-clipping.png)

![Site member profile as the intended media source](images/site-member-profile.png)

![Clan home currently shows the animated upload as static](images/clan-home-static-banner.png)

![Old Plugin displayed the media statically](images/old-plugin-feed-media.png)

![Old Plugin player media layout](images/old-plugin-player-view.png)

![Old Plugin lookup media layout](images/old-plugin-lookup.png)

![Clan home banner layout needing polish](images/clan-home-banner-layout.png)

![Feed banner and icon alignment](images/feed-banner-alignment.png)

## 6. Upload limits and server-side processing

- [ ] Confirm final raw upload limit; the user questioned whether 2 MB is too large.
- [ ] Keep separate sensible limits for avatar/icon versus banner if appropriate.
- [ ] Process uploads server-side with Sharp or the existing media pipeline.
- [ ] Strip unnecessary metadata.
- [ ] Resize/crop to the actual profile/panel aspect ratios.
- [ ] Optimize static images.
- [ ] Optimize animated images while preserving animation when entitled.
- [ ] Reject decompression bombs, unreasonable dimensions/frame counts, and unsupported formats.
- [ ] Document the accepted formats, dimensions, and post-processing behaviour in the upload UI.
- [ ] Support both static and animated banner/image uploads.

## 7. Clan boost gift semantics

- [ ] Replace “minimum gifted tier” display semantics with dynamic platform boost contribution.
- [ ] Store/retain the target gifted tier and expiry/indefinite state.
- [ ] Compute platform boosts as the number missing from the target threshold.
- [ ] Example: 3 organic of 8 required means 5 platform boosts.
- [ ] Example: if an organic boost disappears and the clan has 2, platform contribution becomes 6.
- [ ] Example: if organic boosts rise to 4, platform contribution falls to 4.
- [ ] Never let platform contribution crowd out real boosts; it must shrink as real boosts arrive.
- [ ] If real boosts naturally exceed the gifted target, use the naturally earned higher state.
- [ ] Make progress bars/counts use the effective total, while retaining the organic count internally.
- [ ] Expose organic count, platform-gift count, effective count, target tier, and expiry in the boost summary API.
- [ ] Show the platform contribution publicly in the Boosters section.
- [ ] Show clan admins who boosted and which boosts came from the platform.
- [ ] Keep real booster names/counts and first-booster/level-up badges accurate.
- [ ] Make the gifted contribution expire cleanly and fall back to the organic/grace state.
- [ ] Add tests for real boosts increasing, decreasing, exceeding target, expiry, indefinite gifts, and grace interactions.

Reference:

![Current inconsistent gifted Level 3 badge with organic progress](images/boosters-gift-count.png)

## 8. Temporary supporter benefit upgrades

- [ ] Add a staff operation to grant a higher benefit tier for a fixed period or indefinitely.
- [ ] Keep the underlying paid subscription active and charged at its original tier.
- [ ] Model the grant as an overlay/effective tier, not a replacement subscription.
- [ ] On grant expiry/removal, restore the paid tier automatically.
- [ ] Preserve stored colours, animations, and uploads through a downgrade; only gate their active use.
- [ ] Show paid tier, temporary effective tier, grant source, and expiry clearly to staff.
- [ ] Add audit logging and tests for expiry, cancellation, paid upgrade/downgrade during a grant, and subscription loss.

## 9. Side-panel layout and navigation

- [ ] Improve the narrow clan banner crop and header spacing.
- [x] Add links under “This week” to the clan members page.
- [x] Add links under “Top accounts” to an all-time/appropriate filtered ranking.
- [ ] Verify those links route to the intended clan and filter.
- [ ] Make the clan name/icon in a player profile clickable.
- [ ] Clicking it must switch to Lookup → Clans, search the exact clan, and open that clan’s page.
- [ ] Apply the click target in You and player Lookup views.
- [ ] Keep the narrow panel content aligned with the small clan icon.
- [ ] Improve the player Lookup top layout and broken-media fallback.
- [ ] Ensure Site player-profile presentation and Plugin player lookup share the same media and entitlement rules.

References:

![Player lookup layout](images/player-lookup-layout.png)

![Expected clan-name click target](images/player-clan-link-target.png)

## 10. Activity Feed wording and iconography

- [ ] Replace raw game-message achievement wording with concise activity copy.
- [ ] Total-level example: “375 total” (or “Reached 375 total”), not the full game chat sentence.
- [ ] Strip the literal `Quest:` prefix.
- [ ] Use a quest icon for quests.
- [ ] Use the correct diary icon for achievement diaries.
- [ ] Use combat-achievement icons/tier presentation for combat achievements.
- [ ] Improve normal-feed combat-achievement wording such as Grandmaster/Master task lines.
- [ ] Improve collection-log slot wording and use the actual item/log icon.
- [ ] Use the relevant skill icon for skill levels.
- [ ] Use the total-level icon for total milestones and maxed/total-level activities.
- [ ] Fix the reported missing total icon in the Feed.
- [ ] Use single item-scale icons for collection-log and drop rows.
- [ ] Reserve four-times/large icons for boss/event presentation where intentionally designed.
- [ ] Confirm item-ID/icon-code resolution for Zorya’s tome and similar collection-log items.
- [ ] Keep deaths visually distinct and concise.

References:

![Raw achievement wording](images/feed-achievement-wording.png)

![Combat achievement rows](images/feed-combat-achievements.png)

![Collection-log slot wording](images/feed-log-slots.png)

![Oversized Discord drop icon](images/discord-drop-icon-scale.png)

![Skill and total-level icon requirements](images/feed-skill-icons.png)

![Missing total-level icon](images/total-level-icon-missing.png)

## 11. Player lookup/profile completeness

- [x] Initial player media and display-case data are present in the Site Plugin-UI response.
- [ ] Ensure player Lookup contains the player’s banner, avatar, display case, supporter style, clan, collection log, latest activity, and skills consistently.
- [ ] Ensure You and Lookup share components/behaviour where the content is identical.
- [ ] Fix stale supporter colour after Refresh while remaining on You.
- [ ] Verify public/signed-out lookup has readable adaptive names.
- [ ] Verify avatar/banner use animated or static variants based on entitlement.
- [ ] Verify no content jumps when the media finishes loading.

## 12. Display-case “Verified in log” link

- [ ] Fix the dead-end URL currently shaped like `/p/Drenvox?tab=collection&page=Chambers%20of%20Xeric`.
- [ ] Determine and use the canonical player collection-log route/tab/query.
- [ ] Ensure the link selects the intended collection-log page/category.
- [ ] Add a route/link regression test.

## 13. BOTW zero-KC board membership

- [ ] Fix the Plugin saying “not on the board yet” when the player appears in standings with `+0 kc`.
- [ ] Treat an enrolled/standing row with zero gain as on the board.
- [ ] Do not use positive gain as the membership test.
- [ ] Normalize the current RSN consistently when matching the player’s standing.
- [ ] Add tests for enrolled zero, enrolled positive, genuinely absent, and renamed/case-varied players.

References:

![False not-on-board chat message](images/botw-zero-kc-false-negative.png)

![Board standings include Drenvox with zero KC](images/botw-board-zero-kc.png)

## 14. Game interfaces and dialogue names

- [ ] Extend supporter/clan name colouring to player-name titles in quest dialogue and general dialogue interfaces where safe.
- [ ] Use RuneLite gameval interface/widget constants rather than magic IDs.
- [ ] Whitelist only name/title widgets; do not recolour arbitrary dialogue body text.
- [ ] Keep NPC names and game-authored semantic colours intact unless they exactly represent a styled player.
- [ ] Restore original widget text/colour when an interface closes, flair expires, or the Plugin disables.
- [ ] Add tests for supported dialogue roots and safe no-op behaviour.

## 15. Compact chat-flair endpoint scalability

- [x] The endpoint already uses a compact style table plus a names array and style-index array (`styles`, `names`, `ix`) instead of repeating full style objects per character.
- [ ] Measure raw and Brotli/gzip sizes at 5,000 supporters and up to 10 characters each.
- [ ] Confirm HTTP compression, ETag/conditional requests, and cache headers are enabled.
- [ ] Avoid downloading unchanged payloads.
- [ ] Consider a revision/delta endpoint only if compressed full-payload measurements justify the extra complexity.
- [ ] Document the compact field names for maintainers:
  - `v`: schema/revision version.
  - `styles`: deduplicated colour/gradient style table.
  - `c`: static/base colour.
  - `g`: gradient stops.
  - `s`: supporter/star eligibility flag.
  - `names`: normalized character names.
  - `ix`: style-table index corresponding to each name.
- [ ] Add payload-shape and index-alignment tests.

Reference:

![Compact v13 chat-flair JSON](images/chat-flair-v13-json.png)

---

# Verification checklist

## Site

- [ ] Run focused unit tests for supporter style, media animation, profile media, Plugin UI views, clan boosts, boost summaries, and links.
- [ ] Run database-backed Plugin UI tests with the required local DB/network permission.
- [ ] Run lint.
- [ ] Run a clean production build.
- [ ] Inspect the relevant pages at desktop and narrow widths.
- [ ] Verify signed-in and signed-out rendering.
- [ ] Verify low-tier, Champion, Patron, and expired/downgraded states.
- [ ] Verify clan organic Level 0/1/2/3 and gifted Level 1/2/3 states.

## Plugin

- [ ] Add/update unit tests for every regression above.
- [ ] Run `./gradlew test` after the final code changes.
- [ ] Offer `./gradlew run` for user-controlled in-game verification; the user must log in manually.
- [ ] Test two clients at once with different signed-in accounts.
- [ ] Test another player’s flair, the current user’s flair, historical messages, relogging, and scrolling.
- [ ] Test clan member join/leave while the clan interface is open.
- [ ] Test static and animated player/clan media before and after Refresh.
- [ ] Test a media update made on the Site while the Plugin remains open.

## Release

- [ ] Review `git diff` in both repositories for accidental/unrelated changes.
- [ ] Confirm the actual Site production state because `origin/main` and `origin/beta` currently point at the same commit.
- [ ] Resolve the `v1.18.3` tag position before any new promotion.
- [ ] Commit Site changes without a co-author trailer.
- [ ] Push Site `beta` and verify its deployment workflow.
- [ ] Commit Plugin changes without a co-author trailer.
- [ ] Push the intended Plugin release branch.
- [ ] Promote Site 1.18.3 only if production is not already at the desired commit.
- [ ] Confirm the release remains silent.
- [ ] Smoke-test production API media, chat-flair payload, Site profile, clan boosts, and Plugin UI.

## Definition of done

- [ ] Every release-blocking item above is checked or explicitly deferred by the user in this file.
- [ ] No image/name flashes from visible to hidden.
- [ ] No duplicate stars, overlap, stale colours, or clan-title resets remain.
- [ ] Dark colours are readable everywhere without changing the user’s saved design.
- [ ] Gifted boosts dynamically fill only the gap to the target tier.
- [ ] Animated media obeys entitlement rules and static fallback remains available.
- [ ] Site and Plugin tests/builds pass.
- [ ] Beta is verified before any production action.

