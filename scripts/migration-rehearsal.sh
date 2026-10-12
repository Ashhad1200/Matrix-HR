#!/bin/bash
# Rehearses `prisma migrate deploy` of the current migrations against databases built the ways production
# plausibly was, with data in them, applying twice, and checks nothing was lost.
#
#   PGHOST/PGPORT/PGUSER must point at a throwaway Postgres (the script creates and drops rh_* databases).
#   OLD_REF = git ref whose schema.prisma is "what prod was built from" (default: master before this work).
#
# Scenarios
#   fresh      empty DB -> migrate deploy (both migrations)
#   A          DB created by 0_init via migrate deploy (has _prisma_migrations, lacks Expense/Loan tables)
#   B          DB created by `db push` of the OLD schema, then baselined (migrate resolve --applied 0_init)
#   B-nobase   same as B but NOT baselined: must fail with P3005 (the failure the entrypoint recovery handles)
#   C          DB created from 0_init.sql by hand (no history), then baselined
set -u
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-matrixhr}"
OLD_REF="${OLD_REF:-3367408}"
DBPKG=packages/database
TMP="$(mktemp -d /var/tmp/rehearsal.XXXXXX)"
git show "$OLD_REF:$DBPKG/prisma/schema.prisma" > "$TMP/old-schema.prisma"
url() { echo "postgresql://$PGUSER@$PGHOST:$PGPORT/$1?schema=public"; }
q() { psql -qtAX -d "$1" -c "$2"; }
fail=0
ok() { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fail=1; }
prisma() { (cd $DBPKG && DATABASE_URL="$DB_URL" pnpm exec prisma "$@" 2>&1); }

seed_rows() { # minimal rows in tables that exist in every historical schema
  q "$1" "insert into \"Tenant\"(id,name,subdomain,\"updatedAt\") values ('t1','Acme','acme',now()),('t2','Globex','globex',now());
          insert into \"Plan\"(id,code,name) values ('p1','growth','Growth');
          insert into \"PlanVersion\"(id,\"planId\",version,\"pricePkrMonthly\") values ('pv1','p1',1,10000);
          insert into \"Subscription\"(id,\"tenantId\",\"planVersionId\",status,\"updatedAt\") values ('s1','t1','pv1','active',now());
          insert into \"User\"(id,\"tenantId\",email,\"passwordHash\",role,\"updatedAt\") values ('u1','t1','a@acme.com','x','COMPANY_ADMIN',now());" >/dev/null
}
fingerprint() { q "$1" "select md5(string_agg(x::text, '|' order by x::text)) from (
    select id,name,subdomain,plan,status::text from \"Tenant\" union all select id,code,name,'','' from \"Plan\"
    union all select id,\"tenantId\",status,\"planVersionId\",'' from \"Subscription\" union all select id,\"tenantId\",email,role::text,'' from \"User\") x"; }
tables() { q "$1" "select count(*) from information_schema.tables where table_schema='public' and table_name <> '_prisma_migrations'"; }

verify_new() {
  local db="$1"
  for t in PaymentRequest PaymentProof Receipt AiCreditLedger EmailOutbox ExpenseClaim LoanRequest; do
    [ "$(q "$db" "select to_regclass('public.\"$t\"') is not null")" = t ] || bad "$db: missing table $t"
  done
  [ "$(q "$db" "select count(*) from _prisma_migrations where finished_at is not null")" = 2 ] || bad "$db: expected 2 applied migrations"
}

run() { # name, builder-fn
  local name="$1" db="rh_$1"; DB_URL="$(url "$db")"
  echo "== scenario $name"
  psql -qX -d postgres -c "drop database if exists \"$db\"" -c "create database \"$db\"" >/dev/null
  "build_$name"
  local before after
  [ "$name" = fresh ] || { seed_rows "$db"; before="$(fingerprint "$db")"; [ -n "$before" ] || bad "fingerprint query returned nothing (harness bug)"; }
  out="$(prisma migrate deploy)"; rc=$?
  if [ "$name" = B-nobase ]; then
    echo "$out" | grep -q P3005 && ok "unbaselined db-push database fails with P3005 as predicted" || bad "expected P3005, got: $(echo "$out" | tail -3)"
    # recovery path used by docker/entrypoint-api.prod.sh
    prisma migrate resolve --applied 0_init >/dev/null && ok "baselined with migrate resolve --applied 0_init"
    out="$(prisma migrate deploy)"; rc=$?
  fi
  [ $rc -eq 0 ] && ok "first deploy applied cleanly" || bad "first deploy failed: $(echo "$out" | tail -4)"
  out="$(prisma migrate deploy)"; rc=$?
  { [ $rc -eq 0 ] && echo "$out" | grep -q "No pending migrations"; } && ok "second deploy is a no-op" || bad "second deploy: $(echo "$out" | tail -3)"
  # re-run the SQL file directly: proves the statements themselves are idempotent, not just Prisma's bookkeeping
  psql -qX -v ON_ERROR_STOP=1 -d "$db" -f $DBPKG/prisma/migrations/1_ai_billing/migration.sql >/dev/null 2>"$TMP/err" && ok "migration.sql re-applied by hand: no errors" || bad "re-apply: $(head -3 "$TMP/err")"
  verify_new "$db"
  if [ "$name" != fresh ]; then after="$(fingerprint "$db")"; [ -n "$before" ] && [ "$before" = "$after" ] && ok "existing rows unchanged (fingerprint $before)" || bad "data changed"; fi
  echo "     tables: $(tables "$db")"
}

build_fresh() { :; }
build_A() { # exactly what prod would have run before this change: migrate deploy with only 0_init present
  mkdir -p "$TMP/A/prisma/migrations/0_init" && cp "$TMP/old-schema.prisma" "$TMP/A/prisma/schema.prisma"
  git show "$OLD_REF:$DBPKG/prisma/migrations/0_init/migration.sql" > "$TMP/A/prisma/migrations/0_init/migration.sql"
  cp $DBPKG/prisma/migrations/migration_lock.toml "$TMP/A/prisma/migrations/"
  prisma migrate deploy --schema "$TMP/A/prisma/schema.prisma" | grep -q "successfully applied" || { echo "  could not build A"; exit 2; }
}
build_B() { prisma db push --skip-generate --schema "$TMP/old-schema.prisma" >/dev/null; prisma migrate resolve --applied 0_init >/dev/null; }
build_B-nobase() { prisma db push --skip-generate --schema "$TMP/old-schema.prisma" >/dev/null; }
build_C() { git show "$OLD_REF:$DBPKG/prisma/migrations/0_init/migration.sql" | psql -qX -v ON_ERROR_STOP=1 -d rh_C >/dev/null; prisma migrate resolve --applied 0_init >/dev/null; }

for s in fresh A B B-nobase C; do run "$s"; done
for s in fresh A B B-nobase C; do psql -qX -d postgres -c "drop database if exists \"rh_$s\"" >/dev/null; done
rm -rf "$TMP"
[ $fail -eq 0 ] && echo "ALL SCENARIOS PASSED" || { echo "SOME SCENARIOS FAILED"; exit 1; }
