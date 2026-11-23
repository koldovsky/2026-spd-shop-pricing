# PRICE-42 Go stream — run log

Orchestrator: Claude Code (claude-opus-5-5), following `materials/ws1-s2-migration-brief.md` (23.11.2026). Agent under
test: Claude Code via `claude -p` (CLI 2.1.327), `--model claude-opus-5-5 --max-turns 60`, cwd = the clone
`D:\demo-s2\pricing-go` (so `AGENTS.md` and the repo's `.claude/settings.json` lock hook load). Oracle results come only from a
separate checkout of `128c922` at `D:\demo-s2\oracle-go`; the TS reference is `node dist/server.js` from that checkout
on `PORT=8094`; the candidate is built from the agent's commit to a binary outside the clone and started on `PORT=8084`.

## Result

**Converged** at **b7bd0a2** (merged in #17, main `69f021c`) after **6 iterations** (cap 12), stream wall-clock
**20:01 → 20:33 Kyiv, 23.11.2026 (32 min)** from the clones to the converging oracle run (cap 6 h). The seeded red demo
was recorded afterwards (until 20:42). From the oracle checkout against the candidate at b7bd0a2: corpus 130/130 gating,
contract 125/125, black-box 16/16, diff seed 42 0/1000 and seed 7 0/1000, `git diff 128c922 -- parity contracts bench .claude`
empty (and `git status --porcelain` on those paths empty). Evidence: `go-5-contract-blackbox.md`.

## Definitions and setup (fixed before iteration 1)

- Iteration = one `claude -p` call. Cap 12 iterations / 6 h. Converged and intervention as in the brief.
- Not counted as interventions (the brief's prescribed plumbing): creating each slice branch from `origin/main` (the
  agent's allow-list has no `git checkout`; iteration 1 ran on a local branch renamed to the slice-1 branch), the
  orchestrator's evidence commits, pushing, PRs, merges, starting/stopping processes, and deleting a binary the agent
  left outside the clone (`D:\demo-s2\pricing-go-s2.exe`, iteration 3).
- Wrapper (`runs/go/` has every prompt, raw JSON and start/end stamp): unsets every inherited `CLAUDE*`, `ANTHROPIC_*`,
  `MCP_*`, `OTEL_*` variable, sets `CLAUDE_CODE_HIDE_ACCOUNT_INFO=1`, puts `C:\Program Files\Go\bin` on `PATH`, sets
  `PORT=8084`, then runs
  `claude -p "<prompt>" --output-format json --model claude-opus-5-5 --max-turns 60 --permission-mode acceptEdits --allowedTools ...`
  with this allow-list: `Read Glob Grep Edit Write`, `Bash(go *)`, `Bash(gofmt *)`, `Bash(git add *)`, `Bash(git commit *)`,
  `Bash(git status*)`, `Bash(git diff*)`, `Bash(git log*)`, `Bash(npm run parity:*)`, `Bash(node parity/*)`, `Bash(node bench/*)`,
  `Bash(curl http://localhost:*)`, `Bash(curl -s http://localhost:*)`, `Bash(curl -i http://localhost:*)` and the PowerShell
  equivalents of the go/git/node/npm entries. No `--dangerously-skip-permissions`. Harness change after iteration 2 (the
  agent was denied `curl -si`): added `Bash(curl -si http://localhost:*)`, `Bash(curl -sS http://localhost:*)`,
  `PowerShell(curl.exe *http://localhost:*)`. That is configuration of the run, not a change to the agent's tree.
- Plan review: the plan (iteration 1) was accepted on first review. Deviations from the brief were handled as scope in
  later prompts: the plan's slice 5 included running the benchmark (the brief reserves it for the presenter) and
  agent-written evidence (the brief makes evidence the orchestrator's).
- Parity gate on partial slices: the plan prompt required every PR's parity gate to be green at merge, so the plan
  scoped `parity-go.yml` with `check.mjs --tag ...` on slices 1–3 (#10, #11, #13); slice 4 (#15) ran the unfiltered
  corpus, slice 5 (#17) the final gate (unfiltered `check.mjs`, `contract.mjs`, `blackbox/run.mjs`). Every evidence file
  also reports the full oracle with full denominators.

## Interventions

1. Iteration 4 prompt added a requirement: run `parity-go.yml` only when `go/**`, the workflow, `parity/**`, `contracts/**`
   or `package-lock.json` change, because the Kotlin stream's `parity-kotlin.yml` and `parity-go.yml` fired on each other's
   PRs. A requirement, not a fix hint.
2. Iteration 6 prompt: benchmark out of scope and evidence by the orchestrator (both from the brief), and a required
   `go/README.md` with the production start command (the brief's suggested slice 5). Scope, not a fix hint.
3. SEEDED, after convergence: commit 58f11eb changes only the tie rule of `cents()` to half-up (branch
   `PRICE-42-go-seeded-halfup`, PR #19, closed unmerged).
4. SEEDED, after convergence: commit cd7267a changes only the expected values of the tie cases in `go/money_test.go` and
   `go/quote_test.go`, so the seeded run gets past `go test` and reaches the oracle step in Actions.

No re-prompt after a failure was needed: every iteration's oracle result matched what its slice promised.

## The rounding trap — red moment: SEEDED (no natural red)

The calculation slice (iteration 4, 09bbb2c, #13) passed `trap-cart-discount-tie-even` and all `rounding-trap` cases
(5/5) the first time; its parity-go run 45238179177 was green. AGENTS.md states the half-even rule; no prompt mentioned
rounding (`grep -i -E "round|half|even|bank"` over the six prompts matches only the word "background"). So the red is seeded:

| Seeded commit | parity-go run | Red at | Tag |
|---|---|---|---|
| 58f11eb (only the `cents()` tie rule → half-up) | https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45240621161 | `go test` (the agent's own unit tests); oracle steps skipped | `price-42-go-seeded` |
| cd7267a (plus only the tie-case test expectations) | https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45240838007 | `oracle check (all cases)`: FAIL `trap-cart-discount-tie-even`, `trap-line-discount-tie-even`, `trap-line-total-tie-even`, `quote-50-lines` | `price-42-go-seeded-oracle` |

Local oracle on both seeded builds: corpus 126/130, contract 125/125, black-box 15/16, diff seed 42 77/1000, seed 7 75/1000.
Evidence: `docs/evidence/PRICE-42/go-seeded-halfup.md` on the branch `PRICE-42-go-seeded-halfup` (b27d3d6; not on main).
The PR label is `SEEDED DEFECT - do not merge` (GitHub's 50-character limit); the brief's full sentence is the label
description and the PR title.

## PRs and gate runs

| PR | Slice | parity-go run (green at merge) | trace + diff-size run | Changed lines (gate count) |
|---|---|---|---|---|
| [#10](https://github.com/koldovsky/2026-spd-shop-pricing/pull/10) | 1 skeleton, catalog, gate (+ plan) | [45236752589](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45236752589) (tags catalog, routing) | [45236753506](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45236753506) | 361 |
| [#11](https://github.com/koldovsky/2026-spd-shop-pricing/pull/11) | 2 money, GET /prices | [45237369451](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45237369451) (+ prices) | [45237370241](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45237370241) | 164 |
| [#13](https://github.com/koldovsky/2026-spd-shop-pricing/pull/13) | 3 quote calculation | [45238179177](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45238179177) (+ 6 quote tags) | [45238179951](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45238179951) | 222 |
| [#15](https://github.com/koldovsky/2026-spd-shop-pricing/pull/15) | 4 validation | [45239051185](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45239051185) (unfiltered corpus) | [45239052263](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45239052263) | 302 |
| [#17](https://github.com/koldovsky/2026-spd-shop-pricing/pull/17) | 5 final gate, go/README | [45239793695](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45239793695) (corpus + contract + black-box) | [45239793897](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45239793897) | 92 |
| [#19](https://github.com/koldovsky/2026-spd-shop-pricing/pull/19) | SEEDED, closed unmerged | red: 45240621161, 45240838007 | — | — |

parity-go on main after #17 (push): [45240033829](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45240033829), success.
On #11, #13, #15 and #17 the Kotlin stream's `parity-kotlin.yml` also ran and was red (the Kotlin port was incomplete on
main); it does not build `go/`, and each of those PRs has a comment saying so.

## Iterations

### 01-plan

- Start 2026-11-23T20:05:38+0200, end 2026-11-23T20:07:12+0200, wall-clock 94 s (wrapper timestamps)
- `num_turns` 13, `total_cost_usd` 0.718956, `duration_ms` 91143, `is_error` false, `subtype` success, permission denials 2
- Result: plan of 5 slices committed (25e0c2e, docs/plans/PRICE-42-go.md); accepted on first review, not sent back.
- Oracle after it (orchestrator, oracle checkout 128c922): n/a (no code).
- Interventions: none.
- Raw: `runs/go/01-plan.json`

Prompt (verbatim, also `runs/go/01-plan.prompt.txt`):

```text
PRICE-42: reimplement this pricing service in Go. This first step is a PLAN ONLY, no code.

Read AGENTS.md, docs/specs/PRICE-42.md, parity/README.md, contracts/openapi.yaml and src/ first.

Write a slice list of 4 to 6 pull requests for the Go reimplementation and save it to docs/plans/PRICE-42-go.md. Constraints the plan must respect:
- Code only in go/ at the repo root. Go 1.27 (on PATH as `go`), standard library preferred. The service reads its port from PORT (default 8082) and needs no other configuration.
- Each PR is under 400 changed lines as counted by the shop-harness diff-size gate (added + deleted lines; docs/evidence/** and go.sum do not count; the plan file itself counts toward the slice it lands in).
- Exactly one CI workflow file at the repo root, .github/workflows/parity-go.yml, added in the first slice: on ubuntu it builds the Go candidate, starts it, and runs node parity/check.mjs, node parity/contract.mjs and node parity/blackbox/run.mjs against it. That workflow is the parity gate. Nothing else may change at the repo root (no README, AGENTS.md or .gitattributes changes).
- The parity gate of every PR must be green at merge. For each slice state which oracle commands the workflow runs at that slice's head (check.mjs accepts --tag <tag>; contract.mjs and blackbox/run.mjs have no filter), and the result you expect. By the last slice the workflow runs the full check.mjs, contract.mjs and blackbox/run.mjs with no filter.
- The oracle (parity/, contracts/, bench/, .claude/) is never edited.
For each slice give: a short slug, scope, files, estimated changed lines, and how it is verified with the oracle commands.

Commit only docs/plans/PRICE-42-go.md, with a message whose last paragraph is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
Do not push, do not create or switch branches. Write everything in English.
```

### 02-skeleton-catalog

- Start 2026-11-23T20:07:40+0200, end 2026-11-23T20:09:01+0200, wall-clock 81 s (wrapper timestamps)
- `num_turns` 27, `total_cost_usd` 0.6722615999999999, `duration_ms` 78567, `is_error` false, `subtype` success, permission denials 7
- Result: slice 1 committed (a0ef620): go.mod, main, catalog, GET /catalog, 404s, tests, parity-go.yml (check --tag catalog, --tag routing).
- Oracle after it (orchestrator, oracle checkout 128c922): at a0ef620: tag catalog 1/1, routing 5/5; full corpus 6/130, contract 1/125, black-box 1/16, diff seed 42 1000/1000 and seed 7 1000/1000 differ (expected: slice 1 only).
- Interventions: none.
- Raw: `runs/go/02-skeleton-catalog.json`

Prompt (verbatim, also `runs/go/02-skeleton-catalog.prompt.txt`):

```text
PRICE-42 Go, slice 1 of the plan in docs/plans/PRICE-42-go.md: `go-skeleton-catalog`. The plan is accepted. Implement slice 1 exactly as planned (Go module, server with PORT handling, catalog, GET /catalog, 404 for unrouted paths, unit tests, and .github/workflows/parity-go.yml running the oracle steps the plan lists for this slice). Keep the slice under 400 changed lines including the plan.

Working rules for this step:
- Environment: `go` (1.27) is on PATH; PORT=8084 is already set in your environment, so a candidate you start listens on http://localhost:8084. The TypeScript reference service is already running at http://localhost:8094 (do not stop it). Use `go -C go <cmd>` (for example `go -C go test ./...`, `go -C go build -o pricing.exe .`, `go -C go run .`) instead of `cd`. Start the candidate in the background when you need it and stop it before you finish.
- Oracle commands (run them, never edit parity/, contracts/, bench/ or .claude/): `node parity/check.mjs --base http://localhost:8084 [--tag <tag>]`, `node parity/contract.mjs --base http://localhost:8084`, `node parity/blackbox/run.mjs --base http://localhost:8084`, `node parity/diff/diff.mjs --a http://localhost:8094 --b http://localhost:8084 --seed 42 --n 1000`. Do not run the benchmark.
- Do not push, do not create or switch branches, do not write evidence files under docs/evidence/ (the orchestrator records evidence). Do not commit build outputs (binaries).
- Commit your work (only files under go/, .github/workflows/parity-go.yml and docs/plans/PRICE-42-go.md) in one or more commits; the last paragraph of every commit message is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
- Everything in English. When done, report what you changed, the oracle results you saw, and anything you are unsure about.
```

### 03-money-prices

- Start 2026-11-23T20:18:29+0200, end 2026-11-23T20:19:55+0200, wall-clock 86 s (wrapper timestamps)
- `num_turns` 28, `total_cost_usd` 0.8574232000000002, `duration_ms` 83025, `is_error` false, `subtype` success, permission denials 7
- Result: slice 2 committed (dd71c1f): big.Rat money, GET /prices/{sku}, tests, gate + --tag prices.
- Oracle after it (orchestrator, oracle checkout 128c922): at dd71c1f: tags catalog 1/1, routing 5/5, prices 33/33; full corpus 39/130, contract 34/125, black-box 5/16, diff seed 42 847/1000, seed 7 856/1000 differ (all POST /quote).
- Interventions: none (orchestrator deleted a binary the agent left outside the clone, D:/demo-s2/pricing-go-s2.exe; not the agent's tree).
- Raw: `runs/go/03-money-prices.json`

Prompt (verbatim, also `runs/go/03-money-prices.prompt.txt`):

```text
PRICE-42 Go, slice 2 of the plan in docs/plans/PRICE-42-go.md: `go-money-prices`. Slice 1 is merged. Implement slice 2 as planned, including the parity gate steps the plan lists for this slice. Keep the slice under 400 changed lines.

Working rules for this step:
- Environment: `go` (1.27) is on PATH; PORT=8084 is already set in your environment, so a candidate you start listens on http://localhost:8084. The TypeScript reference service is already running at http://localhost:8094 (do not stop it). Use `go -C go <cmd>` (for example `go -C go test ./...`, `go -C go build -o pricing.exe .`, `go -C go run .`) instead of `cd`. Start the candidate in the background when you need it and stop it before you finish.
- Oracle commands (run them, never edit parity/, contracts/, bench/ or .claude/): `node parity/check.mjs --base http://localhost:8084 [--tag <tag>]`, `node parity/contract.mjs --base http://localhost:8084`, `node parity/blackbox/run.mjs --base http://localhost:8084`, `node parity/diff/diff.mjs --a http://localhost:8094 --b http://localhost:8084 --seed 42 --n 1000`. Do not run the benchmark.
- Do not push, do not create or switch branches, do not write evidence files under docs/evidence/ (the orchestrator records evidence). Do not commit build outputs (binaries).
- Commit your work (only files under go/, .github/workflows/parity-go.yml and docs/plans/PRICE-42-go.md) in one or more commits; the last paragraph of every commit message is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
- Everything in English. When done, report what you changed, the oracle results you saw, and anything you are unsure about.
```

### 04-quote-happy

- Start 2026-11-23T20:22:22+0200, end 2026-11-23T20:24:34+0200, wall-clock 132 s (wrapper timestamps)
- `num_turns` 34, `total_cost_usd` 1.0755870000000003, `duration_ms` 128917, `is_error` false, `subtype` success, permission denials 10
- Result: slice 3 committed (09bbb2c): POST /quote calculation, tests, gate + six tag steps, path filter.
- Oracle after it (orchestrator, oracle checkout 128c922): at 09bbb2c: all ten tag runs pass incl. rounding-trap 5/5 (trap-cart-discount-tie-even passes: no natural red); full corpus 106/130, contract 119/125, black-box 15/16, diff seed 42 139/1000, seed 7 175/1000 differ (all validation inputs).
- Interventions: #1: the prompt added a requirement (path filter on parity-go.yml) because parity-kotlin.yml and parity-go.yml fired on each other's PRs. A requirement, not a fix hint.
- Raw: `runs/go/04-quote-happy.json`

Prompt (verbatim, also `runs/go/04-quote-happy.prompt.txt`):

```text
PRICE-42 Go, slice 3 of the plan in docs/plans/PRICE-42-go.md: `go-quote-happy`. Slices 1 and 2 are merged. Implement slice 3 as planned, including the parity gate steps the plan lists for this slice. Keep the slice under 400 changed lines.

One added requirement: the Kotlin stream's workflow .github/workflows/parity-kotlin.yml now shares this repo (do not touch it). Make parity-go.yml run on pull requests and pushes to main only when go/**, .github/workflows/parity-go.yml, parity/**, contracts/** or package-lock.json change.

Working rules for this step:
- Environment: `go` (1.27) is on PATH; PORT=8084 is already set in your environment, so a candidate you start listens on http://localhost:8084. The TypeScript reference service is already running at http://localhost:8094 (do not stop it). Use `go -C go <cmd>` (for example `go -C go test ./...`, `go -C go build -o pricing.exe .`, `go -C go run .`) instead of `cd`. Start the candidate in the background when you need it and stop it before you finish.
- Oracle commands (run them, never edit parity/, contracts/, bench/ or .claude/): `node parity/check.mjs --base http://localhost:8084 [--tag <tag>]`, `node parity/contract.mjs --base http://localhost:8084`, `node parity/blackbox/run.mjs --base http://localhost:8084`, `node parity/diff/diff.mjs --a http://localhost:8094 --b http://localhost:8084 --seed 42 --n 1000`. Do not run the benchmark.
- Do not push, do not create or switch branches, do not write evidence files under docs/evidence/ (the orchestrator records evidence). Do not commit build outputs (binaries).
- Commit your work (only files under go/, .github/workflows/parity-go.yml and docs/plans/PRICE-42-go.md) in one or more commits; the last paragraph of every commit message is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
- Everything in English. When done, report what you changed, the oracle results you saw, and anything you are unsure about.
```

### 05-quote-validation

- Start 2026-11-23T20:26:44+0200, end 2026-11-23T20:29:08+0200, wall-clock 144 s (wrapper timestamps)
- `num_turns` 39, `total_cost_usd` 1.1642972000000005, `duration_ms` 141486, `is_error` false, `subtype` success, permission denials 10
- Result: slice 4 committed (6503919): Express-compatible body and quantity validation, validation order, tests, gate = unfiltered check.mjs.
- Oracle after it (orchestrator, oracle checkout 128c922): at 6503919: corpus 130/130, contract 125/125, black-box 16/16, diff seed 42 0/1000, seed 7 0/1000, lock diff empty.
- Interventions: none.
- Raw: `runs/go/05-quote-validation.json`

Prompt (verbatim, also `runs/go/05-quote-validation.prompt.txt`):

```text
PRICE-42 Go, slice 4 of the plan in docs/plans/PRICE-42-go.md: `go-quote-validation`. Slices 1 to 3 are merged. Implement slice 4 as planned, including the parity gate change the plan lists for this slice. Keep the slice under 400 changed lines; if it cannot fit, implement the plan's 4a split only and say so.

Working rules for this step:
- Environment: `go` (1.27) is on PATH; PORT=8084 is already set in your environment, so a candidate you start listens on http://localhost:8084. The TypeScript reference service is already running at http://localhost:8094 (do not stop it). Use `go -C go <cmd>` (for example `go -C go test ./...`, `go -C go build -o pricing.exe .`, `go -C go run .`) instead of `cd`. Start the candidate in the background when you need it and stop it before you finish.
- Oracle commands (run them, never edit parity/, contracts/, bench/ or .claude/): `node parity/check.mjs --base http://localhost:8084 [--tag <tag>]`, `node parity/contract.mjs --base http://localhost:8084`, `node parity/blackbox/run.mjs --base http://localhost:8084`, `node parity/diff/diff.mjs --a http://localhost:8094 --b http://localhost:8084 --seed 42 --n 1000`. Do not run the benchmark.
- Do not push, do not create or switch branches, do not write evidence files under docs/evidence/ (the orchestrator records evidence). Do not commit build outputs (binaries).
- Commit your work (only files under go/, .github/workflows/parity-go.yml and docs/plans/PRICE-42-go.md) in one or more commits; the last paragraph of every commit message is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
- Everything in English. When done, report what you changed, the oracle results you saw, and anything you are unsure about.
```

### 06-contract-blackbox

- Start 2026-11-23T20:31:51+0200, end 2026-11-23T20:32:55+0200, wall-clock 64 s (wrapper timestamps)
- `num_turns` 27, `total_cost_usd` 0.6431652, `duration_ms` 60744, `is_error` false, `subtype` success, permission denials 6
- Result: slice 5 committed (b7bd0a2): gate adds npm ci, contract.mjs, blackbox/run.mjs (final state); go/README.md; go/.gitignore; plan updated. No Go code change.
- Oracle after it (orchestrator, oracle checkout 128c922): at b7bd0a2: corpus 130/130, contract 125/125, black-box 16/16, diff seed 42 0/1000, seed 7 0/1000, lock diff and status empty = CONVERGED.
- Interventions: #2: the prompt stated the benchmark is out of scope and evidence is the orchestrator's (both from the brief), and required go/README.md with the production start command (the brief's suggested slice 5). Scope, not a fix hint.
- Raw: `runs/go/06-contract-blackbox.json`

Prompt (verbatim, also `runs/go/06-contract-blackbox.prompt.txt`):

```text
PRICE-42 Go, slice 5 of the plan in docs/plans/PRICE-42-go.md: `go-contract-blackbox`. Slices 1 to 4 are merged. Implement slice 5 as planned: the parity gate's final state (unfiltered check.mjs, contract.mjs and blackbox/run.mjs, with whatever setup they need on the runner), and fixes only if the oracle shows a finding. Keep the slice under 400 changed lines.

Changes to the plan for this slice: the benchmark is out of scope (the presenter runs it later; do not run it, and update the plan to say so), and evidence files are written by the orchestrator, not by you. Add go/README.md for the Go stack: how to build, test and run it, with the production-style start command (the built binary with PORT set, not go run).

Working rules for this step:
- Environment: `go` (1.27) is on PATH; PORT=8084 is already set in your environment, so a candidate you start listens on http://localhost:8084. The TypeScript reference service is already running at http://localhost:8094 (do not stop it). Use `go -C go <cmd>` (for example `go -C go test ./...`, `go -C go build -o pricing.exe .`, `go -C go run .`) instead of `cd`. Start the candidate in the background when you need it and stop it before you finish.
- Oracle commands (run them, never edit parity/, contracts/, bench/ or .claude/): `node parity/check.mjs --base http://localhost:8084 [--tag <tag>]`, `node parity/contract.mjs --base http://localhost:8084`, `node parity/blackbox/run.mjs --base http://localhost:8084`, `node parity/diff/diff.mjs --a http://localhost:8094 --b http://localhost:8084 --seed 42 --n 1000`. Do not run the benchmark.
- Do not push, do not create or switch branches, do not write evidence files under docs/evidence/ (the orchestrator records evidence). Do not commit build outputs (binaries).
- Commit your work (only files under go/, .github/workflows/parity-go.yml and docs/plans/PRICE-42-go.md) in one or more commits; the last paragraph of every commit message is exactly these two trailer lines:
Refs: PRICE-42
Assisted-by: Claude Code (claude-opus-5-5)
- Everything in English. When done, report what you changed, the oracle results you saw, and anything you are unsure about.
```

## Totals (from the raw JSON)

```text
$ node docs/evidence/PRICE-42/runs/go/totals.mjs docs/evidence/PRICE-42/runs/go
01-plan.json	turns=13	cost=0.7190	duration_ms=91143	is_error=false	subtype=success
02-skeleton-catalog.json	turns=27	cost=0.6723	duration_ms=78567	is_error=false	subtype=success
03-money-prices.json	turns=28	cost=0.8574	duration_ms=83025	is_error=false	subtype=success
04-quote-happy.json	turns=34	cost=1.0756	duration_ms=128917	is_error=false	subtype=success
05-quote-validation.json	turns=39	cost=1.1643	duration_ms=141486	is_error=false	subtype=success
06-contract-blackbox.json	turns=27	cost=0.6432	duration_ms=60744	is_error=false	subtype=success
TOTAL iterations=6 turns=168 cost_usd=5.1317 duration_ms=583882 (9.7 min) is_error=0
```

Script (`runs/go/totals.mjs`):

```js
// Sums num_turns, total_cost_usd, duration_ms and counts is_error over the raw claude -p JSON results.
// usage: node totals.mjs <dir-with-NN-*.json>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.json$/.test(f)).sort();
let turns = 0, cost = 0, ms = 0, errors = 0;
for (const f of files) {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  turns += j.num_turns; cost += j.total_cost_usd; ms += j.duration_ms; if (j.is_error) errors++;
  console.log(`${f}\tturns=${j.num_turns}\tcost=${j.total_cost_usd.toFixed(4)}\tduration_ms=${j.duration_ms}\tis_error=${j.is_error}\tsubtype=${j.subtype}`);
}
console.log(`TOTAL iterations=${files.length} turns=${turns} cost_usd=${cost.toFixed(4)} duration_ms=${ms} (${(ms / 60000).toFixed(1)} min) is_error=${errors}`);
```

All six results report `modelUsage` for `claude-opus-5-5` only. Agent time (`duration_ms` sum) is 9.7 min of the 32 min
stream wall-clock; the rest is the orchestrator's oracle runs, evidence, CI waits and merges.

## Final state

- Final code commit: **b7bd0a2** (Go code unchanged since 6503919); on main as `69f021c` (merge of #17).
  `git diff b7bd0a2 69f021c -- go` is empty.
- LOC in `go/` (non-blank lines of `*.go`, counted with `grep -cv '^\s*$'` per file): 414 non-test + 279 test = 693
  (755 physical lines); plus `go/README.md` and `go/.gitignore`. Standard library only (`go.mod`, no `go.sum`).
- Build (repo root, any shell): `go -C go build -o pricing.exe .` → `go/pricing.exe`, 10016256 bytes (windows/amd64, go1.27.4).
- Start command used for the final check: the built binary with `PORT=8084` (`oracle-run.sh`: PowerShell `Start-Process`
  with `$env:PORT='8084'`), and again from the repo root at main 69f021c exactly as `bench/run.mjs` spawns it
  (`spawn("go/pricing.exe")` with `PORT` in the environment): `check.mjs` 130/130, exit 0 (`go-logs/final-start-check.log`).
- Benchmark command for the presenter (not run here):
  `node bench/run.mjs --label go --cmd "go/pricing.exe" --out docs/evidence/PRICE-42/bench-go.json`
  (bench sets `PORT` itself, default 8090; build first with the command above).

## Redaction

`runs/go/04-quote-happy.json` and `05-quote-validation.json` contained the machine user's home path inside denied
commands; the committed copies replace it with `<redacted>` (sed over the raw file, nothing else changed). The copy of
`04-quote-happy.json` merged in #13 (commit dd7ab1b) was not yet redacted; #15 replaced it, but the unredacted text
remains in git history at dd7ab1b (main was not rewritten).

## Not verified

- Performance budget (p95 vs TS): not measured; the presenter benchmarks.
- Quirks: 0/6 behave like TS (non-gating; Go answers 422/404/200 where TS answers 500/200/500). In particular bodies
  over 100 kB are priced, not rejected.
- Linux start commands in `go/README.md` were not run locally (CI runs the equivalent build on ubuntu).
- In iteration 4 the agent wrote a helper script to the user's temp folder (running it was denied). The hook and the
  allow-list are guard rails, not a sandbox.
- The parity gate on slices 1–3 ran tag subsets; the full gate ran from #15 (corpus) and #17 (corpus + contract + black-box).

This log was added in its own evidence-only PR; it describes main at 69f021c plus commit 0e882b1 of that PR (only evidence files).
