#!/bin/sh
set -e
corepack enable
cd /app

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies..."
  pnpm install --frozen-lockfile
fi

echo "==> Building shared packages..."
pnpm --filter @matrixhr/shared build
pnpm --filter @matrixhr/database build
pnpm db:generate 2>/dev/null || true

echo "==> Preparing database..."
export DATABASE_URL="${DATABASE_URL:-postgresql://matrixhr:matrixhr@postgres:5432/matrixhr?schema=public}"
echo "DATABASE_URL=$DATABASE_URL" > packages/database/.env
pnpm db:push
pnpm db:seed || true

echo "==> Starting API on port 3001..."
exec pnpm --filter @matrixhr/api dev
