#!/bin/sh
set -e
corepack enable
cd /app

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies..."
  pnpm install --frozen-lockfile
fi

echo "==> Starting Web on port 3000..."
exec pnpm --filter @matrixhr/web exec next dev -p 3000 -H 0.0.0.0
