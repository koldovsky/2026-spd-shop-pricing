#!/bin/bash
# Orchestrator evidence for one slice. Usage: evidence.sh <slug> <title> [final]
# Clean build of the agent's tree at HEAD, start the jar on 8083, oracle from oracle-kotlin@128c922, stop by PID.
SLUG="$1"; TITLE="$2"; MODE="${3:-}"
R=/d/demo-s2/pricing-kotlin; EV="$R/docs/evidence/PRICE-42/kotlin-$SLUG.md"; TMP=/d/demo-s2/runs-kotlin/ev-$SLUG.md
cd $R || exit 3
SHA=$(git rev-parse HEAD); DIRTY=$(git status --porcelain | grep -v '^?? docs/evidence/' | wc -l)
{
echo "# PRICE-42 Kotlin — evidence: $TITLE"
echo
echo "- Verified revision: \`$SHA\` (branch \`$(git branch --show-current)\`, working tree changes outside docs/evidence: $DIRTY)"
echo "- Oracle: read-only checkout \`D:\demo-s2\oracle-kotlin\` at \`$(git -C /d/demo-s2/oracle-kotlin rev-parse HEAD)\`, corpus sha256 \`$(sha256sum /d/demo-s2/oracle-kotlin/parity/corpus/corpus.json | cut -c1-64)\`"
echo "- TS reference: \`node dist/server.js\` from the oracle checkout, PORT=8093. Candidate: \`java -jar kotlin/build/libs/pricing.jar\`, PORT=8083."
echo "- Run by the orchestrator (not the agent) on $(date -Iseconds), Windows 11, $(java -version 2>&1 | head -1), node $(node --version)."
echo "- Oracle files unchanged in this tree: \`git diff 128c922 -- parity contracts bench .claude\` -> $(git diff 128c922 -- parity contracts bench .claude | wc -l) lines"
echo
echo "## Build"
echo '```text'
echo '$ kotlin/gradlew -p kotlin clean build --console=plain'
} > $TMP
kotlin/gradlew -p kotlin clean build --console=plain > /tmp/k-build.txt 2>&1; BRC=$?
grep -E "Task :test|BUILD|tests completed|FAILED" /tmp/k-build.txt >> $TMP
echo "exit code: $BRC" >> $TMP
echo "jar: kotlin/build/libs/pricing.jar, $(stat -c %s kotlin/build/libs/pricing.jar 2>/dev/null) bytes" >> $TMP
TESTS=$(ls kotlin/build/test-results/test/*.xml 2>/dev/null | xargs -r grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' | awk -F'"' '{t+=$2;s+=$4;f+=$6;e+=$8} END {print "unit tests: " t " run, " f " failures, " e " errors, " s " skipped (JUnit XML in kotlin/build/test-results)"}')
echo "$TESTS" >> $TMP; echo '```' >> $TMP
echo "build rc=$BRC; $TESTS"
[ $BRC -ne 0 ] && { echo "BUILD FAILED"; cp $TMP $EV; exit 1; }
PID=$(/d/demo-s2/runs-kotlin/tools/start-candidate.sh) || { echo start failed; exit 5; }
echo "candidate PID $PID"
echo >> $TMP; echo "## Oracle (from the oracle checkout)" >> $TMP; echo >> $TMP
/d/demo-s2/runs-kotlin/tools/oracle-run.sh $TMP $MODE
taskkill //PID $PID //F > /dev/null 2>&1 && echo "stopped $PID"
cp $TMP $EV
