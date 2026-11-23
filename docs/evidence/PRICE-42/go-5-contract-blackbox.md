# PRICE-42 Go slice 5 `contract-blackbox` — evidence

Verified revision: **b7bd0a24f60810bdd4820b95dc4a45b7ec829963** (branch `PRICE-42-go-contract-blackbox`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:34 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): npm ci, go vet, go test, build, start on :8090, unfiltered `check.mjs`, `contract.mjs`, `blackbox/run.mjs` (the gate's final state). Expected at this head: all exit 0.

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs` (130 gating) | gating: 130/130 passed;RESULT: PASS | [exit 0] |
| `contract.mjs` (125) | contract: 125/125 gating corpus requests conform (status-only cases excluded);RESULT: PASS | [exit 0] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 16;ℹ fail 0 | [exit 0] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: PASS (0/1000 requests differ) | [exit 0] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: PASS (0/1000 requests differ) | [exit 0] |

Build and unit tests (from `build.log`):

```text
# oracle run s5 at b7bd0a24f60810bdd4820b95dc4a45b7ec829963 (2026-11-23T20:33:03+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	(cached)
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-b7bd0a2.exe .
[exit 0]
10016256 bytes D:/demo-s2/bin-go/pricing-b7bd0a2.exe
candidate started: D:/demo-s2/bin-go/pricing-b7bd0a2.exe PID=10192; port 8084 owner PID=10192
stopped PID 10192
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/5-contract-blackbox/` (commands are the first line of each log; `check.log` lists every failing case).
Agent runs for this slice (raw `claude -p` JSON, prompt, start/end): `runs/go/06-contract-blackbox.json` 

**Convergence (brief definition) at b7bd0a2:** from the oracle checkout against the candidate URL, `check.mjs` 130/130 gating, `contract.mjs` 125/125, `blackbox/run.mjs` 16/16, `diff.mjs --seed 42 --n 1000` 0 mismatches and `--seed 7 --n 1000` 0 mismatches, and `git diff 128c922 -- parity contracts bench .claude` empty in the agent's tree (untracked status also empty). Reached after 6 `claude -p` iterations; stream wall-clock 20:01–20:33 (Kyiv, 23.11).

Production-style start (the build and start used for the rows above): `go -C go build -o <path>\pricing.exe .`, then the binary with `PORT=8084` (here started via PowerShell `Start-Process` with `$env:PORT='8084'`). Binary size 10016256 bytes (windows/amd64). Benchmark not run (the presenter runs it).
