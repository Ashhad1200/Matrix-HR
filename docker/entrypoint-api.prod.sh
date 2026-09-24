#!/bin/sh
set -e
cd /app

echo "==> Applying database migrations (prisma migrate deploy)..."
pnpm --filter @matrixhr/database exec prisma migrate deploy

echo "==> Starting API on port ${PORT:-3001}..."
exec node apps/api/dist/main.js
