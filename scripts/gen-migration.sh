#!/bin/bash
# Regenerates packages/database/prisma/migrations/1_ai_billing/migration.sql from the schema: diff against the history
# before it, then make every statement idempotent (see the header it writes). Needs a throwaway Postgres for the shadow DB.
#   PGHOST/PGPORT/PGUSER as for scripts/migration-rehearsal.sh
set -eu
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-matrixhr}"
# Usage: scripts/gen-migration.sh [NAME]   NAME defaults to 1_ai_billing; for a later migration pass its folder name (e.g. 2_hr_modules):
# the diff is taken against every migration that sorts BEFORE NAME, and written to NAME/migration.sql.
NAME="${1:-1_ai_billing}"
D=packages/database; T="$(mktemp -d /var/tmp/genmig.XXXX)"
mkdir -p "$T/migrations"; cp $D/prisma/migrations/migration_lock.toml "$T/migrations/"
for m in $(ls $D/prisma/migrations | grep -E '^[0-9]+_' | sort -V); do [ "$m" = "$NAME" ] && break; mkdir -p "$T/migrations/$m"; cp $D/prisma/migrations/$m/migration.sql "$T/migrations/$m/"; done
psql -qX -d postgres -c "drop database if exists shadow" -c "create database shadow" >/dev/null
(cd $D && DATABASE_URL="postgresql://$PGUSER@$PGHOST:$PGPORT/shadow" pnpm exec prisma migrate diff --from-migrations "$T/migrations" --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://$PGUSER@$PGHOST:$PGPORT/shadow" --script > "$T/raw.sql")
python3 scripts/idempotent-migration.py "$T/raw.sql" > $D/prisma/migrations/$NAME/migration.sql
scripts/check-migration-additive.sh $D/prisma/migrations/$NAME/migration.sql
rm -rf "$T"
