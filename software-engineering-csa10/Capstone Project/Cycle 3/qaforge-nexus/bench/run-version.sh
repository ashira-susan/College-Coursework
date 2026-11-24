#!/usr/bin/env bash
# usage: run-version.sh <label> <code_dir> <port> <scales> ; builds a fresh database, seeds it (timed), starts the server, runs bench/latency.js
set -e
LABEL=$1; DIR=$2; PORT=$3; SCALES=${4:-0,1000,10000,100000}; OUT=${OUT_DIR:-/home/claude/qaforge-nexus/bench/results}; mkdir -p "$OUT"
export PGPASSWORD=qaforge DB=qf_bench_${LABEL//[^a-z0-9]/_}
psql -h 127.0.0.1 -U qaforge postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
export DATABASE_URL=postgres://qaforge:qaforge@127.0.0.1:5432/$DB QAF_RATE_LIMIT=10000000 PORT=$PORT HOST=127.0.0.1 QAF_SECRET=bench
cd "$DIR"
S0=$(date +%s.%N); node server/seed.js --reset >/dev/null; S1=$(date +%s.%N)
echo "{\"seed_seconds\": $(echo "$S1 - $S0" | bc)}" > "$OUT/$LABEL-seed.json"
node server/index.js >"$OUT/$LABEL-server.log" 2>&1 &
PID=$!; trap "kill $PID 2>/dev/null || true" EXIT
for i in $(seq 1 50); do curl -s localhost:$PORT/api/health >/dev/null && break; sleep 0.2; done
node /home/claude/qaforge-nexus/bench/latency.js "$LABEL" http://127.0.0.1:$PORT "$DATABASE_URL" $PID "$OUT/$LABEL-latency.json" "$SCALES"
