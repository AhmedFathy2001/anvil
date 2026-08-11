# Joining the Anvil ecosystem (anvilosrs.com)

This is the plain-language guide to plugging a **self-hosted** Anvil instance into
the shared network at `anvilosrs.com`. For the exact API, see the contract in
[`FEDERATION.md`](./FEDERATION.md) and the canonical wire spec in
[`FEDERATION_WIRE.md`](./FEDERATION_WIRE.md); this page is the *why* and the *how-to*.

## What anvilosrs.com actually is (and isn't)

anvilosrs.com runs a **broker** — a **connect-time identity + directory hub**.

**It is NOT a data supplier.** No board, drop, kill, progress, tile, clog, or boss
data ever flows through it. The broker only ever holds:

- **directory metadata** — your instance's name and URL, so people can find you, and
- **Discord-identity assertions** — short-lived, signed "yes, this Discord user is
  who they say they are" notes, so a member can connect to several clans with one
  login.

Everything about your clan's actual game data stays on **your** box. The broker
being down never takes your instance down — it only pauses *new* cross-clan
connects. This is a hard invariant, not a nicety (see `FEDERATION.md` § Invariants).

> If you were expecting a shared "data feed" of clog/tile/boss definitions: that
> isn't the broker. Those reference datasets are **bundled in the source-available repo**
> and refreshed with `npm run data:clog` / `data:ca` etc. The only shared *service*
> is the one **Anvil** plugin on the RuneLite Hub, which every instance uses by
> pointing its **Site URL** at their own domain.

## The three layers — pick your depth

Federation is a dial. Each layer **adds** behaviour and removes nothing; you choose
how far you go, per instance, from your own admin UI. Sovereignty-minded hosts can
stay at L0 and never touch the broker.

| Layer | What it gives you | Broker involvement |
| --- | --- | --- |
| **L0 — Manual multi-home** | The plugin/site holds `{baseUrl, token}` pairs; tokens come from each instance's own `/token`. Connect to another clan by hand. | **None.** |
| **L1 — Directory** | Your instance registers its URL so members and other clans can **discover** it. | Broker stores your URL only. Tokens still issued by *you*; the broker never sees one. |
| **L2 — Identity federation** *(opt-in, advanced)* | A member does one Discord login on the broker and can then connect to every clan they belong to. Your instance trusts a broker in its `brokerTrust[]` and accepts signed assertions at `/exchange`, minting **its own** token. | Broker vouches for the Discord identity only — it **never** issues your token. |

Your own `/token` login keeps working at every layer — L2 is additive, not a
replacement.

## How to register in the directory (L1)

Registration is mostly one switch; your instance does the rest server-to-server.

1. **Enable federation.** In your admin UI, turn on the federation master switch
   (setting `federation_enabled`). Toggling it on fires `ensureRegisteredWithBroker`,
   which calls the broker's `POST /api/federation/v1/register` with your
   `instanceId` (a UUID persisted in the `federation_instance_id` setting), name,
   `baseUrl`, and capabilities.
2. **Prove you own the domain.** The broker returns a `verificationToken` and holds
   your row `pending` until you prove control, via **either**:
   - **HTTP (automatic):** your instance already serves
     `GET /.well-known/anvil-federation` → `{ instanceId, verificationToken }`. If
     your domain is publicly reachable over HTTPS, the broker fetches it and you're
     verified with no extra action.
   - **DNS (fallback):** add a TXT record `_anvil-federation.<your-domain>` =
     `<verificationToken>`. Use this if a proxy strips the well-known route.
   The broker's fetch is SSRF-guarded (HTTPS only, no redirects, private IPs
   rejected, 5s/8KB caps), so your domain must resolve to a public address.
3. **An operator admits you.** Domain proof shows the instance is *yours*; it doesn't by
   itself make it part of the network. Verified self-hosted registrations land in an
   admission queue and are reviewed by a broker operator — until that approval lands you
   stay off the directory, `/assoc` pushes and assertion audiences. Hosted
   `*.anvilosrs.com` clans skip both steps (we own the domain, and the subscription is
   the admission).
4. **You're listed.** Once you're both `verified` and approved, you appear in
   `GET /api/federation/v1/directory` tagged `type: "self-hosted"` (shown with a ⚠
   "self-hosted, verify before trusting" caution — that's expected and not a penalty).

**What stays off by default for self-hosters:** `associationPush` (the instance
telling the broker which Discord IDs belong to it) defaults **OFF** for self-hosted
instances — you opt in if you want members auto-populated when they connect. Hosted
clans have it on because provisioning establishes the trust.

## Turning on identity federation (L2)

L2 lets your members reach every clan they're in with a single Discord login on the
broker. To accept it, your instance must (a) advertise the `identity-federation`
capability and (b) trust a broker in `brokerTrust[]` (the anvilosrs.com broker's
`iss` is `https://anvilosrs.com`, with its signing keys at `GET /jwks.json`). Your
instance then validates broker assertions at `POST /api/federation/v1/exchange` and
mints **its own** plugin token — the assertion itself is never a usable credential
(60-second lifetime, single-use, pinned to exactly one instance).

> **Status — read before enabling L2.** Directory (L1) is ready. **Identity
> federation (L2) is opt-in and behind a security-hardening pass** — treat it as
> advanced/not-yet-default. `FEDERATION_SECURITY.md` is normative here (SSRF guards
> on cross-instance fetches, server-authoritative fan-out, encrypted cached tokens,
> cross-clan writes restricted to hosted homes). Don't present L2 to your members as
> a finished one-click feature until that pass lands. If in doubt, run L0/L1 — you
> lose nothing that matters day-to-day.

## What you keep, always

- **Your own Discord app** and your own token issuance, at every layer.
- **Full authority over membership** — the broker can vouch for an identity, but
  *your* instance decides whether that identity is a member and what it can do.
- **Your data on your box** — the broker is connect-time only, never a runtime
  proxy.
- **The right to opt out** — stay at L0 and you never talk to anvilosrs.com at all.

## For implementers

- Instance-side endpoints you expose (already built into Anvil):
  `GET /meta`, `POST /token`, `POST /exchange`, `GET /board`, `POST /events`,
  `POST /token/revoke`, and the proof route `GET /.well-known/anvil-federation`.
- Broker-side endpoints you call: `POST /register`, `GET /directory`,
  `GET /jwks.json`, `POST /assert`.
- Canonical formats (JWT `alg` must be `EdDSA`, token shapes, error codes, capability
  negotiation) live in [`FEDERATION_WIRE.md`](./FEDERATION_WIRE.md) — when anything
  here and the wire spec disagree, **the wire spec wins**.
