#!/bin/sh
# Fails if a migration contains anything destructive. Usage: scripts/check-migration-additive.sh <migration.sql>
f="${1:?migration.sql path}"
# strip -- comments first so prose can't trip or hide a match
bad=$(sed 's/--.*$//' "$f" | grep -niE '\bDROP\b|\bRENAME\b|ALTER COLUMN|\bTRUNCATE\b|\bDELETE\b +FROM|SET DATA TYPE|\bUSING\b +\(' || true)
if [ -n "$bad" ]; then echo "DESTRUCTIVE statements in $f:"; echo "$bad"; exit 1; fi
echo "OK: $f has 0 destructive statements ($(sed 's/--.*$//' "$f" | grep -ciE '^(CREATE|ALTER|DO)') statements)"
