#!/bin/bash
# Kotlin stream launcher for the agent under test. Usage: run-agent.sh <nn-slice> <prompt-file>
# Unsets every CLAUDE*, ANTHROPIC_*, MCP_*, OTEL_* variable inherited from the orchestrator session.
set -u
NAME="$1"; PROMPT_FILE="$2"
OUT=/d/demo-s2/runs-kotlin
for v in $(env | grep -oE '^(CLAUDE[A-Za-z0-9_]*|ANTHROPIC_[A-Za-z0-9_]*|MCP_[A-Za-z0-9_]*|OTEL_[A-Za-z0-9_]*)='); do unset "${v%=}"; done
export CLAUDE_CODE_HIDE_ACCOUNT_INFO=1
cd /d/demo-s2/pricing-kotlin || exit 3
START=$(date -Iseconds); S=$(date +%s)
claude -p "$(cat "$PROMPT_FILE")" --output-format json --model claude-opus-5-5 --max-turns 60 \
  --permission-mode acceptEdits --add-dir "D:/projects/clients/spd-technology/demo/2026-spd-shop-orders" \
  --allowedTools "Bash(./gradlew *)" "Bash(./gradlew)" "Bash(kotlin/gradlew *)" "Bash(./kotlin/gradlew *)" "Bash(gradlew.bat *)" "Bash(cmd //c gradlew.bat *)" \
    "Bash(/d/demo-s2/pricing-kotlin/kotlin/gradlew *)" "Bash(kotlin/gradlew.bat *)" "PowerShell(.\\kotlin\\gradlew.bat *)" "PowerShell(kotlin/gradlew.bat *)" "PowerShell(kotlin\\gradlew.bat *)" \
    "Bash(git add *)" "Bash(git commit *)" "Bash(git status)" "Bash(git status *)" "Bash(git diff)" "Bash(git diff *)" "Bash(git log)" "Bash(git log *)" \
    "Bash(git -C * status*)" "Bash(git -C * diff*)" "Bash(git -C * log*)" "Bash(git -C * add *)" "Bash(git -C * commit *)" "Bash(git ls-files*)" \
    "Bash(npm run parity:*)" "Bash(node parity/*)" "Bash(node bench/*)" \
    "Bash(java *)" "Bash(PORT=8083 java *)" "Bash(curl *)" "Bash(cp *)" "Bash(mkdir *)" "Bash(chmod *)" "Bash(git update-index *)" "Bash(sleep *)" "Bash(cd kotlin *)" \
  < /dev/null > "$OUT/$NAME.json" 2> "$OUT/$NAME.stderr"
RC=$?
END=$(date -Iseconds); E=$(date +%s)
echo "$NAME start=$START end=$END wall_s=$((E-S)) rc=$RC" >> "$OUT/times.txt"
echo "$NAME rc=$RC wall_s=$((E-S))"
