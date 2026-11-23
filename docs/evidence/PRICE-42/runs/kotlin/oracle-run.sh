#!/bin/bash
# Runs the oracle tools from the read-only oracle checkout against the candidate on 8083; TS reference on 8093.
# Usage: oracle-run.sh <outfile>   (markdown fragment with commands, tail of output, exit codes)
OUT="$1"; cd /d/demo-s2/oracle-kotlin || exit 3
run() { local label="$1"; shift; echo "### $label" >> "$OUT"; echo '```text' >> "$OUT"; echo "\$ (oracle-kotlin @ $(git rev-parse --short HEAD)) $*" >> "$OUT"; "$@" > /tmp/k-oracle.txt 2>&1; local rc=$?; { echo "[summary lines]"; grep -E "^ℹ (tests|pass|fail) |gating:|quirks|RESULT|contract:|by kind" /tmp/k-oracle.txt; echo "[last 8 lines]"; tail -n 8 /tmp/k-oracle.txt; } >> "$OUT"; echo "exit code: $rc" >> "$OUT"; echo '```' >> "$OUT"; echo "$label rc=$rc"; }
run "Golden corpus" node parity/check.mjs --base http://localhost:8083
run "Contract" node parity/contract.mjs --base http://localhost:8083
run "Black-box" node parity/blackbox/run.mjs --base http://localhost:8083
run "Differential, seed 42" node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000
[ "${2:-}" = "final" ] && run "Differential, seed 7" node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 7 --n 1000
[ "${2:-}" = "final" ] && run "Differential, seed 20261126 (not used by the agent)" node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 20261126 --n 1000
