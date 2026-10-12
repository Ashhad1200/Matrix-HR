#!/bin/bash
# Regenerates packages/database/prisma/migrations/1_ai_billing/migration.sql from the schema: diff against the history
# before it, then make every statement idempotent (see the header it writes). Needs a throwaway Postgres for the shadow DB.
#   PGHOST/PGPORT/PGUSER as for scripts/migration-rehearsal.sh
set -eu
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-matrixhr}"
D=packages/database; T="$(mktemp -d /var/tmp/genmig.XXXX)"
mkdir -p "$T/migrations/0_init"; cp $D/prisma/migrations/0_init/migration.sql "$T/migrations/0_init/"; cp $D/prisma/migrations/migration_lock.toml "$T/migrations/"
psql -qX -d postgres -c "drop database if exists shadow" -c "create database shadow" >/dev/null
(cd $D && DATABASE_URL="postgresql://$PGUSER@$PGHOST:$PGPORT/shadow" pnpm exec prisma migrate diff --from-migrations "$T/migrations" --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://$PGUSER@$PGHOST:$PGPORT/shadow" --script > "$T/raw.sql")
python3 scripts/idempotent-migration.py "$T/raw.sql" > $D/prisma/migrations/1_ai_billing/migration.sql
scripts/check-migration-additive.sh $D/prisma/migrations/1_ai_billing/migration.sql
rm -rf "$T"
