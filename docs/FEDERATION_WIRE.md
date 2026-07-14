# Anvil Federation — Wire Contract (v1)  — CANONICAL

The low-level, byte-level contract shared by **Site** (`/exchange`, `/meta`, `/board`, `/events`,
`/token`), **Admin broker** (`/assert`, `/jwks`, `/register`, `/directory`, `/assoc`), and the
**Plugin**. When `FEDERATION.md` (instance) or `FEDERATION_BROKER.md` (broker) disagree with this
file, **this file wins.** All three codebases MUST agree on everything here before coding L2.

Base path: `/api/federation/v1/`. Transport: **HTTPS only** (HSTS). JSON bodies.

---

## 1. instanceId

- The **instance** generates a stable UUIDv4 **once** on first boot and persists it in settings
  key `federation_instance_id`. This makes Layer 0 work with **no broker**.
- Exposed in `GET /meta` as `instanceId`.
- The broker **records** it at `POST /register` and enforces global uniqueness; the broker never
  invents instanceIds.

## 2. Assertion JWT  (broker `/assert` → instance `/exchange`)

**Algorithm: `EdDSA` (Ed25519 / OKP).** Nothing else is accepted.

Header: `{ "alg": "EdDSA", "kid": "<broker-key-id>", "typ": "JWT" }`

Claims:
| claim | meaning |
|---|---|
| `iss` | broker id (its base URL, e.g. `https://admin.anvil.gg`) — must be in the instance's `brokerTrust[]` |
| `sub` | the authenticated **`discord_id`** (string) |
| `aud` | **exactly one** `instanceId` (the target). One JWT per target instance. |
| `iat` | issued-at (unix seconds) |
| `exp` | `iat + 60` (60-second lifetime) |
| `jti` | UUIDv4, single-use |

**Verifier (instance `/exchange`) MUST, in order:**
1. Parse header; **reject unless `alg === "EdDSA"`** (blocks `alg:none` + alg-confusion). Never
   derive alg from the token.
2. Resolve `kid` against the broker JWKS (fetch + cache; refetch on unknown `kid`).
3. Verify signature.
4. `iss` ∈ `brokerTrust[]`, else 403.
5. `aud` === own `instanceId`, else 403.
6. `exp` valid with **≤30s clock skew**; reject expired.
7. `jti` unseen → record it until `exp`; if seen → **409 replay**, reject.
8. Only then map `sub`→member and apply `exchangePolicy`.

Use `jose` (`jwtVerify` + `createRemoteJWKSet`) — do not hand-roll.

## 3. Broker JWKS  (`GET /jwks.json`)

- OKP/Ed25519 **public** JWKs, each with a unique `kid`. `{ "keys": [ ... ] }`.
- **Rotation:** publish new **and** old keys; sign new assertions with the newest; retire an old
  key after `> max assertion lifetime` (60s) — practically after a short grace (e.g. 1h).
- Instances cache per `jose` defaults and refetch on unknown `kid`. `Cache-Control: max-age=300`.
- The **private** key lives only in the broker's secret store (`admin.env` on-box for now);
  never leaves Admin.

## 4. Federation token  (plugin ↔ instance; from `/token` or `/exchange`)

- **Opaque random 256-bit** string (base64url), **NOT a JWT**. Presented as
  `Authorization: Bearer <token>`.
- Stored **hashed** (SHA-256) at the instance in `federation_tokens`:
  `{ tokenId, tokenHash, memberId/discordId, scopes[], createdAt, lastUsedAt, revokedAt, label }`.
- **Long-lived + revocable** (decision 3). Revoke = set `revokedAt`; `/token/revoke` + the
  "Connected plugins" UI operate on `tokenId`.
- Scopes: `board:read`, `events:write`.
- (Web session — the Discord OAuth site login — is separate: 30-day, unchanged.)

## 5. `/events` ingest  (thin wrapper — decision 2)

- The plugin still resolves tiles **client-side** and submits completions through the **existing
  submissions pipeline**, but authed with a federation token and wrapped with a fanout descriptor.
- **Fanout descriptor** (plugin-declared) on every event:
  `"fanout": { "count": <int>, "instanceIds": ["<uuid>", ...] }`
- **`sharedCredit` enforcement** (instance setting, default `accept`):
  - `accept` → credit normally.
  - `exclusive` → if `fanout.count > 1`, **do not credit**; respond `200 {credited:false, reason:"exclusive"}`.
- Trust: fanout is plugin-declared; same trust boundary as the drop report itself (§ FEDERATION.md).

## 6. Domain-ownership proof  (broker `/register`)

- Broker issues a `verificationToken`. Instance proves control via **either**:
  - **HTTP:** serve `GET /.well-known/anvil-federation` → `{ "instanceId": "...", "verificationToken": "..." }`, **or**
  - **DNS:** TXT record `_anvil-federation.<domain>` = `<verificationToken>`.
- Broker fetch is **SSRF-guarded**: HTTPS only, to the registered host, **no redirects**, resolve
  + reject private/loopback/link-local IPs, 5s timeout, 8KB body cap.
- State: `pending` → `verified`. Hosted clans provisioned by Admin are `verified` implicitly (we
  own the domain).

## 7. Capability negotiation

`GET /meta` → `{ instanceId, name, type: "hosted"|"self-hosted", version: "1", capabilities: [...],
brokerTrust: [ {iss, jwksUrl} ], publicKey }`. Capabilities ⊆ `["directory","identity-federation"]`.
Clients degrade: no `identity-federation` ⇒ L0/L1 only. Unknown future capabilities are ignored.

## 8. Error conventions

| HTTP | when |
|---|---|
| 401 | missing/invalid/expired/revoked federation token |
| 403 | assertion `iss` not trusted, `aud` mismatch, member banned, or `exchangePolicy: reject` non-member |
| 409 | replayed `jti` |
| 422 | assertion malformed / wrong `alg` |
| 429 | rate-limited (`/exchange`, `/token`, `/register`, `/assert`, auto-guest creation) |

---

## Frozen decisions (from design, do not relitigate mid-build)

1. Credit **all** connected clans; per-clan `sharedCredit: exclusive` opt-out (§5).
2. Association push default **on** for hosted (at provision), **off** for self-hosted (opt-in).
3. Plugin token **long-lived + revocable**; web session **30-day**.
4. Guest-on-exchange default **`auto-guest`** — inert (read-only, never auto-placed on a team) +
   **sticky ban** (denylist keyed on `discord_id`, blocks re-exchange) + rate-limit + audit.
5. `instanceId` = instance-self-declared stable UUID; broker records it.
