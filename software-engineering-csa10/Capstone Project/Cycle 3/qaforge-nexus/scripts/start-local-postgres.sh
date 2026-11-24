#!/usr/bin/env bash
# Starts a throw-away local PostgreSQL 16 on port 5432 (Linux, binaries in /usr/lib/postgresql/16/bin) and creates the qaforge role/database.
set -e
B=/usr/lib/postgresql/16/bin; D=${QAF_PGDATA:-/var/lib/qaf-pg/data}
mkdir -p "$(dirname "$D")"; chown postgres "$(dirname "$D")"
[ -d "$D" ] || runuser -u postgres -- $B/initdb -D "$D" -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
rm -f "$D/postmaster.pid"
runuser -u postgres -- $B/pg_ctl -D "$D" -o "-p 5432 -k /tmp" -l "$D/../log.txt" start >/dev/null || true
sleep 2
psql -h /tmp -p 5432 -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='qaforge'" | grep -q 1 || psql -h /tmp -p 5432 -U postgres -c "CREATE ROLE qaforge LOGIN PASSWORD 'qaforge' CREATEDB" -c "CREATE DATABASE qaforge OWNER qaforge"
echo "PostgreSQL ready: postgres://qaforge:qaforge@127.0.0.1:5432/qaforge"
