# Production image for @matrixhr/api.
#
# ponytail: the whole workspace (incl. devDependencies) is carried into the runtime stage instead of a
# pruned/standalone bundle. Correct and simple for a first deploy; shrink with `pnpm deploy --filter` or a
# distroless runtime once image size/cold-start actually matters.

FROM node:20-bookworm-slim AS build
# openssl must be present *before* `prisma generate` — it's how Prisma detects which engine binary
# (debian-openssl-1.1.x vs 3.0.x) to bundle. Without it here the build silently picks the wrong one and
# the runtime stage (which does have openssl 3.0) fails with PrismaClientInitializationError at boot.
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @matrixhr/shared build \
 && pnpm db:generate \
 && pnpm --filter @matrixhr/database build \
 && pnpm --filter @matrixhr/api build

FROM node:20-bookworm-slim AS runtime
# openssl: Prisma's query engine links against it on Debian; ca-certificates: TLS to Postgres/SMTP/S3.
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN chmod +x /app/docker/entrypoint-api.prod.sh
EXPOSE 3001
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint-api.prod.sh"]
