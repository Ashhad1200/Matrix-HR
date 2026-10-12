#!/bin/sh
set -e
cd /app

echo "==> Applying database migrations (prisma migrate deploy)..."
if out=$(pnpm --filter @matrixhr/database exec prisma migrate deploy 2>&1); then
  echo "$out"
else
  echo "$out"
  # P3005 = non-empty database with no migration history (it was built with `db push`). Left alone the API
  # would crash-loop. Baselining only records 0_init as already applied (it never runs SQL or resets anything);
  # the migrations after it are idempotent, so applying them next is safe. Opt out with MIGRATE_BASELINE_ON_P3005=false.
  if echo "$out" | grep -q "P3005" && [ "${MIGRATE_BASELINE_ON_P3005:-true}" = "true" ]; then
    echo "==> WARNING: no migration history on a non-empty database. Baselining 0_init, then retrying."
    pnpm --filter @matrixhr/database exec prisma migrate resolve --applied 0_init
    pnpm --filter @matrixhr/database exec prisma migrate deploy
  else
    echo "==> migrate deploy failed and was not recoverable automatically. Refusing to start."
    exit 1
  fi
fi

echo "==> Starting API on port ${PORT:-3001}..."
exec node apps/api/dist/main.js
