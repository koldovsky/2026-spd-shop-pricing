# PRICE-42 Go slice 4 `quote-validation` — evidence

Verified revision: **6503919dda17a20ebd2cb337dd0d09c98b02b90e** (branch `PRICE-42-go-quote-validation`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:29 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): go vet, go test, build, start on :8090, unfiltered `check.mjs` (the nine `--tag` steps are replaced). Expected at this head: 130/130 gating, exit 0. `contract.mjs` and `blackbox/run.mjs` join the workflow in slice 5; here they were run by the orchestrator.

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs` (130 gating) | gating: 130/130 passed;RESULT: PASS | [exit 0] |
| `contract.mjs` (125) | contract: 125/125 gating corpus requests conform (status-only cases excluded);RESULT: PASS | [exit 0] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 16;ℹ fail 0 | [exit 0] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: PASS (0/1000 requests differ) | [exit 0] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: PASS (0/1000 requests differ) | [exit 0] |

Build and unit tests (from `build.log`):

```text
# oracle run s4 at 6503919dda17a20ebd2cb337dd0d09c98b02b90e (2026-11-23T20:29:30+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	0.532s
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-6503919.exe .
[exit 0]
10016256 bytes D:/demo-s2/bin-go/pricing-6503919.exe
candidate started: D:/demo-s2/bin-go/pricing-6503919.exe PID=64432; port 8084 owner PID=64432
stopped PID 64432
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/4-quote-validation/` (commands are the first line of each log; `check.log` lists every failing case).
Agent runs for this slice (raw `claude -p` JSON, prompt, start/end): `runs/go/04-quote-happy.json` `runs/go/05-quote-validation.json` 

Quirks (non-gating, spec allows keep or fix): 0/6 same as TS. Go answers 422 where TS answers 500 for `currency=toString`/`__proto__`/`constructor` and a `null` quote line, 404 for `GET /catalog/` (TS 200), and 200 for a body over 100 kB (TS 500). Details in `go-logs/4-quote-validation/check.log`.

Redaction note: `runs/go/04-quote-happy.json` as merged in #13 (dd7ab1b) contained the machine user's home path inside a denied command; this commit replaces it with a copy where that path is `<redacted>`. No other change to the raw JSON.
