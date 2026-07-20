# Multi-stage build for the Nahu Admin Portal (Railway staging service).
# Build from the monorepo root:
#   docker build -f apps/admin-web/Dockerfile -t nahu-admin-web .

FROM node:20-alpine AS base
RUN corepack enable pnpm

# ---- Install workspace dependencies ----
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/admin-web/package.json apps/admin-web/
RUN pnpm install --filter @nahu-platform/admin-web... --frozen-lockfile 2>/dev/null \
  || pnpm install --filter @nahu-platform/admin-web...

# ---- Build ----
FROM base AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/admin-web/node_modules ./apps/admin-web/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/admin-web ./apps/admin-web
RUN pnpm --filter @nahu-platform/admin-web build \
  && test -f apps/admin-web/.next/standalone/apps/admin-web/server.js

# ---- Runtime (standalone output) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# outputFileTracingRoot = monorepo root → standalone contains apps/admin-web/server.js
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin-web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/admin-web/.next/static ./apps/admin-web/.next/static

# Fail the image build early if the entrypoint is missing (wrong standalone layout).
RUN test -f /app/apps/admin-web/server.js

USER nextjs
WORKDIR /app/apps/admin-web
EXPOSE 3001
CMD ["node", "server.js"]
