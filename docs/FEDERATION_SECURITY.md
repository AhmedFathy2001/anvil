# Anvil Federation — Security Model & Hardening

Federation lets independently-operated clan servers exchange identity and data. Some of those servers
are **self-hosted by people we don't control**, and even the ones we run must not be able to abuse a
connection into another clan. This doc is the threat model + the mitigations every component must
implement. It is normative: the hardening pass verifies against it.

## Governing principle

> **Least privilege, bounded blast radius.** Every party can do only what it is explicitly
> authorized to do, and a compromised or malicious party at any tier can harm **only itself and its
> own consenting members** — never another clan, another clan's members, or the network.

This applies to **trusted (hosted) homes too**: holding a member's connection to another clan grants
*exactly* "act as that one member, within that member's own scope, on that one clan" — nothing more.

## Trust tiers

| Tier | Trusted for | NOT trusted for |
|---|---|---|
| **Broker** (Anvil control plane) | Identity authority (signs assertions), directory | Being in the data hot path |
| **Hosted home** (Anvil-run site) | Its own clan's data; vouching for **its own** members | Acting beyond a member's own scope on *other* clans |
| **Self-hosted site** | Its own clan's data; its own members' actions **on its own clan** | Vouching for identity; **writing** to other clans; being connected to without guards |
| **Plugin / member** | Submitting its own player's events to its home | Reaching arbitrary hosts (default path = home site only) |

Concretely: **self-host = read-only in the mesh** (display + be-a-member), never an identity voucher
(`/vouch` is hosted-only → 403) and never a cross-clan **writer**. Cross-clan credit **writes** relay
only between **trusted (hosted)** homes.

---

## 1. SSRF — every server→server call

Boundaries where a server dials a URL that an *untrusted* party influences: broker→clan (register
verification), home→clan (`/exchange`, `/board`, `/activity`, `/events`).

**Required at EVERY outbound call** (not just at registration — defense in depth):
- **HTTPS only**; reject `http`, embedded credentials, non-standard ports.
- **Resolve once, then pin the socket to the validated IP** (no re-resolution) → closes DNS-rebind TOCTOU.
- **Reject** private / loopback / link-local / CGNAT / IPv4-mapped-IPv6 / metadata (`169.254.169.254`) addresses — check **every** resolved A/AAAA.
- **No redirects** (`redirect: manual`; treat 3xx as failure).
- **Timeout** (~5s) and **response size cap** (~256 KB for board/activity) and **Content-Type** check (`application/json`).
- One shared `guardedFetch` helper; forbid raw `fetch`/`axios` to any federation-supplied URL in review.

The broker already guards `/register`; the **home site must apply the same guard to its own outbound
clan connections** — it does not get to trust the directory blindly.

## 2. XSS / injection — untrusted clan data reaching a render surface

Any string that originated on *another* clan (clan name, event name, tile label, activity line,
player name) is **untrusted input**, even from a "trusted" home — it may have been supplied by a
self-host upstream.

- **Web (React):** rely on default escaping; **ban `dangerouslySetInnerHTML`** on any federated
  field. No building HTML from clan strings.
- **Plugin (Swing):** render federated strings as **plain text** only — never as HTML in `JLabel`
  (`JLabel` renders `<html>`!) → prefix-guard or strip leading `<html`, or set text via a
  non-HTML path. No `putClientProperty("html.disable")` reliance; sanitize explicitly.
- **Discord notifications:** strip/escape markdown and **neutralize mentions** (`@everyone`, `<@…>`,
  role pings) in any federated text before posting — a rogue clan must not make your bot ping.
- **Length + shape caps:** clamp every federated string (e.g. names ≤ 64, labels ≤ 128) and array
  (e.g. ≤ N tiles/clans) **before** store/relay/render. Validate the JSON shape (zod/schema); drop
  unknown fields.

## 3. Identity & authorization (including trusted-home abuse)

- **Only the broker asserts identity** — Ed25519-signed, `aud`-pinned, 60 s, single-use `jti`.
  Self-host cannot vouch (hosted-only). Device-code makes the member prove identity on the **broker's**
  domain, so a self-host home cannot forge who its member is.
- **Tokens are minted per (member, clan) by the clan itself**, scoped to **`board:read` + `events:write`
  only** — never admin, never roster, never another member. So a home relaying for a member can do no
  **more** than that member could by playing on that clan directly.
- **The receiving clan never trusts the relay — only the token + the submission content.** Every
  relayed write is re-validated by the receiving clan against its OWN rules: event membership, tile
  validity, **proof requirements**, amount/threshold checks, `sharedCredit`/`exclusive`. A relay
  cannot bypass a clan's proof-required tile.
- **Bounding a rogue *trusted* home** (it can at worst spam its own member's normal actions on that
  member's own clans):
  - **Rate-limit relayed writes** per `(member, target clan)`.
  - **Tag federated/relayed submissions** as such → auditable and **reversible** by the receiving clan.
  - **Per-clan opt-out:** a clan may refuse relayed credits, or require proof for any federated credit.
  - **Revocation:** the member *and* the target clan's admin can revoke a connection; tokens are
    short-TTL + revocable, killing a misbehaving relay immediately.
- **Self-host writes are refused outright** at the trust boundary — a self-host home is read-only for
  other clans (§ trust tiers), so the "rogue home" write-abuse case is limited to hosted homes we run.

## 4. Token & secret handling

- Remote-clan tokens are **server-side only** — never sent to the plugin; the broker URL and all clan
  URLs also stay server-side. The plugin's default path knows one host: its own.
- **Encrypt cached tokens at rest**; short TTL + refresh; **revoke on disconnect / member request /
  target-admin action**.
- Broker signing key: private key only in the broker's secret store, rotate via JWKS `kid`.
- Session/derived secrets: the three control-plane sessions stay isolated (own name + own secret +
  own purpose tag); the hosted vouch credential is derived, constant-time compared, never stored.

## 5. Availability / DoS

- **Timeout + isolate every cross-clan call** — one slow/malicious clan must not hang the home site,
  block `/state`, or stall the sidebar. Circuit-break a repeatedly-failing clan.
- **Rate-limit** `/device/start`+`/poll`, `/connect`, `/vouch`, `/assert`, `/exchange`, and relayed writes.
- Keep the **broker out of the hot path** (connect-only) so it can't become a network-wide bottleneck
  or single point of failure for board reads / credits.

## 6. Plugin surface

- Default path = **one configured host** (home site); no arbitrary outbound → no surprise IP exposure,
  and the plugin-hub posture is unchanged.
- Board/activity data is **JSON-parsed only** — no `eval`, no reflective/gadget deserialization.
- Render federated strings as **plain text** (see §2 Swing note).
- The `verificationUrl` the plugin opens for self-host login should be validated **https + known broker
  host** before `LinkBrowser.browse`.

---

## Per-boundary checklist (what the hardening pass verifies)

| Boundary | AuthN | Guards |
|---|---|---|
| plugin → home site | member account token | member-scoped; home never leaks broker/clan URLs or tokens |
| home → broker `/vouch` | derived hosted credential (constant-time) | **hosted-only**; self-host → 403 |
| home ↔ broker `/device/*`,`/assert` | broker member session (device-code) | member proved identity on broker domain |
| home → clan `/exchange` | broker assertion | §1 SSRF guard; assertion re-validated by clan |
| home → clan `/board`,`/activity` | clan token (`board:read`) | §1 SSRF guard; §2 validate + cap + escape |
| home → clan `/events` (relay) | clan token (`events:write`) | trusted-home only; clan re-validates + proof + rate-limit + tag |
| broker → clan `/.well-known` | none (registration) | §1 SSRF guard; domain-ownership proof |

## Priority for the hardening pass
1. **Restrict cross-clan credit writes to trusted (hosted) homes** — the one gap that lets a rogue party affect *other* clans.
2. **`guardedFetch` on every home→clan outbound** (SSRF).
3. **Validate/cap/escape all federated data** before store/relay/render (XSS + DoS).
4. Encrypt cached tokens at rest; tag + rate-limit + opt-out for relayed writes.
