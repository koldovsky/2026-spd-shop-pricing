#!/bin/bash
# Usage: ship.sh <slug> <iter-ids-glob e.g. 04> <pr title> <pr body file>
# Copies raw JSON + prompts + tools, regenerates the run log, commits evidence, runs gates locally, pushes, opens PR.
SLUG="$1"; IT="$2"; TITLE="$3"; BODY="$4"
R=/d/demo-s2/pricing-kotlin; K=/d/demo-s2/runs-kotlin; D=$R/docs/evidence/PRICE-42/runs/kotlin
cd $R || exit 3
SHA=$(git rev-parse --short HEAD)
EM=$(git config user.email)
mkdir -p $D/prompts; cp $K/[0-9][0-9]-*.json $D/; cp $K/prompts/[0-9][0-9]-*.txt $D/prompts/
node $K/tools/redact.mjs $D "$EM" || exit 9
cp $K/tools/sum-runs.mjs $K/tools/oracle-run.sh $K/tools/evidence.sh $K/tools/start-candidate.sh $K/tools/gen-runlog.mjs $K/tools/redact.mjs $K/tools/ship.sh $K/run-agent.sh $D/
node $K/tools/gen-runlog.mjs $R/docs/evidence/PRICE-42/kotlin-run-log.md || exit 4
git add docs/evidence 2>/dev/null
git commit -q -m "PRICE-42 kotlin: evidence for $SLUG at $SHA" -m "Orchestrator evidence: clean build and oracle results from the read-only oracle checkout (128c922) against the candidate built at $SHA; raw claude -p results and the run log." -m "Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
Evidence: docs/evidence/PRICE-42/kotlin-$SLUG.md" || exit 5
H=$K/harness-v1.6.0/ci
node $H/trace-gate.mjs --base origin/main --head HEAD --title "$TITLE" --branch "$(git branch --show-current)" | tail -2 || exit 6
node $H/diff-size.mjs --base origin/main --head HEAD --fail 400 | tail -2
git push -q -u origin "$(git branch --show-current)" 2>&1 | grep -v "^remote:" 
gh pr create -R koldovsky/2026-spd-shop-pricing --base main --head "$(git branch --show-current)" --title "$TITLE" --body-file "$BODY"
