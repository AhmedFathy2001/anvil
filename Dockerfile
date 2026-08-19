# syntax=docker/dockerfile:1

# The Anvil site. One image, one running container, many clans — each a row in the shared Postgres
# the container is pointed at, resolved per request from the Host header. Built as a Next.js
# standalone bundle so the runtime is just Node — no node_modules install, no `next start`.

# ─── deps: install everything (dev included) for the build ─────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder: compile the standalone server bundle ─────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Secrets are injected at runtime, not build. requireSecret()/env.ts fall back to dev defaults during
# `next build` (NEXT_PHASE=phase-production-build), so the build needs no real credentials.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── runner: minimal runtime image ────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
# The exact commit this image was built from — surfaced at /api/version, in the footer, and in the
# plugin handshake. CI passes it; local builds fall back to 'dev'.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
# No DATABASE_URL default: the database is a separate service now, and a default would only ever be
# wrong. Boot fails loudly without it, which is the right failure.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# pg_dump, for the pre-migration snapshot and the daily backup. It was missing from this image:
# the daily backup would have 500'd, and the snapshot warns and CONTINUES — meaning the migration
# runs anyway, unsnapshotted. That only bites when a migration is actually pending, which is to say
# on exactly the deploy where the rollback path matters.
#
# Version-matched on purpose: pg_dump refuses to dump from a server NEWER than itself, and bookworm
# ships client 15 against our 18 server. So it comes from PGDG, pinned to the server's major.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y --auto-remove gnupg curl \
 && rm -rf /var/lib/apt/lists/* \
 && pg_dump --version

# Run as non-root; /data holds pre-migration pg_dump snapshots and must be writable by it.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /data && chown -R nextjs:nodejs /data

# Standalone server + assets it doesn't bundle (static chunks, public/).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations + the boot-time migrator. drizzle-orm's node-postgres migrator and `pg` aren't traced
# into the standalone bundle (migrate.mjs runs outside Next), so copy them in explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-preview.mjs ./scripts/seed-preview.mjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare

USER nextjs
VOLUME /data
EXPOSE 3000

# Apply pending migrations, then serve. A migration failure aborts boot (fail fast) rather than
# serving against a half-built schema.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
