# PRICE-42 Kotlin stream — run log

Orchestrator: Claude Code (claude-opus-5-5) under the 23.11 permission. Agent under test: `claude -p` (claude-opus-5-5), cwd = the Kotlin clone, so the repo's `.claude/settings.json` hook and AGENTS.md load. Raw results: `docs/evidence/PRICE-42/runs/kotlin/NN-<slice>.json` (unmodified; scanned for the user's email and home path: none found, nothing redacted). Prompts verbatim: `runs/kotlin/prompts/`.

## Fixed before the start

- Iteration = one `claude -p` call, `--max-turns 60`. Cap: 12 iterations and 6 h wall-clock. Stream start (first agent call prepared): 2026-11-23T20:05+02:00.
- Setup (not iterations): fresh clone `D:/demo-s2/pricing-kotlin`, oracle clone `D:/demo-s2/oracle-kotlin` detached at `128c922` (`npm ci`, `npm run build`), TS reference `node dist/server.js` with PORT=8093 from the oracle clone. One smoke call `claude -p "Reply with the word ok" --max-turns 1` outside the clone to check that auth works with the scrubbed environment: 0.345136 USD, JSON not kept, not counted below.
- Environment of every call: all `CLAUDE*`, `ANTHROPIC_*`, `MCP_*`, `OTEL_*` variables unset, `CLAUDE_CODE_HIDE_ACCOUNT_INFO=1`, stdin from /dev/null (from iteration 03). The user's global `~/.claude/CLAUDE.md` still loads (it is why the agent sometimes answers in Ukrainian).
- Flags: `--output-format json --model claude-opus-5-5 --max-turns 60 --permission-mode acceptEdits --add-dir <shop-orders repo, from iteration 02> --allowedTools` with: `Bash(./gradlew *)`, `Bash(./gradlew)`, `Bash(kotlin/gradlew *)`, `Bash(./kotlin/gradlew *)`, `Bash(gradlew.bat *)`, `Bash(cmd //c gradlew.bat *)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git status)`, `Bash(git status *)`, `Bash(git diff)`, `Bash(git diff *)`, `Bash(git log)`, `Bash(git log *)`, `Bash(npm run parity:*)`, `Bash(node parity/*)`, `Bash(node bench/*)`, `Bash(java *)`, `Bash(PORT=8083 java *)` (from 02), `Bash(curl *)`, `Bash(cp *)`, `Bash(mkdir *)`, `Bash(chmod *)`, `Bash(git update-index *)`, `Bash(sleep *)`, `Bash(cd kotlin *)`; from iteration 03 also `Bash(git -C * status*)`, `Bash(git -C * diff*)`, `Bash(git -C * log*)`, `Bash(git -C * add *)`, `Bash(git -C * commit *)`, `Bash(git ls-files*)`. This is wider than the brief's minimum (java, curl, cp, mkdir, chmod, git update-index, sleep): the agent must start its candidate and copy the wrapper. No `--dangerously-skip-permissions`.
- Mechanics that are not interventions: the orchestrator creates each slice branch from `origin/main` before the call (the allowlist has no checkout/switch), pushes, writes evidence commits and opens/merges PRs. The plan was written uncommitted in iteration 01 (on a local branch renamed to `PRICE-42-kotlin-skeleton`) and committed by the agent in slice 1.
- Merge rule for slices before the endpoints exist: trace and diff-size green; the parity gate may be red with its gating count recorded and never falling; the last slice must be fully green. A plan that weakens the parity workflow would have been rejected.
- Reviewer seed for the differential tester: 7. It is not named in any prompt and is run only at the final check.

## Iterations

### 01-plan — plan only

- Start 2026-11-23T20:05:24+02:00 · end 2026-11-23T20:06:43+02:00 · wall-clock 79 s
- `num_turns` 11 · `total_cost_usd` 0.61272 · `duration_ms` 75551 · `is_error` false (`success`) · permission denials 2
- Result: wrote `docs/plans/PRICE-42-kotlin.md`, 6 slices (skeleton, pricing-core, json, prices, quote, parity), estimates 150-350 lines each; `com.sun.net.httpserver`, hand-written JSON, fat jar. Uncommitted as asked. Accepted without changes.
- Oracle after it (orchestrator, oracle checkout): not run (no code)
- Interventions: none. Two denied read commands that reached the shop-orders repo outside the clone; `--add-dir` for that repo added to the launcher afterwards (harness change, not a tree change).

Prompt (verbatim, `runs/kotlin/prompts/01-plan.txt`):

```text
PRICE-42, Kotlin stream, iteration 1: PLAN ONLY, no code.

Task: shop-pricing (TypeScript, src/) is being reimplemented in Kotlin so that consumers cannot tell the difference. Read AGENTS.md, docs/specs/PRICE-42.md, parity/README.md, contracts/openapi.yaml and src/ first.

Write docs/plans/PRICE-42-kotlin.md: a slice list of 4 to 6 pull requests that together deliver the Kotlin service. Do not write any code in this iteration, and do not commit (the plan is committed with the first slice).

Fixed constraints the plan must respect:
- All code in kotlin/ at the repo root. Nothing else at the repo root except one CI workflow file, .github/workflows/parity-kotlin.yml. Never edit parity/, contracts/, bench/ or .claude/ (they are the locked oracle).
- Java 21, Gradle wrapper inside kotlin/ (no system Gradle is installed; Gradle 9.9.1 is already in the local Gradle cache, and the wrapper files gradlew, gradlew.bat and gradle/wrapper/* may be copied from D:\projects\clients\spd-technology\demo\2026-spd-shop-orders). A small HTTP stack: Ktor or plain com.sun.net.httpserver, your choice, recorded with the reason. BigDecimal for money. Port from PORT (default 8082), no other configuration. The spec's non-goals apply: no new endpoints, fields, messages or status codes.
- Each slice is one PR on branch PRICE-42-kotlin-<slug>, under 400 changed lines as the shop-harness diff-size gate counts them (added + deleted; gradlew, gradlew.bat, **/gradle/wrapper/**, lockfiles and docs/evidence/** do not count; docs/plans/ does count). Give an estimate per slice.
- Every commit message ends with these two trailer lines:
  Refs: PRICE-42
  Assisted-by: Claude Code (claude-opus-5-5)
- Slice 1 includes the build, the runnable skeleton and the parity gate workflow .github/workflows/parity-kotlin.yml: on pull_request, on ubuntu-latest, set up Java 21 and Node 24, build the candidate with the wrapper, start the built artifact (not gradle run), wait for it, and run node parity/check.mjs, node parity/contract.mjs and node parity/blackbox/run.mjs against it. The gate stays strict from the first slice (no continue-on-error, no subset of checks); it is expected to be red until the endpoints exist.
- The last slice ends with: parity/check.mjs all gating cases, parity/contract.mjs, parity/blackbox/run.mjs 16/16, and parity/diff/diff.mjs against the TS reference with 0 differences for seed 42 n 1000 and for another seed chosen by the reviewer; plus kotlin/README.md with the exact build and production start command (built jar, java -jar).
- Local environment for later slices: the TS reference runs at http://localhost:8093 (already running, do not start or stop it). Run your candidate only on PORT=8083. Never use ports 8082, 8084 or 8094. Do not run the benchmark (bench/run.mjs).
- Evidence files under docs/evidence/ are written by the orchestrator, not by you.

For each slice give: slug, scope, files, estimated changed lines, how it is verified (commands), and which oracle checks are expected to pass after it. End with a short list of risks.
```

### 02-skeleton — slice 1 skeleton, attempt 1

- Start 2026-11-23T20:07:37+02:00 · end 2026-11-23T20:09:03+02:00 · wall-clock 86 s
- `num_turns` 27 · `total_cost_usd` 0.739724 · `duration_ms` 79922 · `is_error` false (`success`) · permission denials 8
- Result: wrote the build, server, `/catalog`, test and workflow, copied gradlew, gradlew.bat and gradle-wrapper.jar, but Claude Code's permission system refused every way of writing `kotlin/gradle/wrapper/gradle-wrapper.properties` (Write, cp, Copy-Item) and `git -C ... status/diff` were not allowed, so it did not build or commit and stopped with a request for help. 8 denials.
- Oracle after it (orchestrator, oracle checkout): not run (nothing committed)
- Interventions: **#1** the orchestrator copied `gradle-wrapper.properties` byte-identical (`cmp`) from 2026-spd-shop-orders (Gradle 9.9.1) into `kotlin/gradle/wrapper/`. Reason: the harness blocks this file for the agent; the stream instructions allow copying the wrapper from shop-orders. Allowlist widened with `git -C` status/diff/log/add/commit and `git ls-files` (harness change).

Prompt (verbatim, `runs/kotlin/prompts/02-skeleton.txt`):

```text
PRICE-42, Kotlin stream, slice 1 of 6: skeleton. Branch: PRICE-42-kotlin-skeleton.

Implement slice 1 of the accepted plan docs/plans/PRICE-42-kotlin.md (build, runnable skeleton, GET /catalog, the parity gate workflow .github/workflows/parity-kotlin.yml). The plan file is still uncommitted: commit it in this slice.

Rules (all slices):
- Read AGENTS.md, docs/specs/PRICE-42.md, parity/README.md and the accepted plan docs/plans/PRICE-42-kotlin.md first.
- You are already on the slice branch, created from origin/main. Do not create, switch, rebase or push branches; the orchestrator pushes and opens the PR.
- All code in kotlin/. Nothing else at the repo root except .github/workflows/parity-kotlin.yml. Never edit parity/, contracts/, bench/ or .claude/. Do not write files under docs/evidence/ (the orchestrator writes evidence). Spec non-goals apply: no new endpoints, fields, messages or status codes.
- Java 21, Gradle wrapper in kotlin/, BigDecimal money, PORT env var (default 8082).
- Keep this slice under 400 changed lines as the diff-size gate counts them (added + deleted vs origin/main; gradlew, gradlew.bat, **/gradle/wrapper/**, lockfiles and docs/evidence/** excluded). Check with git diff --numstat origin/main before you finish.
- The TS reference runs at http://localhost:8093 (do not start or stop it). Run your candidate only on PORT=8083, never on 8082, 8084 or 8094, and stop the candidate process you started before you finish. Do not run the benchmark.
- Oracle commands (repo root): node parity/check.mjs --base http://localhost:8083 ; node parity/contract.mjs --base http://localhost:8083 ; node parity/blackbox/run.mjs --base http://localhost:8083 ; node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000
- Commit your work (one or a few commits). Every commit message ends with exactly these trailer lines as its last paragraph:
  Refs: PRICE-42
  Assisted-by: Claude Code (claude-opus-5-5)
- Finish with a clean working tree and a short report: what you built, changed-line count, build result, oracle counts.
```

### 03-skeleton — slice 1 skeleton, finished

- Start 2026-11-23T20:09:47+02:00 · end 2026-11-23T20:10:54+02:00 · wall-clock 67 s
- `num_turns` 22 · `total_cost_usd` 0.630167 · `duration_ms` 63717 · `is_error` false (`success`) · permission denials 9
- Result: built, ran on 8083, committed `754255b` (plan + skeleton + `parity-kotlin.yml`), set `kotlin/gradlew` to 100755 in the index on its own; 357 counted lines by its own count. 9 denials: piped/redirected oracle commands (`| tail`, `> /tmp/...`) did not match the allowlist; it retried in other forms.
- Oracle after it (orchestrator, oracle checkout): check 6/130 gating, contract 1/125, black-box 1/16, diff seed 42 1000/1000 differ (expected: only `/catalog` exists) — `kotlin-skeleton.md`
- Interventions: none (the prompt states that the wrapper file had been placed and git is now allowed; it says nothing about how to build or fix).

Prompt (verbatim, `runs/kotlin/prompts/03-skeleton.txt`):

```text
PRICE-42, Kotlin stream, slice 1 of 6: skeleton (continued). Branch: PRICE-42-kotlin-skeleton.

The previous run stopped on permissions. The working tree holds its uncommitted slice 1 files. kotlin/gradle/wrapper/gradle-wrapper.properties is now in place (copied by the orchestrator from shop-orders), and git status/diff/log (also with -C) are now allowed. Finish slice 1 of the accepted plan docs/plans/PRICE-42-kotlin.md: build, run on 8083, run the oracle tools, commit (including the plan file).

Rules (all slices):
- Read AGENTS.md, docs/specs/PRICE-42.md, parity/README.md and the accepted plan docs/plans/PRICE-42-kotlin.md first.
- You are already on the slice branch, created from origin/main. Do not create, switch, rebase or push branches; the orchestrator pushes and opens the PR.
- All code in kotlin/. Nothing else at the repo root except .github/workflows/parity-kotlin.yml. Never edit parity/, contracts/, bench/ or .claude/. Do not write files under docs/evidence/ (the orchestrator writes evidence). Spec non-goals apply: no new endpoints, fields, messages or status codes.
- Java 21, Gradle wrapper in kotlin/, BigDecimal money, PORT env var (default 8082).
- Keep this slice under 400 changed lines as the diff-size gate counts them (added + deleted vs origin/main; gradlew, gradlew.bat, **/gradle/wrapper/**, lockfiles and docs/evidence/** excluded). Check with git diff --numstat origin/main before you finish.
- The TS reference runs at http://localhost:8093 (do not start or stop it). Run your candidate only on PORT=8083, never on 8082, 8084 or 8094, and stop the candidate process you started before you finish. Do not run the benchmark.
- Oracle commands (repo root): node parity/check.mjs --base http://localhost:8083 ; node parity/contract.mjs --base http://localhost:8083 ; node parity/blackbox/run.mjs --base http://localhost:8083 ; node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000
- Commit your work (one or a few commits). Every commit message ends with exactly these trailer lines as its last paragraph:
  Refs: PRICE-42
  Assisted-by: Claude Code (claude-opus-5-5)
- Finish with a clean working tree and a short report: what you built, changed-line count, build result, oracle counts.
```

